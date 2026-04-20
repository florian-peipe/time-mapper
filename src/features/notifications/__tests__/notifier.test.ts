import { createTestDb } from "@/db/testClient";
import { PlacesRepo } from "@/db/repository/places";
import { EntriesRepo } from "@/db/repository/entries";
import { KvRepo } from "@/db/repository/kv";
import {
  decideNotification,
  isQuietAt,
  getQuietHours,
  setQuietHours,
  maybeNotifyForEffects,
  fireNotification,
  configureNotificationChannels,
  ANDROID_CHANNEL_ID,
  IOS_CATEGORY_ID,
} from "../notifier";
import type { Place } from "@/db/schema";

import * as N from "expo-notifications";

jest.mock("expo-notifications", () => ({
  scheduleNotificationAsync: jest.fn(async () => "notif-id"),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  setNotificationCategoryAsync: jest.fn(async () => undefined),
  AndroidImportance: { LOW: 2 },
}));

const mN = N as jest.Mocked<typeof N>;

function makePlace(id: string, name = "Home"): Place {
  return {
    id,
    name,
    address: "s",
    latitude: 0,
    longitude: 0,
    radiusM: 100,
    entryBufferS: 300,
    exitBufferS: 180,
    color: "#FF7A1A",
    icon: "pin",
    dailyGoalMinutes: null,
    weeklyGoalMinutes: null,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
  };
}

