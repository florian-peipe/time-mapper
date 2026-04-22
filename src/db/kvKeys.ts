/**
 * Central registry of every KV key the app reads or writes. Keep the
 * registry exhaustive — new KV keys should be added here first. Two
 * benefits of the single source:
 *
 *   1. Discovery — a newcomer can see the full set of durable flags
 *      in one file.
 *   2. Collision prevention — namespaced strings are easy to typo; one
 *      constant per key makes conflicts syntactically impossible.
 *
 * Not all historical keys have moved here yet; modules owning their
 * own `KV_FOO` constants should re-export from this registry over time.
 *
 * KV values are stringly-encoded (the underlying `kv` table stores TEXT).
 * The `Kind` comment on each key documents how callers are expected to
 * encode: `"1"`-flag, unix-seconds integer, JSON blob, etc. Callers do
 * the encoding — this file is only naming.
 */
export const KV_KEYS = {
  // Onboarding
  /** "1" once the user finishes onboarding. */
  ONBOARDING_COMPLETE: "onboarding.complete",

  // UI overrides
  /** "light" | "dark" — null (absent) means "follow system". */
  UI_THEME_OVERRIDE: "ui.themeOverride",
  /** "en" | "de" — null (absent) means "follow system". */
  UI_LOCALE_OVERRIDE: "ui.localeOverride",

  // Notifier (fire-and-forget consolidation, quiet hours, digest)
  /** JSON `number[]` — ring buffer of recent notification timestamps. */
  NOTIFIER_RECENT: "notifier.recent",
  /** JSON `{ startH: number; endH: number }` — null (absent) means no quiet hours. */
  NOTIFIER_QUIET_HOURS: "notifier.quiet_hours",
  /** "1" once Android notification channels have been configured. */
  NOTIFIER_CHANNELS_CONFIGURED: "notifier.channels_configured",
  /** "1" when the daily digest is enabled. */
  NOTIFIER_DIGEST_ENABLED: "notifier.digest.enabled",
  /** Integer hour (0..23) the digest fires. */
  NOTIFIER_DIGEST_HOUR: "notifier.digest.hour",
  /** The OS-assigned ID of the currently scheduled digest (if any). */
  NOTIFIER_DIGEST_ID: "notifier.digest.scheduled_id",

  // Tracking-health
  /** Unix-seconds of the last bg-task fire. Drives the Timeline's health banner. */
  TRACKING_LAST_BG_FIRE: "tracking.last_bg_fire",

  // Global buffers (AddPlaceSheet defaults)
  /** Integer seconds — default entry buffer for newly-created places. */
  GLOBAL_ENTRY_BUFFER_S: "global.buffers.entry_s",
  /** Integer seconds — default exit buffer for newly-created places. */
  GLOBAL_EXIT_BUFFER_S: "global.buffers.exit_s",

  // Diagnostics
  /** JSON `Counters` map — best-effort funnel tallies. */
  DIAGNOSTICS_COUNTERS: "diagnostics.counters",
  /** "1" when the user has opted into telemetry (Sentry + any future pings). */
  TELEMETRY_ENABLED: "settings.telemetry_enabled",

  // Billing
  /** The anonymous RC user-id minted on first launch. Never rename. */
  REVENUECAT_USER_ID: "revenuecat.user_id",
} as const;

export type KvKey = (typeof KV_KEYS)[keyof typeof KV_KEYS];

/**
 * Build the per-place, per-day goal-dedup key. Separate from the static
 * registry because the placeId + date are dynamic. Kept here for proximity.
 *
 *   notifier.goal.day.<placeId>.YYYY-MM-DD
 *   notifier.goal.week.<placeId>.YYYY-MM-DD   (Monday-of-week)
 */
export function goalDedupKvKey(
  kind: "day" | "week",
  placeId: string,
  periodStartS: number,
): string {
  const d = new Date(periodStartS * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `notifier.goal.${kind}.${placeId}.${y}-${m}-${dd}`;
}
