import * as TaskManager from "expo-task-manager";
import type * as DbClientModule from "@/db/client";
import { uuid } from "@/lib/id";
import { EntriesRepo } from "@/db/repository/entries";
import { PlacesRepo } from "@/db/repository/places";
import { PendingTransitionsRepo } from "@/db/repository/pending";
import { KvRepo } from "@/db/repository/kv";
import { step, type Event, type MachineState } from "@/features/tracking/stateMachine";
import { loadState, applyEffects } from "@/features/tracking/persistence";
import { TASK_NAME } from "@/features/tracking/geofenceService";
import { maybeNotifyForEffects } from "@/features/notifications/notifier";
import { recordBgFire } from "@/features/tracking/trackingHealth";

/** iOS event type → state machine event kind. */
const EVENT_ENTER = 1;
const EVENT_EXIT = 2;

/** Shape of the data payload Expo passes to our geofencing task. */
export type GeofencingData = {
  eventType: number;
  region: {
    identifier: string;
    latitude: number;
    longitude: number;
    radius: number;
  };
};

/**
 * Resolves a `db` reference without importing `@/db/client` (which drags in
 * `expo-sqlite` native) until we're truly running in RN. Jest never imports
 * this module's body because `defineTask` itself is mocked.
 */
function getDb() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@/db/client") as typeof DbClientModule;
  return mod.db;
}

/**
 * Handle a single geofencing event. Extracted for unit testing — the real
 * TaskManager invocation just forwards to here.
 *
 * Always runs an opportunistic CONFIRM pass at the end so any pending
 * transition whose buffer has elapsed is resolved in the same wake window
 * — this is how we recover from missed events.
 */
export async function handleGeofencingEvent(
  data: GeofencingData | null,
  nowS: number = Math.floor(Date.now() / 1000),
): Promise<void> {
  const db = getDb();
  // `places` + `kv` are read-mostly outside the transaction; the write-heavy
  // path (loadState → apply events → apply CONFIRMs) is wrapped in a single
  // db.transaction below using tx-scoped repos. Notifications fire after
  // commit so a rolled-back transaction doesn't leave orphan toasts.
  const placesOuter = new PlacesRepo(db);
  const kv = new KvRepo(db);

  // Record the wake so the tracking-health indicator knows the OS is still
  // calling us. Written unconditionally — even an empty/unknown event is
  // evidence that the task is registered and firing.
  recordBgFire(kv, nowS);

  const allEffects: ReturnType<typeof step>["effects"] = [];

  // All state-machine reads + writes run in one atomic transaction. If the
  // JS task crashes mid-batch, the OS rolls back and `loadState` on the
  // next wake sees a consistent DB. drizzle-orm's transaction callback
  // receives a `tx` drizzle instance that transparently proxies to the
  // transaction — we pass it into tx-scoped repo constructors so every
  // write in this block lands inside the transaction.
  db.transaction((tx) => {
    const entries = new EntriesRepo(tx);
    const pending = new PendingTransitionsRepo(tx);
    const places = new PlacesRepo(tx);

    const initial = loadState(entries, pending);
    let state = initial;

    // 1. Apply the incoming region event (if any).
    if (data) {
      const event = mapRegionEvent(data, places, nowS);
      if (event) {
        const r = step(state, event);
        state = applyEffects(r.effects, r.next, entries, pending, nowS);
        allEffects.push(...r.effects);
      }
    }

    // 2. Opportunistic CONFIRM for any pending transition whose buffer has
    // elapsed. Keeps looping until no more are due.
    for (let i = 0; i < 10; i++) {
      const due = pending.dueAt(nowS);
      if (due.length === 0) break;
      const r = step(state, { kind: "CONFIRM", atS: nowS });
      if (r.effects.length === 0) break;
      state = applyEffects(r.effects, r.next, entries, pending, nowS);
      allEffects.push(...r.effects);
    }
  });

  // 3. Fire notifications for any open/close effects that occurred. This
  // runs AFTER the transaction commits — a rolled-back transaction would
  // have empty `allEffects`, so we won't send a notification for a write
  // that didn't persist.
  await maybeNotifyForEffects(allEffects, placesOuter, nowS);
}