describe("notifications/notifier", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("isQuietAt", () => {
    test("returns false inside a zero-length window", () => {
      expect(isQuietAt(0, { startH: 10, endH: 10 })).toBe(false);
    });

    test("evening-only window: 20→23 quiets at 21", () => {
      // 1704106800 = 2024-01-01T11:00:00Z, local depends on env — pick a safe epoch
      // Use constructor-based epoch for deterministic hour.
      const d = new Date(2024, 0, 1, 21, 0, 0);
      expect(isQuietAt(Math.floor(d.getTime() / 1000), { startH: 20, endH: 23 })).toBe(true);
    });

    test("wraps midnight: 22→7 quiets at 23 and at 3am", () => {
      const d23 = new Date(2024, 0, 1, 23, 0, 0);
      const d3 = new Date(2024, 0, 2, 3, 0, 0);
      const d10 = new Date(2024, 0, 2, 10, 0, 0);
      const w = { startH: 22, endH: 7 };
      expect(isQuietAt(Math.floor(d23.getTime() / 1000), w)).toBe(true);
      expect(isQuietAt(Math.floor(d3.getTime() / 1000), w)).toBe(true);
      expect(isQuietAt(Math.floor(d10.getTime() / 1000), w)).toBe(false);
    });
  });

  describe("getQuietHours / setQuietHours", () => {
    test("round-trips a valid window via KV", () => {
      const db = createTestDb();
      const kv = new KvRepo(db);
      setQuietHours(kv, { startH: 22, endH: 7 });
      expect(getQuietHours(kv)).toEqual({ startH: 22, endH: 7 });
    });

    test("null clears the stored window", () => {
      const db = createTestDb();
      const kv = new KvRepo(db);
      setQuietHours(kv, { startH: 10, endH: 11 });
      setQuietHours(kv, null);
      expect(getQuietHours(kv)).toBeNull();
    });

    test("malformed stored data returns null", () => {
      const db = createTestDb();
      const kv = new KvRepo(db);
      kv.set("notifier.quiet_hours", "not-json");
      expect(getQuietHours(kv)).toBeNull();
    });
  });

  describe("decideNotification", () => {
    const place = makePlace("a", "Home");

    test("open event outside quiet hours → fire", () => {
      const d = decideNotification({
        kind: "open",
        place,
        nowS: 1000,
        recent: [],
        quiet: null,
      });
      expect(d.kind).toBe("fire");
    });

    test("close event includes duration in body", () => {
      const d = decideNotification({
        kind: "close",
        place,
        durationS: 3700, // 1h 1m
        nowS: 1000,
        recent: [],
        quiet: null,
      });
      expect(d.kind).toBe("fire");
      if (d.kind !== "fire") throw new Error("unreachable");
      expect(d.body).toMatch(/1h 1m/);
    });

    test("quiet hours → skip", () => {
      // 1am, inside 22→7 window
      const nowS = Math.floor(new Date(2024, 0, 1, 1, 0, 0).getTime() / 1000);
      const d = decideNotification({
        kind: "open",
        place,
        nowS,
        recent: [],
        quiet: { startH: 22, endH: 7 },
      });
      expect(d.kind).toBe("skip");
      if (d.kind !== "skip") throw new Error("unreachable");
      expect(d.reason).toBe("quiet_hours");
    });

    test("3+ events within 10min → consolidate", () => {
      const nowS = 1000;
      const recent = [950, 900]; // both within 10min
      const d = decideNotification({ kind: "open", place, nowS, recent, quiet: null });
      expect(d.kind).toBe("consolidate");
    });

    test("recent events older than 10min do not trigger consolidation", () => {
      const nowS = 3000;
      const recent = [100, 200, 500]; // all > 10min ago
      const d = decideNotification({ kind: "open", place, nowS, recent, quiet: null });
      expect(d.kind).toBe("fire");
    });

    test("recent[] in the returned decision includes the current event's timestamp", () => {
      const d = decideNotification({
        kind: "open",
        place,
        nowS: 1000,
        recent: [],
        quiet: null,
      });
      expect(d.recent).toContain(1000);
    });
  });

  describe("fireNotification", () => {
    test("calls scheduleNotificationAsync with category id + immediate trigger", async () => {
      await fireNotification("Hello", "World");
      expect(mN.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      const call = mN.scheduleNotificationAsync.mock.calls[0]?.[0];
      expect(call?.content.title).toBe("Hello");
      expect(call?.content.body).toBe("World");
      expect(call?.content.categoryIdentifier).toBe(IOS_CATEGORY_ID);
      expect(call?.trigger).toBeNull();
    });

    test("swallows errors from expo-notifications (cannot crash background)", async () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      mN.scheduleNotificationAsync.mockRejectedValueOnce(new Error("no permission"));
      await expect(fireNotification("Hello", "World")).resolves.toBeUndefined();
      warnSpy.mockRestore();
    });
  });

  describe("configureNotificationChannels", () => {
    test("first call configures Android channel + iOS category; second call is a no-op", async () => {
      const db = createTestDb();
      const kv = new KvRepo(db);
      await configureNotificationChannels(kv);
      expect(mN.setNotificationChannelAsync).toHaveBeenCalledWith(
        ANDROID_CHANNEL_ID,
        expect.any(Object),
      );
      expect(mN.setNotificationCategoryAsync).toHaveBeenCalledWith(IOS_CATEGORY_ID, []);

      await configureNotificationChannels(kv);
      // Still 1 call — guard flag caught us.
      expect(mN.setNotificationChannelAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe("maybeNotifyForEffects", () => {
    test("open_entry effect fires a notification", async () => {
      const db = createTestDb();
      const placesRepo = new PlacesRepo(db);
      const place = placesRepo.create({
        name: "Home",
        address: "s",
        latitude: 0,
        longitude: 0,
      });
      await maybeNotifyForEffects(
        [{ kind: "open_entry", placeId: place.id, atS: 1000 }],
        placesRepo,
        1000,
      );
      expect(mN.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    });

    test("close_entry effect fires with duration from the ended entry", async () => {
      const db = createTestDb();
      const placesRepo = new PlacesRepo(db);
      const entriesRepo = new EntriesRepo(db);
      const place = placesRepo.create({
        name: "Home",
        address: "s",
        latitude: 0,
        longitude: 0,
      });
      const entry = entriesRepo.open({ placeId: place.id, source: "auto", startedAt: 1000 });
      entriesRepo.closeAt(entry.id, 4600);
      await maybeNotifyForEffects(
        [{ kind: "close_entry", entryId: entry.id, atS: 4600 }],
        placesRepo,
        4600,
      );
      const call = mN.scheduleNotificationAsync.mock.calls[0]?.[0];
      expect(call?.content.body).toMatch(/1h 0m/);
    });

    test("persist_pending and clear_pending effects are ignored (no notification)", async () => {
      const db = createTestDb();
      const placesRepo = new PlacesRepo(db);
      await maybeNotifyForEffects(
        [
          {
            kind: "persist_pending",
            transition: {
              id: "t1",
              placeId: "p",
              kind: "enter",
              regionEventAtS: 0,
              confirmAtS: 0,
            },
          },
          { kind: "clear_pending", transitionId: "t1", outcome: "started" },
        ],
        placesRepo,
        1000,
      );
      expect(mN.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });
});
