import type { Entry, Place } from "@/db/schema";
import { i18n } from "@/lib/i18n";
import { isDayInDailyGoal } from "@/lib/entries";
import type { RangeMode } from "@/lib/range";

/**
 * Total tracked minutes + ordered per-place totals for the current window.
 * Ongoing entries (null endedAt) contribute 0 — they still render in the
 * list below via EntryRow, they just don't skew the aggregate.
 */
export function aggregate(
  entries: Entry[],
  placesById: Map<string, Place>,
): {
  totalMin: number;
  perPlace: { place: Place; minutes: number }[];
} {
  const totals = new Map<string, number>();
  let totalMin = 0;
  for (const e of entries) {
    if (e.endedAt == null) continue;
    const seconds = e.endedAt - e.startedAt - (e.pauseS ?? 0);
    if (seconds <= 0) continue;
    const mins = Math.round(seconds / 60);
    totalMin += mins;
    totals.set(e.placeId, (totals.get(e.placeId) ?? 0) + mins);
  }
  const perPlace: { place: Place; minutes: number }[] = [];
  for (const [id, minutes] of totals) {
    const place = placesById.get(id);
    if (!place) continue;
    perPlace.push({ place, minutes });
  }
  perPlace.sort((a, b) => b.minutes - a.minutes);
  return { totalMin, perPlace };
}

/**
 * Pick the relevant goal for the current aggregation. Day view → daily
 * goal. Week view → weekly goal. Month / year → weekly goal scaled up
 * (simplistic but useful: "month of 40h/week" = 4 × 40 = 160h target).
 */
export function pickGoal(place: Place, mode: RangeMode, viewedDate: Date): number | null {
  if (mode === "day") {
    if (place.dailyGoalMinutes == null) return null;
    // Respect the per-day filter: if the viewed day isn't active for
    // this goal, the bar renders without the goal overlay.
    if (!isDayInDailyGoal(place.dailyGoalDays, viewedDate)) return null;
    return place.dailyGoalMinutes;
  }
  if (place.weeklyGoalMinutes == null) return null;
  if (mode === "week") return place.weeklyGoalMinutes;
  // Rough month/year scaling so the same weekly target still reads as
  // "on/off pace". Month = 4.33 weeks; year = 52 weeks.
  if (mode === "month") return Math.round(place.weeklyGoalMinutes * 4.33);
  return place.weeklyGoalMinutes * 52;
}

export function formatGoalDelta(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return i18n.t("stats.summary.rowMinutes", { m });
  return i18n.t("stats.summary.rowHM", { h, m });
}
