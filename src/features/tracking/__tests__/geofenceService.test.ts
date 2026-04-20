import type { Place } from "@/db/schema";
import * as Location from "expo-location";
import type { LocationObjectCoords } from "expo-location";
import {
  registerPlaceGeofences,
  unregisterAllGeofences,
  reconcileGeofences,
  placeContaining,
  getCurrentPlaceId,
  TASK_NAME,
  MAX_PLACES,
  __internals,
} from "../geofenceService";

jest.mock("expo-location", () => ({
  startGeofencingAsync: jest.fn(async () => undefined),
  stopGeofencingAsync: jest.fn(async () => undefined),
  hasStartedGeofencingAsync: jest.fn(async () => false),
  getLastKnownPositionAsync: jest.fn(async () => null),
  getCurrentPositionAsync: jest.fn(async () => null),
  Accuracy: { Balanced: 3 },
}));

const mLoc = Location as jest.Mocked<typeof Location>;

function makePlace(id: string, overrides: Partial<Place> = {}): Place {
  return {
    id,
    name: `P-${id}`,
    address: "addr",
    latitude: 52.52,
    longitude: 13.405,
    radiusM: 100,
    entryBufferS: 300,
    exitBufferS: 180,
    color: "#FF7A1A",
    icon: "pin",
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
    ...overrides,
  };
}

describe("tracking/geofenceService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mLoc.hasStartedGeofencingAsync.mockResolvedValue(false);
    mLoc.getLastKnownPositionAsync.mockResolvedValue(null);
  });

  test("registerPlaceGeofences with a non-empty list calls startGeofencingAsync once with the full region set", async () => {
    const places = [makePlace("a"), makePlace("b", { radiusM: 150 })];
    await registerPlaceGeofences(places);
    expect(mLoc.startGeofencingAsync).toHaveBeenCalledTimes(1);
    expect(mLoc.startGeofencingAsync).toHaveBeenCalledWith(TASK_NAME, [
      {
        identifier: "a",
        latitude: 52.52,
        longitude: 13.405,
        radius: 100,
        notifyOnEnter: true,
        notifyOnExit: true,
      },
      {
        identifier: "b",
        latitude: 52.52,
        longitude: 13.405,
        radius: 150,
        notifyOnEnter: true,
        notifyOnExit: true,
      },
    ]);
  });

  test("registerPlaceGeofences with an empty list unregisters instead of starting with zero regions", async () => {
    mLoc.hasStartedGeofencingAsync.mockResolvedValue(true);
    await registerPlaceGeofences([]);
    expect(mLoc.startGeofencingAsync).not.toHaveBeenCalled();
    expect(mLoc.stopGeofencingAsync).toHaveBeenCalledWith(TASK_NAME);
  });

  test("registerPlaceGeofences caps at MAX_PLACES (20) regions — iOS limit", async () => {
    const places = Array.from({ length: 25 }, (_, i) => makePlace(`p${i}`));
    await registerPlaceGeofences(places);
    const firstCall = mLoc.startGeofencingAsync.mock.calls[0];
    expect(firstCall).toBeDefined();
    const regions = firstCall![1];
    expect(regions).toHaveLength(MAX_PLACES);
  });

  test("unregisterAllGeofences is a no-op when no task is running", async () => {
    mLoc.hasStartedGeofencingAsync.mockResolvedValue(false);
    await unregisterAllGeofences();
    expect(mLoc.stopGeofencingAsync).not.toHaveBeenCalled();
  });

  test("reconcileGeofences is equivalent to registerPlaceGeofences (always replaces)", async () => {
    const places = [makePlace("a")];
    await reconcileGeofences(places);
    expect(mLoc.startGeofencingAsync).toHaveBeenCalledTimes(1);
  });

  test("placeContaining returns the place whose radius contains the location", () => {
    const p1 = makePlace("near", { latitude: 52.52, longitude: 13.405, radiusM: 100 });
    const p2 = makePlace("far", { latitude: 48.0, longitude: 11.0 });
    const coords = { latitude: 52.5205, longitude: 13.4055 } as unknown as LocationObjectCoords;
    const result = placeContaining({ coords }, [p1, p2]);
    expect(result?.id).toBe("near");
  });

  test("placeContaining returns null when outside every radius", () => {
    const p = makePlace("p", { latitude: 0, longitude: 0, radiusM: 50 });
    const coords = { latitude: 10, longitude: 10 } as unknown as LocationObjectCoords;
    const result = placeContaining({ coords }, [p]);
    expect(result).toBeNull();
  });

  test("haversineMeters is symmetric and zero for identical points", () => {
    const d = __internals.haversineMeters(52.52, 13.405, 52.52, 13.405);
    expect(d).toBeCloseTo(0, 5);
    const ab = __internals.haversineMeters(52.52, 13.405, 48.137, 11.576);
    const ba = __internals.haversineMeters(48.137, 11.576, 52.52, 13.405);
    expect(ab).toBeCloseTo(ba, 3);
    // Berlin-Munich is ~500km
    expect(ab).toBeGreaterThan(400_000);
    expect(ab).toBeLessThan(600_000);
  });

  test("getCurrentPlaceId returns null when location unavailable", async () => {
    mLoc.getLastKnownPositionAsync.mockResolvedValue(null);
    const result = await getCurrentPlaceId([makePlace("a")]);
    expect(result).toBeNull();
  });

  test("getCurrentPlaceId returns the matching place id when user is inside", async () => {
    mLoc.getCurrentPositionAsync.mockResolvedValue({
      coords: {
        latitude: 52.52,
        longitude: 13.405,
        altitude: null,
        accuracy: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    });
    const result = await getCurrentPlaceId([makePlace("a")]);
    expect(result).toBe("a");
  });

  test("getCurrentPlaceId swallows errors and returns null (cannot crash background task)", async () => {
    mLoc.getCurrentPositionAsync.mockRejectedValue(new Error("gps off"));
    mLoc.getLastKnownPositionAsync.mockRejectedValue(new Error("gps off"));
    const result = await getCurrentPlaceId([makePlace("a")]);
    expect(result).toBeNull();
  });
});
