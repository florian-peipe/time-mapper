import { createTestDb } from "@/db/testClient";
import { PlacesRepo } from "@/db/repository/places";
import { EntriesRepo } from "@/db/repository/entries";
import { simulateEnter, simulateExit, simulatePassage } from "../devSim";

jest.mock("@/db/client", () => ({
  get db() {
    return mockDb();
  },
  runMigrations: jest.fn(async () => undefined),
}));

jest.mock("@/features/notifications/notifier", () => ({
  maybeNotifyForEffects: jest.fn(async () => undefined),
}));

let currentDb: ReturnType<typeof createTestDb> | null = null;
function mockDb() {
  if (!currentDb) throw new Error("no test db");
  return currentDb;
}

describe("tracking/devSim", () => {
  beforeEach(() => {
    currentDb = createTestDb();
    jest.clearAllMocks();
  });

  test("simulateEnter opens an entry (bypasses buffer via immediate CONFIRM)", async () => {
    const places = new PlacesRepo(currentDb!);
    const place = places.create({ name: "Home", address: "s", latitude: 0, longitude: 0 });
    await simulateEnter(place.id, 1000);
    const entries = new EntriesRepo(currentDb!);
    const ongoing = entries.ongoing();
    expect(ongoing).not.toBeNull();
    expect(ongoing?.placeId).toBe(place.id);
  });

  test("simulateExit closes the ongoing entry at the exit event time", async () => {
    const places = new PlacesRepo(currentDb!);
    const entries = new EntriesRepo(currentDb!);
    const place = places.create({ name: "Home", address: "s", latitude: 0, longitude: 0 });
    await simulateEnter(place.id, 1000);
    await simulateExit(place.id, 4600);
    expect(entries.ongoing()).toBeNull();
    const all = entries.listBetween(0, 9999);
    expect(all).toHaveLength(1);
    expect(all[0]?.startedAt).toBe(1000);
    expect(all[0]?.endedAt).toBe(4600);
  });

  test("simulatePassage: enter + dwell + exit = one complete entry", async () => {
    const places = new PlacesRepo(currentDb!);
    const entries = new EntriesRepo(currentDb!);
    const place = places.create({ name: "Home", address: "s", latitude: 0, longitude: 0 });
    await simulatePassage(place.id, 1800, 1000); // 30min dwell
    const all = entries.listBetween(0, 9999);
    expect(all).toHaveLength(1);
    expect((all[0]?.endedAt ?? 0) - (all[0]?.startedAt ?? 0)).toBe(1800);
  });

  test("unknown placeId is a silent no-op (no entries created)", async () => {
    await simulateEnter("does-not-exist", 1000);
    const entries = new EntriesRepo(currentDb!);
    expect(entries.ongoing()).toBeNull();
  });
});
