import React from "react";
import { render, act } from "@testing-library/react-native";
import { EntriesRepo } from "@/db/repository/entries";
import { PlacesRepo } from "@/db/repository/places";
import { createTestDb } from "@/db/testClient";
import { EntriesRepoProvider } from "../useEntries";
import { useEntriesRange, type UseEntriesRangeResult } from "../useEntriesRange";
import { useDataVersionStore } from "@/state/dataVersionStore";

type Sink = { current: UseEntriesRangeResult | null };

function Harness({ sink, startS, endS }: { sink: Sink; startS: number; endS: number }) {
  const result = useEntriesRange(startS, endS);
  sink.current = result;
  return null;
}

function setup(startS: number, endS: number) {
  const db = createTestDb();
  const entriesRepo = new EntriesRepo(db);
  const placesRepo = new PlacesRepo(db);
  const place = placesRepo.create({
    name: "Home",
    address: "",
    latitude: 0,
    longitude: 0,
  });
  const sink: Sink = { current: null };
  const utils = render(
    <EntriesRepoProvider value={entriesRepo}>
      <Harness sink={sink} startS={startS} endS={endS} />
    </EntriesRepoProvider>,
  );
  return { utils, sink, entriesRepo, place };
}

beforeEach(() => {
  // Reset the global version counter so cross-test bleed-through is
  // impossible.
  useDataVersionStore.setState({ placesVersion: 0, entriesVersion: 0 });
});

describe("useEntriesRange", () => {
  it("returns entries whose startedAt falls inside the [startS, endS] window", () => {
    const start = 1_700_000_000;
    const end = start + 86_400; // 24h
    const { sink, entriesRepo, place, utils } = setup(start, end);
    entriesRepo.createManual({
      placeId: place.id,
      startedAt: start + 3600,
      endedAt: start + 7200,
    });
    // Out of range — should be ignored.
    entriesRepo.createManual({
      placeId: place.id,
      startedAt: start - 3600,
      endedAt: start - 1800,
    });
    act(() => {
      sink.current?.refresh();
    });
    expect(sink.current?.entries.length).toBe(1);
    utils.unmount();
  });

  it("re-reads the repo when the global entriesVersion bumps", () => {
    const start = 1_700_000_000;
    const end = start + 86_400;
    const { sink, entriesRepo, place, utils } = setup(start, end);

    expect(sink.current?.entries.length).toBe(0);

    // External mutation path — a bg task wrote directly to the DB without
    // going through the hook. The hook should re-query once bumpEntries
    // fires.
    entriesRepo.createManual({
      placeId: place.id,
      startedAt: start + 1000,
      endedAt: start + 2000,
    });
    act(() => {
      useDataVersionStore.getState().bumpEntries();
    });
    expect(sink.current?.entries.length).toBe(1);
    utils.unmount();
  });

  it("exposes `refresh` for callers that want an explicit re-query", () => {
    const start = 1_700_000_000;
    const end = start + 86_400;
    const { sink, entriesRepo, place, utils } = setup(start, end);

    entriesRepo.createManual({
      placeId: place.id,
      startedAt: start + 500,
      endedAt: start + 1500,
    });
    expect(sink.current?.entries.length).toBe(0);
    act(() => {
      sink.current?.refresh();
    });
    expect(sink.current?.entries.length).toBe(1);
    utils.unmount();
  });
});
