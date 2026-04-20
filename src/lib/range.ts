export type RangeMode = "day" | "week" | "month" | "year";

/** Forward cycle used on tap in DayNavHeader; long-press iterates backward. */
export const MODES: readonly RangeMode[] = ["day", "week", "month", "year"] as const;

/** Approximate days-per-period for the free-tier history gate. */
export const PERIOD_DAYS: Record<RangeMode, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

/**
 * Translate `(mode, offset)` into a `[startS, endS]` unix-second window
 * (inclusive on both ends — the `-1s` at the high end excludes the
 * following period's midnight boundary).
 *
 *   day:   local midnight of target day     → +24h
 *   week:  local Monday of target week      → +7d
 *   month: first of target month            → +1 month
 *   year:  Jan 1 of target year             → +1 year
 *
 * Pure: no hooks, no globals, only `Date` setters. Shared between the
 * Timeline and Stats screens so both surfaces compute identical windows
 * for the same (mode, offset).
 */
export function rangeForMode(mode: RangeMode, offset: number): { startS: number; endS: number } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);

  switch (mode) {
    case "day": {
      start.setDate(start.getDate() + offset);
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 1);
      break;
    }
    case "week": {
      const day = start.getDay();
      const mondayOffset = day === 0 ? 6 : day - 1;
      start.setDate(start.getDate() - mondayOffset + offset * 7);
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 7);
      break;
    }
    case "month": {
      start.setDate(1);
      start.setMonth(start.getMonth() + offset);
      end.setTime(start.getTime());
      end.setMonth(end.getMonth() + 1);
      break;
    }
    case "year": {
      start.setMonth(0, 1);
      start.setFullYear(start.getFullYear() + offset);
      end.setTime(start.getTime());
      end.setFullYear(end.getFullYear() + 1);
      break;
    }
  }

  return {
    startS: Math.floor(start.getTime() / 1000),
    endS: Math.floor(end.getTime() / 1000) - 1,
  };
}
