import { AppState, type AppStateStatus } from "react-native";
import { PlacesRepo } from "@/db/repository/places";
import { EntriesRepo } from "@/db/repository/entries";
import { KvRepo } from "@/db/repository/kv";
import { getDeviceDb } from "@/db/deviceDb";
import { getCurrentPlaceId, reconcileGeofences } from "./geofenceService";
import { getLocationStatus } from "@/features/permissions";
import { configureNotificationChannels } from "@/features/notifications/notifier";
import { dispatchSyntheticEnter, runOpportunisticResolve } from "@/background/tasks";
import { useDataVersionStore } from "@/state/dataVersionStore";
import { runRetentionSweep } from "@/features/diagnostics/retention";
import { nowS } from "@/lib/time";

/**
 * Initialize the tracking engine. Called once from `app/_layout.tsx` after
 * migrations. Idempotent and side-effectful:
 *   1. Configures notification channel + category (first-time only).
 *   2. If location is granted, (re-)registers geofences for all known
 *      places. The OS drops registrations on reboot; this is the recovery
 *      path. When permission isn't granted we skip silently — the Timeline
 *      banner prompts the user.
 *   3. Runs one opportunistic CONFIRM pass through the state machine to
 *      resolve any transition whose buffer elapsed while the app was dead.
 *
 * Never throws — boot cannot depend on the tracking engine being healthy.
 */
export async function bootstrapTracking(): Promise<void> {
  try {
    const db = getDeviceDb();
    const places = new PlacesRepo(db);
    const kv = new KvRepo(db);

    // Notification-channel setup + permission read are independent I/O.
    const [, locStatus] = await Promise.all([
      configureNotificationChannels(kv),
      getLocationStatus(),
    ]);

    if (locStatus === "granted") {
      const list = places.list();
      await reconcileGeofences(list);
      // iOS only fires didEnter on boundary crossing. If the user is standing
      // inside a saved place at boot (or added one then backgrounded), seed
      // an entry so the Timeline doesn't look frozen.
      const currentPlaceId = await getCurrentPlaceId(list);
      if (currentPlaceId) await dispatchSyntheticEnter(currentPlaceId);
    }

    // Always run opportunistic resolve — it's cheap and catches up any
    // pending transition left behind from a previous session.
    await runOpportunisticResolve();

    // Best-effort retention sweep. Throttled inside to once/day via KV,
    // so re-running cheaply on every boot is fine.
    try {
      runRetentionSweep(new EntriesRepo(db), kv, nowS());
    } catch (err) {
      console.warn("[bootstrapTracking] retention sweep failed:", err);
    }

    // Any entries the background task wrote (or that the synthetic-enter
    // path just opened) need to surface on the UI. A single bump pokes
    // all `useEntries` / `useOngoingEntry` consumers to re-query.
    useDataVersionStore.getState().bumpAll();
  } catch (err) {
    console.warn("[bootstrapTracking] failed:", err);
  }
}

/**
 * Call from every `usePlaces().create/update/remove` so the OS's geofence
 * set stays in lockstep with our source of truth. Returns silently when
 * location permission isn't granted — there's nothing to reconcile.
 */
export async function reconcileAfterPlaceChange(): Promise<void> {
  try {
    const places = new PlacesRepo(getDeviceDb());
    const locStatus = await getLocationStatus();
    if (locStatus !== "granted") return;
    const list = places.list();
    await reconcileGeofences(list);
    const currentPlaceId = await getCurrentPlaceId(list);
    if (currentPlaceId) {
      await dispatchSyntheticEnter(currentPlaceId);
      // A synthetic enter may have opened an ongoing entry — bump so the
      // Timeline's RunningTimerCard picks it up immediately.
      useDataVersionStore.getState().bumpEntries();
    }
  } catch (err) {
    console.warn("[reconcileAfterPlaceChange] failed:", err);
  }
}

/**
 * Wire an AppState listener that re-reconciles geofences when the app
 * becomes active AND location permission is granted. Without this, a
 * permission downgrade ("Always" → "While in use") made in system settings
 * while the app is backgrounded silently stops the tracking until the
 * next cold kill. Returns the AppState subscription so the caller (the
 * root layout) can clean up on unmount.
 */
export function startForegroundReconcileWatcher() {
  let last: AppStateStatus = AppState.currentState;
  return AppState.addEventListener("change", (next) => {
    // Only act on a real inactive/background → active transition. Guard
    // against active → active churn that the OS occasionally emits on iOS.
    const becameActive = last !== "active" && next === "active";
    last = next;
    if (!becameActive) return;
    void (async () => {
      await reconcileAfterPlaceChange();
      // Opportunistic resolve also catches pending transitions that might
      // have elapsed while the JS runtime was suspended.
      await runOpportunisticResolve();
      // Surface any entries that landed while backgrounded.
      useDataVersionStore.getState().bumpAll();
    })();
  });
}
