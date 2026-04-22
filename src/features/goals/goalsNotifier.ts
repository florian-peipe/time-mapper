/**
 * Goal-reached notifications. Extracted from `features/notifications/notifier`
 * because the two concerns have different ownership — open/close notifications
 * are OS-driven plumbing; goal-reached is product logic tied to per-place
 * targets.
 *
 * Dedup is per (kind, placeId, day|week-start) via KV so a user stepping
 * in and out of a place doesn't get spammed.
 */
import type { AnyDb } from "@/db/client";
import type { Place } from "@/db/schema";
import { EntriesRepo } from "@/db/repository/entries";
import type { KvRepo } from "@/db/repository/kv";
import { goalDedupKvKey } from "@/db/kvKeys";
import { formatDurationCompact, DAY_S } from "@/lib/time";
import { isDayInDailyGoal, netSeconds } from "@/lib/entries";
import { i18n } from "@/lib/i18n";

export type GoalFireFn = (title: string, body: string) => Promise<void>;

/**
 * Fire a "goal reached" notification the first time this place crosses
 * its daily or weekly target in the current period. Deduplicated per
 * (kind, placeId, period-start) via KV keys. `fire` is injected so the
 * notifier module can decide whether to route through quiet hours /
 * consolidation — this module only decides IF a goal was met.
 */
export async function maybeNotifyGoalReached(
  place: Place,
  db: AnyDb,
  kv: KvRepo,
  nowS: number,
  fire: GoalFireFn,
): Promise<void> {
  if (place.dailyGoalMinutes == null && place.weeklyGoalMinutes == null) return;

  const entriesRepo = new EntriesRepo(db);
  const now = new Date(nowS * 1000);
  const { dayStart, dayEnd, weekStart, weekEnd } = periodBounds(now);

  if (place.dailyGoalMinutes != null && isDayInDailyGoal(place.dailyGoalDays, now)) {
    const totalMin = totalMinutesForPlace(entriesRepo, place.id, dayStart, dayEnd);
    if (totalMin >= place.dailyGoalMinutes) {
      const key = goalDedupKvKey("day", place.id, dayStart);
      if (kv.get(key) !== "1") {
        await fire(...dailyMessage(place, totalMin));
        kv.set(key, "1");
      }
    }
  }

  if (place.weeklyGoalMinutes != null) {
    const totalMin = totalMinutesForPlace(entriesRepo, place.id, weekStart, weekEnd);
    if (totalMin >= place.weeklyGoalMinutes) {
      const key = goalDedupKvKey("week", place.id, weekStart);
      if (kv.get(key) !== "1") {
        await fire(...weeklyMessage(place, totalMin));
        kv.set(key, "1");
      }
    }
  }
}

function dailyMessage(place: Place, totalMin: number): [string, string] {
  const target = place.dailyGoalMinutes as number;
  const over = totalMin - target;
  const body =
    over > 0
      ? i18n.t("notifier.goal.daily.bodyOver", {
          name: place.name,
          hours: Math.floor(target / 60),
          over: formatDurationCompact(over * 60),
        })
      : i18n.t("notifier.goal.daily.body", {
          name: place.name,
          hours: Math.floor(target / 60),
        });
  return [i18n.t("notifier.goal.daily.title"), body];
}

function weeklyMessage(place: Place, totalMin: number): [string, string] {
  const target = place.weeklyGoalMinutes as number;
  const over = totalMin - target;
  const body =
    over > 0
      ? i18n.t("notifier.goal.weekly.bodyOver", {
          name: place.name,
          hours: Math.floor(target / 60),
          over: formatDurationCompact(over * 60),
        })
      : i18n.t("notifier.goal.weekly.body", {
          name: place.name,
          hours: Math.floor(target / 60),
        });
  return [i18n.t("notifier.goal.weekly.title"), body];
}

function totalMinutesForPlace(
  entriesRepo: EntriesRepo,
  placeId: string,
  fromS: number,
  toS: number,
): number {
  let total = 0;
  for (const e of entriesRepo.listBetween(fromS, toS)) {
    if (e.placeId !== placeId) continue;
    const s = netSeconds(e);
    if (s > 0) total += Math.round(s / 60);
  }
  return total;
}

/**
 * Daily + weekly period bounds for the local-time day containing `now`.
 * Week start = Monday 00:00 local (German convention).
 */
export function periodBounds(now: Date): {
  dayStart: number;
  dayEnd: number;
  weekStart: number;
  weekEnd: number;
} {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  const dayStart = Math.floor(day.getTime() / 1000);
  const dayEnd = dayStart + DAY_S - 1;
  const week = new Date(day);
  const dow = week.getDay();
  const mondayOffset = dow === 0 ? 6 : dow - 1;
  week.setDate(week.getDate() - mondayOffset);
  const weekStart = Math.floor(week.getTime() / 1000);
  const weekEnd = weekStart + 7 * DAY_S - 1;
  return { dayStart, dayEnd, weekStart, weekEnd };
}
