import { createTestDb } from "@/db/testClient";
import { PlacesRepo } from "@/db/repository/places";

import { bootstrapTracking, reconcileAfterPlaceChange } from "../bootstrap";
import { reconcileGeofences } from "../geofenceService";
import { getLocationStatus } from "@/features/permissions";
import { runOpportunisticResolve } from "@/background/tasks";
import { configureNotificationChannels } from "@/features/notifications/notifier";

jest.mock("@/db/client", () => ({
  get db() {
    return mockDb();
  },
  runMigrations: jest.fn(async () => undefined),
}));

jest.mock("../geofenceService", () => ({
  ...jest.requireActual("../geofenceService"),
  reconcileGeofences: jest.fn(async () => undefined),
}));

jest.mock("@/features/permissions", () => ({
  getLocationStatus: jest.fn(async () => "granted"),
}));

jest.mock("@/background/tasks", () => ({
  runOpportunisticResolve: jest.fn(async () => ({ kind: "IDLE", placeId: null })),
}));

jest.mock("@/features/notifications/notifier", () => ({
  configureNotificationChannels: jest.fn(async () => undefined),
}));

let currentDb: ReturnType<typeof createTestDb> | null = null;
function mockDb() {
  if (!currentDb) throw new Error("no test db");
  return currentDb;
}

describe("tracking/bootstrap", () => {
  beforeEach(() => {
    currentDb = createTestDb();
    jest.clearAllMocks();
    (getLocationStatus as jest.Mock).mockResolvedValue("granted");
  });

  test("bootstrapTracking configures channels, reconciles geofences, runs resolve", async () => {
    const places = new PlacesRepo(currentDb!);
    places.create({ name: "Home", address: "s", latitude: 0, longitude: 0 });
    places.create({ name: "Gym", address: "s2", latitude: 1, longitude: 1 });
    await bootstrapTracking();
    expect(configureNotificationChannels).toHaveBeenCalled();
    expect(reconcileGeofences).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: "Home" }),
        expect.objectContaining({ name: "Gym" }),
      ]),
    );
    expect(runOpportunisticResolve).toHaveBeenCalled();
  });

  test("bootstrapTracking skips geofence registration when location isn't granted", async () => {
    (getLocationStatus as jest.Mock).mockResolvedValue("denied");
    await bootstrapTracking();
    expect(reconcileGeofences).not.toHaveBeenCalled();
    // Still runs resolve + channels — those don't need location.
    expect(configureNotificationChannels).toHaveBeenCalled();
    expect(runOpportunisticResolve).toHaveBeenCalled();
  });

  test("bootstrapTracking swallows errors (cannot block boot)", async () => {
    (reconcileGeofences as jest.Mock).mockRejectedValue(new Error("no"));
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(bootstrapTracking()).resolves.toBeUndefined();
    warnSpy.mockRestore();
  });

  test("reconcileAfterPlaceChange re-registers the current full place set", async () => {
    const places = new PlacesRepo(currentDb!);
    places.create({ name: "Home", address: "s", latitude: 0, longitude: 0 });
    await reconcileAfterPlaceChange();
    expect(reconcileGeofences).toHaveBeenCalledTimes(1);
  });

  test("reconcileAfterPlaceChange is a no-op when permission isn't granted", async () => {
    (getLocationStatus as jest.Mock).mockResolvedValue("foreground-only");
    await reconcileAfterPlaceChange();
    expect(reconcileGeofences).not.toHaveBeenCalled();
  });
});
