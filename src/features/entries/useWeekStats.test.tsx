import React from "react";
import { renderHook, waitFor } from "@testing-library/react-native";
import { createTestDb } from "@/db/testClient";
import { EntriesRepo } from "@/db/repository/entries";
import { PlacesRepo } from "@/db/repository/places";
import { PlacesRepoProvider } from "@/features/places/usePlaces";
import { EntriesRepoProvider } from "./useEntries";
import { useWeekStats } from "./useWeekStats";

/** Midnight of the given local date as unix seconds. */
function startOfDaySeconds(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function setup(fixedMs: number) {
  jest.useFakeTimers().setSystemTime(new Date(fixedMs));
  const db = createTestDb();
  const fixedSeconds = Math.floor(fixedMs / 1000);
  const clock = { now: () => fixedSeconds };
  const placesRepo = new PlacesRepo(db, clock);
  const entriesRepo = new EntriesRepo(db, clock);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <PlacesRepoProvider value={placesRepo}>
      <EntriesRepoProvider value={entriesRepo}>{children}</EntriesRepoProvider>
    </PlacesRepoProvider>
  );
  return { placesRepo, entriesRepo, wrapper };
}

afterEach(() => {
  jest.useRealTimers();
});

describe("useWeekStats", () => {
  it("returns empty aggregates for an empty week", async () => {
    // Wednesday 2026-04-15 12:00 local.
    const fixed = new Date(2026, 3, 15, 12, 0, 0).getTime();
    const { wrapper } = setup(fixed);
    const { result } = renderHook(() => useWeekStats(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.byPlace).toEqual([]);
    expect(result.current.byDay).toHaveLength(7);
    for (const day of result.current.byDay) expect(day).toEqual({});
  });

  it("weekStart is the most recent Monday midnight (German convention)", async () => {
    // Wed 2026-04-15 -> Mon 2026-04-13
    const fixed = new Date(2026, 3, 15, 12, 0, 0).getTime();
    const { wrapper } = setup(fixed);
    const { result } = renderHook(() => useWeekStats(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const expected = new Date(2026, 3, 13, 0, 0, 0);
    expect(result.current.weekStart.getTime()).toBe(expected.getTime());
  });

  it("on a Sunday, weekStart is the previous Monday", async () => {
    // Sun 2026-04-19 10:00 -> Mon 2026-04-13
    const fixed = new Date(2026, 3, 19, 10, 0, 0).getTime();
    const { wrapper } = setup(fixed);
    const { result } = renderHook(() => useWeekStats(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const expected = new Date(2026, 3, 13, 0, 0, 0);
    expect(result.current.weekStart.getTime()).toBe(expected.getTime());
  });

  it("on a Monday, weekStart is that same Monday", async () => {
    // Mon 2026-04-13 08:00
    const fixed = new Date(2026, 3, 13, 8, 0, 0).getTime();
    const { wrapper } = setup(fixed);
    const { result } = renderHook(() => useWeekStats(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const expected = new Date(2026, 3, 13, 0, 0, 0);
    expect(result.current.weekStart.getTime()).toBe(expected.getTime());
  });

  it("aggregates entries by place for the week, accounting for pauses", async () => {
    // Wed 2026-04-15 12:00 -> week of Mon 13 .. Sun 19
    const fixed = new Date(2026, 3, 15, 12, 0, 0).getTime();
    const { placesRepo, entriesRepo, wrapper } = setup(fixed);
    const work = placesRepo.create({
      name: "Work",
      address: "",
      latitude: 0,
      longitude: 0,
      color: "#1D7FD1",
    });
    const home = placesRepo.create({
      name: "Home",
      address: "",
      latitude: 0,
      longitude: 0,
      color: "#2E9A5E",
    });

    // Mon 2026-04-13: Work 09:00–10:00 (60 min gross, 0 pause -> 60 net)
    entriesRepo.createManual({
      placeId: work.id,
      startedAt: startOfDaySeconds(new Date(2026, 3, 13)) + 9 * 3600,
      endedAt: startOfDaySeconds(new Date(2026, 3, 13)) + 10 * 3600,
    });
    // Wed 2026-04-15: Work 09:00–11:00 with 15 min pause -> 105 net
    entriesRepo.createManual({
      placeId: work.id,
      startedAt: startOfDaySeconds(new Date(2026, 3, 15)) + 9 * 3600,
      endedAt: startOfDaySeconds(new Date(2026, 3, 15)) + 11 * 3600,
      pauseS: 15 * 60,
    });
    // Wed 2026-04-15: Home 20:00–21:00 -> 60 net
    entriesRepo.createManual({
      placeId: home.id,
      startedAt: startOfDaySeconds(new Date(2026, 3, 15)) + 20 * 3600,
      endedAt: startOfDaySeconds(new Date(2026, 3, 15)) + 21 * 3600,
    });
    // Sun 2026-04-19 (still inside the week): Home 10:00–10:30 -> 30 net
    entriesRepo.createManual({
      placeId: home.id,
      startedAt: startOfDaySeconds(new Date(2026, 3, 19)) + 10 * 3600,
      endedAt: startOfDaySeconds(new Date(2026, 3, 19)) + 10 * 3600 + 30 * 60,
    });
    // Previous Sunday 2026-04-12 — OUTSIDE the week, must be ignored.
    entriesRepo.createManual({
      placeId: work.id,
      startedAt: startOfDaySeconds(new Date(2026, 3, 12)) + 12 * 3600,
      endedAt: startOfDaySeconds(new Date(2026, 3, 12)) + 14 * 3600,
    });

    const { result } = renderHook(() => useWeekStats(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // byDay: 7 entries, Mon..Sun
    expect(result.current.byDay).toHaveLength(7);
    expect(result.current.byDay[0]).toEqual({ Work: 60 }); // Monday
    expect(result.current.byDay[1]).toEqual({}); // Tuesday
    expect(result.current.byDay[2]).toEqual({ Work: 105, Home: 60 }); // Wednesday
    expect(result.current.byDay[3]).toEqual({}); // Thursday
    expect(result.current.byDay[4]).toEqual({}); // Friday
    expect(result.current.byDay[5]).toEqual({}); // Saturday
    expect(result.current.byDay[6]).toEqual({ Home: 30 }); // Sunday

    // byPlace totals (sorted by totalMin desc)
    const byPlaceByName: Record<string, { name: string; color: string; totalMin: number }> = {};
    for (const p of result.current.byPlace) byPlaceByName[p.name] = p;
    expect(byPlaceByName.Work).toEqual({ name: "Work", color: "#1D7FD1", totalMin: 165 });
    expect(byPlaceByName.Home).toEqual({ name: "Home", color: "#2E9A5E", totalMin: 90 });
    // Sorted most-total-first
    expect(result.current.byPlace.map((p) => p.name)).toEqual(["Work", "Home"]);
  });

  it("clamps net minutes to 0 when pause exceeds gross duration", async () => {
    const fixed = new Date(2026, 3, 15, 12, 0, 0).getTime();
    const { placesRepo, entriesRepo, wrapper } = setup(fixed);
    const work = placesRepo.create({ name: "Work", address: "", latitude: 0, longitude: 0 });
    // 30 min gross, 60 min pause (defensive data).
    entriesRepo.createManual({
      placeId: work.id,
      startedAt: startOfDaySeconds(new Date(2026, 3, 15)) + 9 * 3600,
      endedAt: startOfDaySeconds(new Date(2026, 3, 15)) + 9 * 3600 + 30 * 60,
      pauseS: 60 * 60,
    });

    const { result } = renderHook(() => useWeekStats(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.byDay[2]).toEqual({});
    expect(result.current.byPlace).toEqual([]);
  });
});
