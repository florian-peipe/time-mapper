import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { createTestDb } from "@/db/testClient";
import { EntriesRepo } from "@/db/repository/entries";
import { PlacesRepo } from "@/db/repository/places";
import { EntriesRepoProvider, useEntries } from "./useEntries";

/**
 * Build a wrapper that provides a test `EntriesRepo`, and pre-seed a single place.
 * Entries use the repo's clock (via `now`) for default startedAt/endedAt; the hook
 * derives the day window from `Date.now()`, so we align them.
 */
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
    // Noon local on an arbitrary day.
    const fixed = new Date(2026, 3, 17, 12, 0, 0).getTime();
    const { entriesRepo, place, wrapper } = setup(fixed);

    // Entry started at 09:00 local today — in window.
    const startMorning = Math.floor(new Date(2026, 3, 17, 9, 0, 0).getTime() / 1000);
    const endMorning = Math.floor(new Date(2026, 3, 17, 10, 0, 0).getTime() / 1000);
    entriesRepo.createManual({ placeId: place.id, startedAt: startMorning, endedAt: endMorning });

    // Entry started yesterday 23:30 — out of window.
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

  it("createManual() writes and refreshes the list", async () => {
    const fixed = new Date(2026, 3, 17, 12, 0, 0).getTime();
    const { place, wrapper } = setup(fixed);
    const { result } = renderHook(() => useEntries(0), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const start = Math.floor(new Date(2026, 3, 17, 7, 0, 0).getTime() / 1000);
    const end = Math.floor(new Date(2026, 3, 17, 8, 0, 0).getTime() / 1000);
    await act(async () => {
      result.current.createManual({ placeId: place.id, startedAt: start, endedAt: end });
    });
    await waitFor(() => expect(result.current.entries.length).toBe(1));
  });

  it("softDelete() removes an entry from the list", async () => {
    const fixed = new Date(2026, 3, 17, 12, 0, 0).getTime();
    const { entriesRepo, place, wrapper } = setup(fixed);
    const start = Math.floor(new Date(2026, 3, 17, 7, 0, 0).getTime() / 1000);
    const end = Math.floor(new Date(2026, 3, 17, 8, 0, 0).getTime() / 1000);
    const created = entriesRepo.createManual({ placeId: place.id, startedAt: start, endedAt: end });

    const { result } = renderHook(() => useEntries(0), { wrapper });
    await waitFor(() => expect(result.current.entries.length).toBe(1));
    await act(async () => {
      result.current.softDelete(created.id);
    });
    await waitFor(() => expect(result.current.entries.length).toBe(0));
  });

  it("restore() brings a soft-deleted entry back into the list", async () => {
    const fixed = new Date(2026, 3, 17, 12, 0, 0).getTime();
    const { entriesRepo, place, wrapper } = setup(fixed);
    const start = Math.floor(new Date(2026, 3, 17, 7, 0, 0).getTime() / 1000);
    const end = Math.floor(new Date(2026, 3, 17, 8, 0, 0).getTime() / 1000);
    const created = entriesRepo.createManual({ placeId: place.id, startedAt: start, endedAt: end });

    const { result } = renderHook(() => useEntries(0), { wrapper });
    await waitFor(() => expect(result.current.entries.length).toBe(1));
    await act(async () => {
      result.current.softDelete(created.id);
    });
    await waitFor(() => expect(result.current.entries.length).toBe(0));
    await act(async () => {
      result.current.restore(created.id);
    });
    await waitFor(() => expect(result.current.entries.length).toBe(1));
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
