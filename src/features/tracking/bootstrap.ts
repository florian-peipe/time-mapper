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
