import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { createTestDb } from "@/db/testClient";
import { EntriesRepo } from "@/db/repository/entries";
import { PlacesRepo } from "@/db/repository/places";
import { EntriesRepoProvider } from "./useEntries";
import { useOngoingEntry } from "./useOngoingEntry";

function setup() {
  const db = createTestDb();
  let now = 1_700_000_000;
  const clock = { now: () => now };
  const placesRepo = new PlacesRepo(db, clock);
  const entriesRepo = new EntriesRepo(db, clock);
  const place = placesRepo.create({ name: "Work", address: "", latitude: 0, longitude: 0 });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <EntriesRepoProvider value={entriesRepo}>{children}</EntriesRepoProvider>
  );
  return {
    entriesRepo,
    place,
    wrapper,
    advance: (s: number) => {
      now += s;
    },
  };
}

describe("useOngoingEntry", () => {
  it("returns null when there is no open entry", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useOngoingEntry(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entry).toBeNull();
  });

  it("reflects an open entry after refresh()", async () => {
    const { entriesRepo, place, wrapper } = setup();
    const { result } = renderHook(() => useOngoingEntry(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    entriesRepo.open({ placeId: place.id, source: "auto" });
    await act(async () => {
      result.current.refresh();
    });
    await waitFor(() => expect(result.current.entry?.placeId).toBe(place.id));
  });

  it("start() opens an entry and exposes it reactively", async () => {
    const { place, wrapper } = setup();
    const { result } = renderHook(() => useOngoingEntry(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      result.current.start({ placeId: place.id, source: "manual" });
    });
    await waitFor(() => expect(result.current.entry).not.toBeNull());
    expect(result.current.entry?.source).toBe("manual");
    expect(result.current.entry?.endedAt).toBeNull();
  });

  it("stop() closes the ongoing entry and clears state", async () => {
    const { entriesRepo, place, wrapper, advance } = setup();
    const open = entriesRepo.open({ placeId: place.id, source: "auto" });
    const { result } = renderHook(() => useOngoingEntry(), { wrapper });
    await waitFor(() => expect(result.current.entry?.id).toBe(open.id));
    advance(120);
    await act(async () => {
      result.current.stop();
    });
    await waitFor(() => expect(result.current.entry).toBeNull());
  });

  it("stop() is a no-op when nothing is ongoing", async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useOngoingEntry(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      result.current.stop();
    });
    expect(result.current.entry).toBeNull();
  });
});
