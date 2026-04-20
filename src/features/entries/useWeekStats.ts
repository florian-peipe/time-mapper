import { useCallback, useEffect, useMemo, useState } from "react";
import type { Entry, Place } from "@/db/schema";
import { usePlacesRepo } from "@/features/places/usePlaces";
import { useEntriesRepo } from "./useEntries";
import { useDataVersionStore } from "@/state/dataVersionStore";
import { netMinutes } from "@/lib/entries";

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

/** Index 0..6 (Mon..Sun) that `startedAt` (unix s) falls into, or -1 if outside the week. */
function dayIndex(startedAt: number, weekStartSeconds: number): number {
  const diffDays = Math.floor((startedAt - weekStartSeconds) / 86_400);
  if (diffDays < 0 || diffDays >= 7) return -1;
  return diffDays;
}

/**
 * Aggregates the target week's entries by place. `weekOffset === 0` means
 * "this week"; -1 means "last week"; any positive value is clamped to 0
 * (the UI should never let the user request a future week).
 *
 * Reads the `EntriesRepo` and `PlacesRepo` from their respective contexts so
 * tests can inject in-memory repos; production uses the device repos.
 */
export function useWeekStats(weekOffset = 0): UseWeekStatsResult {
  const entriesRepo = useEntriesRepo();
  const placesRepo = usePlacesRepo();

  // Clamp forward direction so callers don't have to.
  const safeOffset = Math.min(weekOffset, 0);

  // Recompute weekStart whenever the offset changes. We anchor to "now" at
  // render time — callers can re-observe by flipping the offset.
  const weekStart = useMemo(() => {
    const base = computeWeekStart(new Date());
    if (safeOffset !== 0) base.setDate(base.getDate() + safeOffset * 7);
    return base;
  }, [safeOffset]);
  const weekStartSeconds = useMemo(() => Math.floor(weekStart.getTime() / 1000), [weekStart]);
  const weekEndSeconds = weekStartSeconds + 7 * 86_400 - 1;

  const entriesVersion = useDataVersionStore((s) => s.entriesVersion);
  const placesVersion = useDataVersionStore((s) => s.placesVersion);

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
  }, [refresh, entriesVersion, placesVersion]);

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
