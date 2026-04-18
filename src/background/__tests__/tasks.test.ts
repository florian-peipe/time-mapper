import { createTestDb } from "@/db/testClient";
import { PlacesRepo } from "@/db/repository/places";
import { EntriesRepo } from "@/db/repository/entries";
import { PendingTransitionsRepo } from "@/db/repository/pending";

import * as TaskManager from "expo-task-manager";
import { handleGeofencingEvent, TASK_NAME } from "../tasks";
import { maybeNotifyForEffects } from "@/features/notifications/notifier";

jest.mock("expo-task-manager", () => ({
  defineTask: jest.fn(),
  isTaskDefined: jest.fn(() => false),
}));

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
  if (!currentDb) throw new Error("no test db set");
  return currentDb;
}

// Capture the defineTask invocation from module import before beforeEach wipes it.
const defineTaskCalls = (TaskManager.defineTask as jest.Mock).mock.calls.slice();

describe("background/tasks", () => {
  beforeEach(() => {
    currentDb = createTestDb();
    jest.clearAllMocks();
  });

  test("defineTask is called at module-import time with the canonical name", () => {
    expect(defineTaskCalls.length).toBeGreaterThanOrEqual(1);
    expect(defineTaskCalls[0]?.[0]).toBe(TASK_NAME);
  });

  test("REGION_ENTER event → inserts pending_transitions and machine is PENDING_ENTER", async () => {
    const places = new PlacesRepo(currentDb!);
    const place = places.create({
      name: "Home",
      address: "s",
      latitude: 0,
      longitude: 0,
      entryBufferS: 300,
    });

    await handleGeofencingEvent(
      {
        eventType: 1, // Enter
        region: {
          identifier: place.id,
          latitude: 0,
          longitude: 0,
          radius: 100,
        },
      },
      1000,
    );

    const pending = new PendingTransitionsRepo(currentDb!);
    const row = pending.getLatestUnresolved();
    expect(row?.placeId).toBe(place.id);
    expect(row?.kind).toBe("enter");
    expect(row?.regionEventAt).toBe(1000);
    expect(row?.confirmAt).toBe(1300);
  });

  test("Opportunistic CONFIRM resolves a pending_transition whose buffer elapsed between wakes", async () => {
    const places = new PlacesRepo(currentDb!);
    const place = places.create({
      name: "Home",
      address: "s",
      latitude: 0,
      longitude: 0,
      entryBufferS: 300,
    });

    // First wake: enter
    await handleGeofencingEvent(
      {
        eventType: 1,
        region: { identifier: place.id, latitude: 0, longitude: 0, radius: 100 },
      },
      1000,
    );

    // Second wake: no event, but clock has passed the confirm buffer
    await handleGeofencingEvent(null, 1400);

    const entries = new EntriesRepo(currentDb!);
    const ongoing = entries.ongoing();
    expect(ongoing).not.toBeNull();
    expect(ongoing?.placeId).toBe(place.id);
    expect(ongoing?.startedAt).toBe(1000);

    const pending = new PendingTransitionsRepo(currentDb!);
    expect(pending.getLatestUnresolved()).toBeNull();
  });

  test("EXIT event on ACTIVE inserts a pending exit; subsequent CONFIRM closes the entry", async () => {
    const places = new PlacesRepo(currentDb!);
    const place = places.create({
      name: "Home",
      address: "s",
      latitude: 0,
      longitude: 0,
      entryBufferS: 300,
      exitBufferS: 180,
    });

    // Enter + confirm (two wakes) → ACTIVE
    await handleGeofencingEvent(
      {
        eventType: 1,
        region: { identifier: place.id, latitude: 0, longitude: 0, radius: 100 },
      },
      1000,
    );
    await handleGeofencingEvent(null, 1400);

    // Exit
    await handleGeofencingEvent(
      {
        eventType: 2,
        region: { identifier: place.id, latitude: 0, longitude: 0, radius: 100 },
      },
      2000,
    );

    const pending = new PendingTransitionsRepo(currentDb!);
    expect(pending.getLatestUnresolved()?.kind).toBe("exit");

    // Confirm past buffer
    await handleGeofencingEvent(null, 2200);
    const entries = new EntriesRepo(currentDb!);
    const ongoing = entries.ongoing();
    expect(ongoing).toBeNull();

    // All entries — should be one closed at the EXIT event time (2000)
    const all = entries.listBetween(0, 9999);
    expect(all).toHaveLength(1);
    expect(all[0]?.endedAt).toBe(2000);
  });

  test("events for unknown places are silently dropped (stale region id, place deleted)", async () => {
    await handleGeofencingEvent(
      {
        eventType: 1,
        region: { identifier: "does-not-exist", latitude: 0, longitude: 0, radius: 100 },
      },
      1000,
    );
    const pending = new PendingTransitionsRepo(currentDb!);
    expect(pending.listAll()).toHaveLength(0);
  });

  test("Notifier is called with the effects that were applied", async () => {
    const places = new PlacesRepo(currentDb!);
    const place = places.create({
      name: "Home",
      address: "s",
      latitude: 0,
      longitude: 0,
      entryBufferS: 300,
    });
    await handleGeofencingEvent(
      {
        eventType: 1,
        region: { identifier: place.id, latitude: 0, longitude: 0, radius: 100 },
      },
      1000,
    );
    expect(maybeNotifyForEffects).toHaveBeenCalled();
  });
});
