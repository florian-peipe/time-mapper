import type { Entry, Place } from "@/db/schema";

/**
 * Net seconds (gross − pause) for an entry, clamped to >= 0. Open
 * entries (no `endedAt`) contribute 0 — the Timeline + Stats treat
 * the running timer card as the source of truth for ongoing time.
 */
export function netSeconds(entry: Entry): number {
  if (entry.endedAt == null) return 0;
  const seconds = entry.endedAt - entry.startedAt - (entry.pauseS ?? 0);
  return seconds > 0 ? seconds : 0;
}

/** Net minutes — thin rounding wrapper around {@link netSeconds}. */
export function netMinutes(entry: Entry): number {
  return Math.round(netSeconds(entry) / 60);
}

/** Build a `Map<id, Place>` for O(1) lookup inside entry-rendering loops. */
export function indexPlacesById(places: Place[]): Map<string, Place> {
  const map = new Map<string, Place>();
  for (const p of places) map.set(p.id, p);
  return map;
}

/**
 * ISO day-of-week number (1 = Monday … 7 = Sunday). JavaScript `Date`
 * returns 0 = Sunday so we rotate: `Sun` (0 → 7), `Mon` (1 → 1), …
 */
export function isoDayOfWeek(date: Date): number {
  const js = date.getDay();
  return js === 0 ? 7 : js;
}

/**
 * Parse the `dailyGoalDays` CSV string ("1,3,5") into a sorted array of
 * ISO day numbers. Empty / null input returns `[]` (= every day).
 */
export function parseGoalDays(raw: string | null | undefined): number[] {
  if (!raw || raw.trim().length === 0) return [];
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
    .sort((a, b) => a - b);
}

/**
 * Serialize a day-number array back to the `dailyGoalDays` CSV format.
 * Returns `null` when the selection means "every day" (empty or all 7 days).
 */
export function serializeGoalDays(enabled: boolean, days: number[]): string | null {
  if (!enabled || days.length === 0 || days.length >= 7) return null;
  return days
    .slice()
    .sort((a, b) => a - b)
    .join(",");
}

/**
 * True when `date`'s day-of-week is in the `dailyGoalDays` filter.
 * `null` / empty string = "every day" (the default before the filter
 * was introduced, so existing places keep their prior behavior).
 */
export function isDayInDailyGoal(dailyGoalDays: string | null | undefined, date: Date): boolean {
  if (!dailyGoalDays || dailyGoalDays.trim().length === 0) return true;
  const iso = isoDayOfWeek(date);
  return parseGoalDays(dailyGoalDays).some((d) => d === iso);
}
