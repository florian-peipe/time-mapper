import { AppState, type AppStateStatus } from "react-native";
import type * as DbClientModule from "@/db/client";
import { PlacesRepo } from "@/db/repository/places";
import { KvRepo } from "@/db/repository/kv";
import { reconcileGeofences } from "./geofenceService";
import { getLocationStatus } from "@/features/permissions";
import { configureNotificationChannels } from "@/features/notifications/notifier";
import { runOpportunisticResolve } from "@/background/tasks";

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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { db } = require("@/db/client") as typeof DbClientModule;
    const places = new PlacesRepo(db);
    const kv = new KvRepo(db);

    await configureNotificationChannels(kv);

    const locStatus = await getLocationStatus();
    if (locStatus === "granted") {
      await reconcileGeofences(places.list());
    }

    // Always run opportunistic resolve — it's cheap and catches up any
    // pending transition left behind from a previous session.
    await runOpportunisticResolve();
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { db } = require("@/db/client") as typeof DbClientModule;
    const places = new PlacesRepo(db);
    const locStatus = await getLocationStatus();
    if (locStatus === "granted") {
      await reconcileGeofences(places.list());
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
    void reconcileAfterPlaceChange();
    // Opportunistic resolve also catches pending transitions that might
    // have elapsed while the JS runtime was suspended.
    void runOpportunisticResolve();
  });
}
