import type { Entry } from "@/db/schema";

/**
 * Net minutes (gross − pause) for an entry, clamped to >= 0. Open
 * entries (no `endedAt`) contribute 0 — the Timeline + Stats treat
 * the running timer card as the source of truth for ongoing time.
 */
export function netMinutes(entry: Entry): number {
  if (entry.endedAt == null) return 0;
  const seconds = entry.endedAt - entry.startedAt - (entry.pauseS ?? 0);
  if (seconds <= 0) return 0;
  return Math.round(seconds / 60);
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
 * True when `date`'s day-of-week is in the `dailyGoalDays` filter.
 * `null` / empty string = "every day" (the default before the filter
 * was introduced, so existing places keep their prior behavior).
 *
 * `dailyGoalDays` is a comma-separated list of ISO day numbers
 * (1..7). Whitespace + duplicates are tolerated.
 */
export function isDayInDailyGoal(dailyGoalDays: string | null | undefined, date: Date): boolean {
  if (!dailyGoalDays || dailyGoalDays.trim().length === 0) return true;
  const iso = isoDayOfWeek(date);
  return dailyGoalDays
    .split(",")
    .map((s) => Number(s.trim()))
    .some((d) => d === iso);
}
