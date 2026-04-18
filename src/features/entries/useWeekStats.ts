import { useCallback, useEffect, useMemo, useState } from "react";
import type { Entry, Place } from "@/db/schema";
import { usePlacesRepo } from "@/features/places/usePlaces";
import { useEntriesRepo } from "./useEntries";

export type PlaceWeekTotal = { name: string; color: string; totalMin: number };
export type DayBuckets = Record<string, number>;

export type UseWeekStatsResult = {
  /** Seven entries, index 0 = Monday .. index 6 = Sunday. Each maps place name → minutes. */
  byDay: DayBuckets[];
  /** Per-place totals for the whole week, sorted by totalMin desc. */
  byPlace: PlaceWeekTotal[];
  /** Raw entries inside the current week, sorted by `startedAt` descending. */
  entries: Entry[];
  /** Monday 00:00 local time of the currently observed week. */
  weekStart: Date;
  loading: boolean;
  refresh: () => void;
};

/**
 * Returns the local-midnight Monday of the week containing `now` (German
 * convention — weeks start Monday). `day === 0` means Sunday, and we subtract
 * 6 days in that case; other days subtract `day - 1`.
 */
function computeWeekStart(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const offset = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - offset);
  return d;
}

/** Net minutes for an entry, clamped to >= 0. Open entries (no endedAt) contribute 0. */
function netMinutes(entry: Entry): number {
  if (entry.endedAt == null) return 0;
  const grossSeconds = entry.endedAt - entry.startedAt;
  const netSeconds = grossSeconds - (entry.pauseS ?? 0);
  if (netSeconds <= 0) return 0;
  return Math.round(netSeconds / 60);
}

/** Index 0..6 (Mon..Sun) that `startedAt` (unix s) falls into, or -1 if outside the week. */
function dayIndex(startedAt: number, weekStartSeconds: number): number {
  const diffDays = Math.floor((startedAt - weekStartSeconds) / 86_400);
  if (diffDays < 0 || diffDays >= 7) return -1;
  return diffDays;
}

/**
 * Aggregates the current week's entries by place, returning both a per-day
 * breakdown (for stacked bar charts) and a per-place total (for a legend).
 * Reads the `EntriesRepo` and `PlacesRepo` from their respective contexts so
 * tests can inject in-memory repos; production uses the device repos.
 */
export function useWeekStats(): UseWeekStatsResult {
  const entriesRepo = useEntriesRepo();
  const placesRepo = usePlacesRepo();

  // Capture weekStart once per mount. The hook is expected to live for the
  // duration of the user viewing the Stats screen — changing weeks is a
  // navigation operation, not a state update inside this hook (Plan 2 does not
  // expose a "pick another week" UI yet — that's Pro-gated, Plan 3+).
  const weekStart = useMemo(() => computeWeekStart(new Date()), []);
  const weekStartSeconds = useMemo(() => Math.floor(weekStart.getTime() / 1000), [weekStart]);
  const weekEndSeconds = weekStartSeconds + 7 * 86_400 - 1;

  const [byDay, setByDay] = useState<DayBuckets[]>(() => emptyWeek());
  const [byPlace, setByPlace] = useState<PlaceWeekTotal[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    // `listBetween` already returns results ordered by `startedAt DESC` — we
    // surface the raw array for the Ledger while still computing aggregates.
    const weekEntries = entriesRepo.listBetween(weekStartSeconds, weekEndSeconds);
    const placeIndex = indexPlacesById(placesRepo.list());

    const days: DayBuckets[] = emptyWeek();
    const totals = new Map<string, { name: string; color: string; totalMin: number }>();

    for (const e of weekEntries) {
      const minutes = netMinutes(e);
      if (minutes <= 0) continue;
      const idx = dayIndex(e.startedAt, weekStartSeconds);
      if (idx < 0) continue;

      const place = placeIndex.get(e.placeId);
      // If an entry references a place that was hard-deleted we skip it — soft
      // deletes still show up in `list()` only while not deleted, so we treat
      // missing metadata as a bug rather than silently using a placeholder.
      if (!place) continue;

      const bucket = days[idx];
      if (!bucket) continue;
      bucket[place.name] = (bucket[place.name] ?? 0) + minutes;

      const existing = totals.get(place.id);
      if (existing) {
        existing.totalMin += minutes;
      } else {
        totals.set(place.id, { name: place.name, color: place.color, totalMin: minutes });
      }
    }

    setByDay(days);
    setByPlace([...totals.values()].sort((a, b) => b.totalMin - a.totalMin));
    setEntries(weekEntries);
  }, [entriesRepo, placesRepo, weekStartSeconds, weekEndSeconds]);

  useEffect(() => {
    refresh();
    setLoading(false);
  }, [refresh]);

  return { byDay, byPlace, entries, weekStart, loading, refresh };
}

function emptyWeek(): DayBuckets[] {
  return Array.from({ length: 7 }, () => ({}));
}

function indexPlacesById(places: Place[]): Map<string, Place> {
  const map = new Map<string, Place>();
  for (const p of places) map.set(p.id, p);
  return map;
}
