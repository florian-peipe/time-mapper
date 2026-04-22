import * as Location from "expo-location";
import type { Place } from "@/db/schema";
import { haversineMeters } from "@/lib/geo";
import { captureException } from "@/lib/crash";

/**
 * Canonical TaskManager identifier. Must match the one registered in
 * `src/background/tasks.ts` — this string is what `expo-task-manager`
 * dispatches geofence events to. Also appears in app.json under
 * `BGTaskSchedulerPermittedIdentifiers`.
 */
export const TASK_NAME = "com.timemapper.app.geofence";

/** Soft cap per iOS's 20-region limit. Enforced at the UI layer. */
export const MAX_PLACES = 20;

/**
 * Build the array of regions `expo-location` expects. The `identifier` field
 * must be the place id so the background task can look it up on wake.
 */
function toRegions(places: Place[]): Location.LocationRegion[] {
  return places.map((p) => ({
    identifier: p.id,
    latitude: p.latitude,
    longitude: p.longitude,
    radius: p.radiusM,
    notifyOnEnter: true,
    notifyOnExit: true,
  }));
}

/**
 * Register (or replace) the full geofence set on the OS. iOS only accepts
 * an all-at-once replacement — there is no "add one region" API — so this
 * always sends the complete list. Callers: `bootstrapTracking` at app start,
 * and `usePlaces.create/update/remove` on place mutations.
 *
 * If the underlying task isn't defined yet this throws — defineTask in
 * `src/background/tasks.ts` must be imported before the first call.
 */
export async function registerPlaceGeofences(places: Place[]): Promise<void> {
  if (places.length === 0) {
    await unregisterAllGeofences();
    return;
  }
  const regions = toRegions(places.slice(0, MAX_PLACES));
  await Location.startGeofencingAsync(TASK_NAME, regions);
}

/** Stop geofencing entirely (e.g. user deleted their last place). */
export async function unregisterAllGeofences(): Promise<void> {
  const started = await Location.hasStartedGeofencingAsync(TASK_NAME);
  if (!started) return;
  await Location.stopGeofencingAsync(TASK_NAME);
}

/**
 * Reconcile the OS's current geofence set against our source of truth.
 * Always replaces — we can't introspect what the OS currently holds, and the
 * cost of replacement is cheap. The OS will silently drop regions after
 * reboot; this is how we recover.
 *
 * Retries up to 3× with exponential backoff (0.5s, 1s, 2s) — iOS occasionally
 * rejects `startGeofencingAsync` when Location Services are briefly paused
 * (app-switcher swipe, Low Power Mode transitions). The retry covers those
 * transient windows. A final failure bubbles to Sentry via `captureException`
 * so the owner can spot a real regression instead of a silent drop.
 */
export async function reconcileGeofences(places: Place[]): Promise<void> {
  await withRetry(() => registerPlaceGeofences(places), { maxAttempts: 3, baseDelayMs: 500 });
}

async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts: number; baseDelayMs: number },
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === opts.maxAttempts - 1) break;
      const delay = opts.baseDelayMs * 2 ** attempt;
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
    }
  }
  captureException(lastErr, { scope: "geofenceReconcile", maxAttempts: opts.maxAttempts });
  throw lastErr;
}

/**
 * Given a raw `Location.LocationObject`, figure out which place (if any)
 * contains it. Used on wake as a fallback when the OS missed an ENTER /
 * EXIT event: we can still derive "inside X" from the current coordinate.
 *
 * Simple haversine + radius check — at 20 places this is cheap enough to
 * run inline, no spatial index needed.
 */
export function placeContaining(
  location: Pick<Location.LocationObject, "coords">,
  places: Place[],
): Place | null {
  for (const p of places) {
    const dM = haversineMeters(
      location.coords.latitude,
      location.coords.longitude,
      p.latitude,
      p.longitude,
    );
    if (dM <= p.radiusM) return p;
  }
  return null;
}

/**
 * Fetch the device's current position and resolve which place (if any) the
 * user is inside. Returns null if location is unavailable, permissions
 * denied, or the user isn't inside any place. Never throws — background
 * code cannot afford to crash the task.
 *
 * Tries for a fresh fix first (5s cap, `Balanced` accuracy) so the typical
 * "user just added a place at their home address" path works even when
 * the last-known cache is empty (common immediately after first install).
 * Falls back to last-known if the fresh fix doesn't land in time.
 */
export async function getCurrentPlaceId(places: Place[]): Promise<string | null> {
  try {
    const loc = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5_000)),
    ]);
    const fix = loc ?? (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 }));
    if (!fix) return null;
    return placeContaining(fix, places)?.id ?? null;
  } catch {
    return null;
  }
}
