import React from "react";
import { renderHook, waitFor } from "@testing-library/react-native";
import { createTestDb } from "@/db/testClient";
import { EntriesRepo } from "@/db/repository/entries";
import { PlacesRepo } from "@/db/repository/places";
import { EntriesRepoProvider, useEntries } from "./useEntries";

function setup(fixedMs: number) {
  const fixedSeconds = Math.floor(fixedMs / 1000);
  jest.useFakeTimers().setSystemTime(new Date(fixedMs));
  const db = createTestDb();
  const placesRepo = new PlacesRepo(db, { now: () => fixedSeconds });
  const entriesRepo = new EntriesRepo(db, { now: () => fixedSeconds });
  const place = placesRepo.create({ name: "Work", address: "", latitude: 0, longitude: 0 });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <EntriesRepoProvider value={entriesRepo}>{children}</EntriesRepoProvider>
  );
  return { entriesRepo, place, wrapper };
}

afterEach(() => {
  jest.useRealTimers();
});

describe("useEntries", () => {
  it("returns entries whose startedAt falls within today's local window", async () => {
    const fixed = new Date(2026, 3, 17, 12, 0, 0).getTime();
    const { entriesRepo, place, wrapper } = setup(fixed);

    const startMorning = Math.floor(new Date(2026, 3, 17, 9, 0, 0).getTime() / 1000);
    const endMorning = Math.floor(new Date(2026, 3, 17, 10, 0, 0).getTime() / 1000);
    entriesRepo.createManual({ placeId: place.id, startedAt: startMorning, endedAt: endMorning });

    const startYesterday = Math.floor(new Date(2026, 3, 16, 23, 30, 0).getTime() / 1000);
    const endYesterday = Math.floor(new Date(2026, 3, 17, 0, 15, 0).getTime() / 1000);
    entriesRepo.createManual({
      placeId: place.id,
      startedAt: startYesterday,
      endedAt: endYesterday,
    });

    const { result } = renderHook(() => useEntries(0), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]?.startedAt).toBe(startMorning);
  });

  it("supports negative dayOffset (yesterday)", async () => {
    const fixed = new Date(2026, 3, 17, 12, 0, 0).getTime();
    const { entriesRepo, place, wrapper } = setup(fixed);

    const yesterdayStart = Math.floor(new Date(2026, 3, 16, 8, 0, 0).getTime() / 1000);
    const yesterdayEnd = Math.floor(new Date(2026, 3, 16, 9, 0, 0).getTime() / 1000);
    entriesRepo.createManual({
      placeId: place.id,
      startedAt: yesterdayStart,
      endedAt: yesterdayEnd,
    });

    const { result } = renderHook(() => useEntries(-1), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]?.startedAt).toBe(yesterdayStart);
  });

  it("refetches when dayOffset changes", async () => {
    const fixed = new Date(2026, 3, 17, 12, 0, 0).getTime();
    const { entriesRepo, place, wrapper } = setup(fixed);
    const yesterdayStart = Math.floor(new Date(2026, 3, 16, 8, 0, 0).getTime() / 1000);
    const yesterdayEnd = Math.floor(new Date(2026, 3, 16, 9, 0, 0).getTime() / 1000);
    entriesRepo.createManual({
      placeId: place.id,
      startedAt: yesterdayStart,
      endedAt: yesterdayEnd,
    });

    const { result, rerender } = renderHook(
      ({ offset }: { offset: number }) => useEntries(offset),
      { wrapper, initialProps: { offset: 0 } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toHaveLength(0);
    rerender({ offset: -1 });
    await waitFor(() => expect(result.current.entries.length).toBe(1));
  });
});
