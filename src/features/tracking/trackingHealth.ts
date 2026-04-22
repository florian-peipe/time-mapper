import type * as KvModule from "@/db/repository/kv";
import { KV_KEYS } from "@/db/kvKeys";

type KvRepo = InstanceType<typeof KvModule.KvRepo>;

/**
 * Last wall-clock time the background task fired, in unix seconds. Updated
 * by `handleGeofencingEvent` on every wake, regardless of whether the event
 * produced any state-machine effects. Used by `getTrackingHealth` to
 * decide if tracking is "alive" (the OS has been invoking us recently) or
 * "stopped" (the OS hasn't called in a long time).
 */
export const KV_LAST_BG_FIRE = KV_KEYS.TRACKING_LAST_BG_FIRE;

/**
 * Mark a background task fire. Idempotent write.
 */
export function recordBgFire(kv: KvRepo, nowS: number): void {
  kv.set(KV_LAST_BG_FIRE, String(nowS));
}

/** Read the recorded timestamp, or null if never set. */
export function readLastBgFire(kv: KvRepo): number | null {
  const raw = kv.get(KV_LAST_BG_FIRE);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export type TrackingHealthLevel = "healthy" | "degraded" | "stopped" | "unknown";

export type TrackingHealthInput = {
  locationStatus: "granted" | "foreground-only" | "denied" | "unknown";
  lastBgFireAtS: number | null;
  nowS: number;
  placesCount: number;
};

/**
 * Derive an at-a-glance health level from permission state + the last
 * background-task fire. Thresholds are heuristic but conservative:
 *   - No places → "unknown" (nothing to track yet; not an error).
 *   - Location granted "Always" → "healthy" UNLESS the bg task hasn't fired
 *     in 48h (then "degraded" — OEM battery optimizer likely killed it).
 *   - Location foreground-only or denied → "degraded" (auto-tracking blocked,
 *     user can still add manual entries).
 *   - Location never granted + >72h since any bg fire → "stopped".
 *
 * Notifications-off alone doesn't downgrade — the app still tracks, the
 * user just won't hear about it.
 */
export function classifyTrackingHealth(input: TrackingHealthInput): TrackingHealthLevel {
  const { locationStatus, lastBgFireAtS, nowS, placesCount } = input;
  if (placesCount === 0) return "unknown";
  if (locationStatus === "denied") return "stopped";
  if (locationStatus === "foreground-only") return "degraded";
  if (locationStatus === "unknown") return "unknown";

  // granted — check staleness
  if (lastBgFireAtS == null) {
    // Never fired — app probably fresh; no signal either way. Staying
    // conservative to avoid a false "something's wrong" banner.
    return "healthy";
  }
  const ageS = nowS - lastBgFireAtS;
  if (ageS < 48 * 3600) return "healthy";
  if (ageS < 72 * 3600) return "degraded";
  return "stopped";
}
