import React from "react";
import { render, act } from "@testing-library/react-native";
import * as Location from "expo-location";
import { PlacesRepo } from "@/db/repository/places";
import { createTestDb } from "@/db/testClient";
import { PlacesRepoProvider } from "../usePlaces";
import { useClosestPlace, type ClosestPlace } from "../useClosestPlace";
import type { Place } from "@/db/schema";

jest.mock("expo-location", () => ({
  getLastKnownPositionAsync: jest.fn(async () => null),
}));
const mLoc = Location as jest.Mocked<typeof Location>;

/** Harness: exposes the hook's return as a live ref for assertions. */
function useClosestPlaceHarness(sink: { current: ClosestPlace | null }) {
  const result = useClosestPlace();
  sink.current = result;
  return null;
}

function fix(lat: number, lng: number): Location.LocationObject {
  return {
    coords: {
      latitude: lat,
      longitude: lng,
      altitude: null,
      accuracy: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: Date.now(),
  };
}

function seed(places: Partial<Place>[]): PlacesRepo {
  const db = createTestDb();
  const repo = new PlacesRepo(db);
  for (const p of places) {
    repo.create({
      name: p.name ?? "Place",
      address: "",
      latitude: p.latitude ?? 0,
      longitude: p.longitude ?? 0,
      radiusM: p.radiusM ?? 100,
    });
  }
  return repo;
}

/** Renders the hook under a PlacesRepo provider and flushes async work. */
async function mountHook(repo: PlacesRepo) {
  const sink = { current: null as ClosestPlace | null };
  const utils = render(
    <PlacesRepoProvider value={repo}>
      <HarnessWrapper sink={sink} />
    </PlacesRepoProvider>,
  );
  // Flush the initial `void poll()` microtask.
  await act(async () => {});
  return { utils, sink };
}

function HarnessWrapper({ sink }: { sink: { current: ClosestPlace | null } }) {
  return useClosestPlaceHarness(sink);
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mLoc.getLastKnownPositionAsync.mockResolvedValue(null);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useClosestPlace", () => {
  it("returns null when there are no places", async () => {
    const repo = seed([]);
    const { sink, utils } = await mountHook(repo);
    expect(sink.current).toBeNull();
    utils.unmount();
  });

  it("returns null when the GPS fix is unavailable", async () => {
    const repo = seed([{ name: "Home", latitude: 52.52, longitude: 13.405, radiusM: 100 }]);
    mLoc.getLastKnownPositionAsync.mockResolvedValue(null);
    const { sink, utils } = await mountHook(repo);
    expect(sink.current).toBeNull();
    utils.unmount();
  });

  it("reports `inside` when the user sits inside the radius", async () => {
    const repo = seed([{ name: "Home", latitude: 52.52, longitude: 13.405, radiusM: 100 }]);
    mLoc.getLastKnownPositionAsync.mockResolvedValue(fix(52.52, 13.405));
    const { sink, utils } = await mountHook(repo);
    expect(sink.current).not.toBeNull();
    expect(sink.current?.inside).toBe(true);
    expect(sink.current?.near).toBe(false);
    expect(sink.current?.place.name).toBe("Home");
    utils.unmount();
  });

  it("reports `near` when within 2× radius but not inside", async () => {
    // Place at radius 100 m. Shift ~150 m away (~0.00135° lat ≈ 150 m).
    const repo = seed([{ name: "Home", latitude: 52.52, longitude: 13.405, radiusM: 100 }]);
    mLoc.getLastKnownPositionAsync.mockResolvedValue(fix(52.5214, 13.405));
    const { sink, utils } = await mountHook(repo);
    expect(sink.current?.near).toBe(true);
    expect(sink.current?.inside).toBe(false);
    utils.unmount();
  });

  it("returns null when far from every place (>2× radius)", async () => {
    const repo = seed([{ name: "Home", latitude: 52.52, longitude: 13.405, radiusM: 100 }]);
    // ~1.1 km away.
    mLoc.getLastKnownPositionAsync.mockResolvedValue(fix(52.53, 13.405));
    const { sink, utils } = await mountHook(repo);
    expect(sink.current).toBeNull();
    utils.unmount();
  });

  it("swallows GPS errors silently", async () => {
    const repo = seed([{ name: "Home", latitude: 52.52, longitude: 13.405, radiusM: 100 }]);
    mLoc.getLastKnownPositionAsync.mockRejectedValue(new Error("gps off"));
    const { sink, utils } = await mountHook(repo);
    expect(sink.current).toBeNull();
    utils.unmount();
  });

  it("clears its polling interval on unmount", async () => {
    const repo = seed([{ name: "Home", latitude: 52.52, longitude: 13.405, radiusM: 100 }]);
    mLoc.getLastKnownPositionAsync.mockResolvedValue(null);
    const { utils } = await mountHook(repo);
    const spy = jest.spyOn(global, "clearInterval");
    utils.unmount();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
