import type * as DbClientModule from "@/db/client";
import { PlacesRepo } from "@/db/repository/places";
import { EntriesRepo } from "@/db/repository/entries";
import { PendingTransitionsRepo } from "@/db/repository/pending";
import { uuid } from "@/lib/id";
import { step } from "./stateMachine";
import { loadState, applyEffects } from "./persistence";
import { maybeNotifyForEffects } from "@/features/notifications/notifier";

/**
 * Dev-only helpers for simulating geofence events end-to-end — state
 * machine + persistence + notifications — without wandering outdoors.
 *
 * Gated behind `__DEV__` in the Settings UI. Under Jest `__DEV__` is true,
 * so these are directly testable.
 *
 * Flow:
 *   simulateEnter(placeId) — dispatches REGION_ENTER with atS=now
 *   simulateExit(placeId)  — dispatches REGION_EXIT with atS=now
 *   simulatePassage(placeId, dwellS) — convenience: enter, confirm, wait
 *   dwellS, exit, confirm — fully persisted so the Timeline reflects it.
 */
function getDb() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@/db/client") as typeof DbClientModule;
  return mod.db;
}

async function dispatch(
  action: "enter" | "exit" | "confirm",
  placeId: string | null,
  atS: number,
): Promise<void> {
  const db = getDb();
  const places = new PlacesRepo(db);
  const entries = new EntriesRepo(db);
  const pending = new PendingTransitionsRepo(db);

  const state = loadState(entries, pending);
  let event: Parameters<typeof step>[1];
  if (action === "confirm") {
    event = { kind: "CONFIRM", atS };
  } else {
    if (!placeId) return;
    const place = places.get(placeId);
    if (!place) return;
    if (action === "enter") {
      event = {
        kind: "REGION_ENTER",
        placeId,
        atS,
        entryBufferS: place.entryBufferS,
        transitionId: uuid(),
      };
    } else {
      event = {
        kind: "REGION_EXIT",
        placeId,
        atS,
        exitBufferS: place.exitBufferS,
        transitionId: uuid(),
      };
    }
  }
  const r = step(state, event);
  applyEffects(r.effects, r.next, entries, pending, atS);
  await maybeNotifyForEffects(r.effects, places, db, atS);
}

export async function simulateEnter(placeId: string, nowS?: number): Promise<void> {
  const atS = nowS ?? Math.floor(Date.now() / 1000);
  await dispatch("enter", placeId, atS);
  await dispatch("confirm", null, atS + 1_000_000); // immediately confirm to land in ACTIVE
}

export async function simulateExit(placeId: string, nowS?: number): Promise<void> {
  const atS = nowS ?? Math.floor(Date.now() / 1000);
  await dispatch("exit", placeId, atS);
  await dispatch("confirm", null, atS + 1_000_000);
}

/**
 * End-to-end visit: enter → dwell → exit. Useful from the Settings
 * Developer section for a single-button "demo a visit" action. The dwellS
 * parameter controls both the duration of the recorded entry and the delay
 * before dispatching the exit event.
 */
export async function simulatePassage(
  placeId: string,
  dwellS: number,
  nowS?: number,
): Promise<void> {
  const atS = nowS ?? Math.floor(Date.now() / 1000);
  await simulateEnter(placeId, atS);
  await simulateExit(placeId, atS + dwellS);
}
