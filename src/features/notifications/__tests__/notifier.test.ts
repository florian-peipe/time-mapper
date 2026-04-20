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
import * as N from "expo-notifications";
import { makePlace as makePlaceBase } from "@/features/places/testFixtures";

jest.mock("expo-notifications", () => ({
  scheduleNotificationAsync: jest.fn(async () => "notif-id"),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  setNotificationCategoryAsync: jest.fn(async () => undefined),
  AndroidImportance: { LOW: 2 },
}));

const mN = N as jest.Mocked<typeof N>;

// Local wrapper around the shared fixture — keeps the notifier tests'
// `makePlace(id, name)` signature while reusing the canonical defaults.
function makePlace(id: string, name = "Home") {
  return makePlaceBase(id, { name });
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
      expect(d.body).toMatch(/1h 01m/);
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
        db,
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
        db,
        4600,
      );
      const call = mN.scheduleNotificationAsync.mock.calls[0]?.[0];
      expect(call?.content.body).toMatch(/1h 00m/);
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
        db,
        1000,
      );
      expect(mN.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe("maybeNotifyGoalReached (via maybeNotifyForEffects)", () => {
    /**
     * Helper: set up a DB with a place that has goals, plus an entry
     * that has just closed such that the day's total crosses the goal.
     * Returns the pieces the test needs to invoke the close_entry path.
     */
    function setupGoalScenario(opts: {
      dailyGoalMinutes?: number | null;
      weeklyGoalMinutes?: number | null;
      /** Total minutes of entries ALREADY closed today (excluding the one that fires). */
      priorTodayMin?: number;
      /** Duration of the entry that's about to fire close_entry (counts into the day). */
      closingEntryMin: number;
      /** Unix seconds "now" — controls which day/week the totals roll into. */
      nowS: number;
    }) {
      const db = createTestDb();
      const placesRepo = new PlacesRepo(db);
      const entriesRepo = new EntriesRepo(db);
      const place = placesRepo.create({
        name: "Work",
        address: "",
        latitude: 0,
        longitude: 0,
        dailyGoalMinutes: opts.dailyGoalMinutes ?? null,
        weeklyGoalMinutes: opts.weeklyGoalMinutes ?? null,
      });
      const dayStart = Math.floor(new Date(opts.nowS * 1000).setHours(0, 0, 0, 0) / 1000);
      let cursor = dayStart;
      if (opts.priorTodayMin) {
        entriesRepo.createManual({
          placeId: place.id,
          startedAt: cursor,
          endedAt: cursor + opts.priorTodayMin * 60,
        });
        cursor += opts.priorTodayMin * 60 + 60;
      }
      // The "just closed" entry.
      const closing = entriesRepo.createManual({
        placeId: place.id,
        startedAt: cursor,
        endedAt: cursor + opts.closingEntryMin * 60,
      });
      return { db, placesRepo, entriesRepo, place, closing };
    }

    test("fires a 'Daily goal reached' notification when the day's total crosses the goal", async () => {
      // 2026-04-15 16:00 local. Goal = 60 min. Prior = 30 min. Closing = 45 min.
      // Total after close = 75 min ≥ 60 → goal hit.
      const nowS = Math.floor(new Date(2026, 3, 15, 16, 0, 0).getTime() / 1000);
      const { db, placesRepo, closing } = setupGoalScenario({
        dailyGoalMinutes: 60,
        priorTodayMin: 30,
        closingEntryMin: 45,
        nowS,
      });

      await maybeNotifyForEffects(
        [{ kind: "close_entry", entryId: closing.id, atS: nowS }],
        placesRepo,
        db,
        nowS,
      );

      // 2 scheduleNotificationAsync calls: the regular "Stopped tracking"
      // + the "Daily goal reached" follow-up.
      expect(mN.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
      const titles = mN.scheduleNotificationAsync.mock.calls.map(
        (call) => (call[0] as { content: { title: string } }).content.title,
      );
      expect(titles).toContain("Daily goal reached");
    });

    test("no goal notification when the day's total falls short", async () => {
      const nowS = Math.floor(new Date(2026, 3, 15, 16, 0, 0).getTime() / 1000);
      const { db, placesRepo, closing } = setupGoalScenario({
        dailyGoalMinutes: 240, // 4h — well above what's been tracked
        priorTodayMin: 30,
        closingEntryMin: 45,
        nowS,
      });

      await maybeNotifyForEffects(
        [{ kind: "close_entry", entryId: closing.id, atS: nowS }],
        placesRepo,
        db,
        nowS,
      );

      // Only the regular close notification, no goal-reached.
      expect(mN.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
      const titles = mN.scheduleNotificationAsync.mock.calls.map(
        (call) => (call[0] as { content: { title: string } }).content.title,
      );
      expect(titles).not.toContain("Daily goal reached");
    });

    test("dedupes within the same day (second close doesn't re-fire)", async () => {
      const nowS = Math.floor(new Date(2026, 3, 15, 16, 0, 0).getTime() / 1000);
      const { db, placesRepo, entriesRepo, place, closing } = setupGoalScenario({
        dailyGoalMinutes: 60,
        priorTodayMin: 30,
        closingEntryMin: 45,
        nowS,
      });

      await maybeNotifyForEffects(
        [{ kind: "close_entry", entryId: closing.id, atS: nowS }],
        placesRepo,
        db,
        nowS,
      );
      expect(mN.scheduleNotificationAsync).toHaveBeenCalledTimes(2); // close + goal

      // Second close later the same day — add another entry + fire close.
      const secondEntry = entriesRepo.createManual({
        placeId: place.id,
        startedAt: nowS + 3600,
        endedAt: nowS + 3600 + 600, // +10 min
      });
      await maybeNotifyForEffects(
        [{ kind: "close_entry", entryId: secondEntry.id, atS: nowS + 4200 }],
        placesRepo,
        db,
        nowS + 4200,
      );
      // One more "Stopped tracking" but no second "Daily goal reached".
      expect(mN.scheduleNotificationAsync).toHaveBeenCalledTimes(3);
      const dailyTitleCount = mN.scheduleNotificationAsync.mock.calls.filter(
        (call) =>
          (call[0] as { content: { title: string } }).content.title === "Daily goal reached",
      ).length;
      expect(dailyTitleCount).toBe(1);
    });

    test("weekly goal fires its own notification when crossed", async () => {
      const nowS = Math.floor(new Date(2026, 3, 15, 16, 0, 0).getTime() / 1000);
      const { db, placesRepo, closing } = setupGoalScenario({
        weeklyGoalMinutes: 60,
        priorTodayMin: 30,
        closingEntryMin: 45,
        nowS,
      });

      await maybeNotifyForEffects(
        [{ kind: "close_entry", entryId: closing.id, atS: nowS }],
        placesRepo,
        db,
        nowS,
      );

      const titles = mN.scheduleNotificationAsync.mock.calls.map(
        (call) => (call[0] as { content: { title: string } }).content.title,
      );
      expect(titles).toContain("Weekly goal reached");
    });

    test("no-goal places stay silent", async () => {
      const nowS = Math.floor(new Date(2026, 3, 15, 16, 0, 0).getTime() / 1000);
      const { db, placesRepo, closing } = setupGoalScenario({
        dailyGoalMinutes: null,
        weeklyGoalMinutes: null,
        priorTodayMin: 30,
        closingEntryMin: 45,
        nowS,
      });

      await maybeNotifyForEffects(
        [{ kind: "close_entry", entryId: closing.id, atS: nowS }],
        placesRepo,
        db,
        nowS,
      );
      expect(mN.scheduleNotificationAsync).toHaveBeenCalledTimes(1); // just the close
    });

    test("daily-goal-days filter: goal set Mon-Fri, close on Saturday → no goal fire", async () => {
      // 2026-04-18 is a Saturday (ISO 6). Goal applies only Mon-Fri.
      const nowS = Math.floor(new Date(2026, 3, 18, 16, 0, 0).getTime() / 1000);
      const { db, placesRepo, closing, place } = setupGoalScenario({
        dailyGoalMinutes: 60,
        priorTodayMin: 30,
        closingEntryMin: 45,
        nowS,
      });
      // Override the fresh place to carry a Mon-Fri day filter.
      placesRepo.update(place.id, { dailyGoalDays: "1,2,3,4,5" });

      await maybeNotifyForEffects(
        [{ kind: "close_entry", entryId: closing.id, atS: nowS }],
        placesRepo,
        db,
        nowS,
      );

      // Regular "Stopped tracking" should still fire; the goal-reached
      // notification must NOT because Saturday isn't an active day.
      const titles = mN.scheduleNotificationAsync.mock.calls.map(
        (call) => (call[0] as { content: { title: string } }).content.title,
      );
      expect(titles).not.toContain("Daily goal reached");
    });
  });
});
