import * as Location from "expo-location";
import type { Place } from "@/db/schema";

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
 */
export async function reconcileGeofences(places: Place[]): Promise<void> {
  await registerPlaceGeofences(places);
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
 */
export async function getCurrentPlaceId(places: Place[]): Promise<string | null> {
  try {
    const loc = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
    if (!loc) return null;
    return placeContaining(loc, places)?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Great-circle distance in meters. Standard haversine formula.
 * Lifted into module scope so it's unit-testable and the geofence check
 * loop doesn't re-declare it on every iteration.
 */
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Exported for tests.
export const __internals = { haversineMeters, toRegions };