function mapRegionEvent(data: GeofencingData, placesRepo: PlacesRepo, nowS: number): Event | null {
  const place = placesRepo.get(data.region.identifier);
  if (!place) return null;

  if (data.eventType === EVENT_ENTER) {
    return {
      kind: "REGION_ENTER",
      placeId: place.id,
      atS: nowS,
      entryBufferS: place.entryBufferS,
      transitionId: uuid(),
    };
  }
  if (data.eventType === EVENT_EXIT) {
    return {
      kind: "REGION_EXIT",
      placeId: place.id,
      atS: nowS,
      exitBufferS: place.exitBufferS,
      transitionId: uuid(),
    };
  }
  return null;
}

/**
 * Register the task with expo-task-manager. This must run at module-import
 * time, before the UI renders — when the OS cold-wakes the app for a
 * geofence event there is no React render pass, only JS module evaluation.
 *
 * Re-registering an already-defined task is a no-op (TaskManager guards
 * internally).
 */
function register(): void {
  if (TaskManager.isTaskDefined(TASK_NAME)) return;
  TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.warn("[geofence-task] error:", error);
      return;
    }
    try {
      await handleGeofencingEvent((data as GeofencingData) ?? null);
    } catch (err) {
      console.error("[geofence-task] handler failed:", err);
    }
  });
}

register();

export { TASK_NAME };

/**
 * Call once on app foreground. Runs the same opportunistic CONFIRM pass the
 * background task would run, catching up on any transitions that expired
 * while the task was dormant. Also provides a `state` return value for the
 * UI (e.g. Timeline running-timer card).
 */
export async function runOpportunisticResolve(
  nowS: number = Math.floor(Date.now() / 1000),
): Promise<MachineState> {
  await handleGeofencingEvent(null, nowS);
  const db = getDb();
  return loadState(new EntriesRepo(db), new PendingTransitionsRepo(db));
}

/**
 * Seed an immediate entry when the user is already inside a place the OS
 * won't fire `didEnter` for — typical case: adding a place at the current
 * address, or cold-booting inside a region the OS dropped on reboot. Uses
 * `entryBufferS: 0` so the pending-enter promotes to ACTIVE on the same
 * wake, giving the user instant feedback. Noop if state is already ACTIVE
 * or PENDING_ENTER for the same place.
 */
export async function dispatchSyntheticEnter(
  placeId: string,
  nowS: number = Math.floor(Date.now() / 1000),
): Promise<void> {
  const db = getDb();
  const placesOuter = new PlacesRepo(db);
  const kv = new KvRepo(db);
  recordBgFire(kv, nowS);

  const allEffects: ReturnType<typeof step>["effects"] = [];
  db.transaction((tx) => {
    const entries = new EntriesRepo(tx);
    const pending = new PendingTransitionsRepo(tx);
    const places = new PlacesRepo(tx);

    if (!places.get(placeId)) return;

    let state = loadState(entries, pending);
    if ((state.kind === "ACTIVE" || state.kind === "PENDING_ENTER") && state.placeId === placeId) {
      return;
    }

    const event: Event = {
      kind: "REGION_ENTER",
      placeId,
      atS: nowS,
      entryBufferS: 0,
      transitionId: uuid(),
    };
    const r1 = step(state, event);
    state = applyEffects(r1.effects, r1.next, entries, pending, nowS);
    allEffects.push(...r1.effects);

    const r2 = step(state, { kind: "CONFIRM", atS: nowS });
    state = applyEffects(r2.effects, r2.next, entries, pending, nowS);
    allEffects.push(...r2.effects);
  });

  await maybeNotifyForEffects(allEffects, placesOuter, nowS);
}

// Exported for tests only.
export const __internals = { mapRegionEvent };
