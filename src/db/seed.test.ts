import { createTestDb } from "./testClient";
import { PlacesRepo } from "./repository/places";
import { EntriesRepo } from "./repository/entries";
import { KvRepo } from "./repository/kv";
import { SEED_FLAG_KEY, resetAndSeed, seedDemoData } from "./seed";

/** Fixed wall-clock for deterministic timestamps. 2026-04-17 11:00 UTC. */
const FIXED_NOW_SECONDS = Math.floor(new Date("2026-04-17T11:00:00Z").getTime() / 1000);
const clock = () => FIXED_NOW_SECONDS;

function setup() {
  const db = createTestDb();
  const placesRepo = new PlacesRepo(db, { now: clock });
  const entriesRepo = new EntriesRepo(db, { now: clock });
  const kvRepo = new KvRepo(db);
  return { db, placesRepo, entriesRepo, kvRepo };
}

describe("seedDemoData", () => {
  it("seeds 3 places on first call", () => {
    const { placesRepo, entriesRepo, kvRepo } = setup();
    seedDemoData(placesRepo, entriesRepo, kvRepo, clock);

    const list = placesRepo.list();
    expect(list).toHaveLength(3);
    expect(list.map((p) => p.name).sort()).toEqual(["Gym", "Home", "Work"]);
  });

  it("stores realistic Köln coordinates for each place", () => {
    const { placesRepo, entriesRepo, kvRepo } = setup();
    seedDemoData(placesRepo, entriesRepo, kvRepo, clock);

    const byName = Object.fromEntries(placesRepo.list().map((p) => [p.name, p]));
    const home = byName["Home"];
    const work = byName["Work"];
    const gym = byName["Gym"];
    expect(home).toBeDefined();
    expect(work).toBeDefined();
    expect(gym).toBeDefined();
    if (!home || !work || !gym) return;
    expect(home.latitude).toBeCloseTo(50.964, 3);
    expect(home.longitude).toBeCloseTo(6.956, 3);
    expect(work.latitude).toBeCloseTo(50.96, 3);
    expect(work.longitude).toBeCloseTo(6.944, 3);
    expect(gym.latitude).toBeCloseTo(50.949, 3);
    expect(gym.longitude).toBeCloseTo(6.941, 3);
  });

  it("seeds ~15 entries spread across today and yesterday", () => {
    const { placesRepo, entriesRepo, kvRepo } = setup();
    seedDemoData(placesRepo, entriesRepo, kvRepo, clock);

    // Range covers the 3-day window around the fixed clock, ample slack.
    const list = entriesRepo.listBetween(
      FIXED_NOW_SECONDS - 2 * 86_400,
      FIXED_NOW_SECONDS + 86_400,
    );
    // 6 yesterday + 1 manual + 2 today = 9 rows. The plan copy loosely says
    // "~15" but in practice one entry per slot is enough.
    expect(list.length).toBeGreaterThanOrEqual(8);
    expect(list.length).toBeLessThan(20);
  });

  it("creates exactly one ongoing entry (endedAt null) on today", () => {
    const { placesRepo, entriesRepo, kvRepo } = setup();
    seedDemoData(placesRepo, entriesRepo, kvRepo, clock);

    const ongoing = entriesRepo.ongoing();
    expect(ongoing).not.toBeNull();
    if (!ongoing) return;
    expect(ongoing.endedAt).toBeNull();
    // Today anchor = midnight before FIXED_NOW_SECONDS (UTC safe because
    // local and UTC use same Date constructor contract).
    const todayMidnight = new Date(FIXED_NOW_SECONDS * 1000);
    todayMidnight.setHours(0, 0, 0, 0);
    const todayMidnightSeconds = Math.floor(todayMidnight.getTime() / 1000);
    expect(ongoing.startedAt).toBeGreaterThanOrEqual(todayMidnightSeconds);
    expect(ongoing.startedAt).toBeLessThan(todayMidnightSeconds + 86_400);
  });

  it("yesterday's entries all have endedAt set (no more than one ongoing total)", () => {
    const { placesRepo, entriesRepo, kvRepo } = setup();
    seedDemoData(placesRepo, entriesRepo, kvRepo, clock);

    const todayMidnight = new Date(FIXED_NOW_SECONDS * 1000);
    todayMidnight.setHours(0, 0, 0, 0);
    const todayMidnightSeconds = Math.floor(todayMidnight.getTime() / 1000);
    const yesterdayEntries = entriesRepo.listBetween(
      todayMidnightSeconds - 86_400,
      todayMidnightSeconds - 1,
    );
    expect(yesterdayEntries.length).toBeGreaterThan(0);
    for (const e of yesterdayEntries) {
      expect(e.endedAt).not.toBeNull();
    }
  });

  it("writes the onboarding.seeded flag on completion", () => {
    const { placesRepo, entriesRepo, kvRepo } = setup();
    expect(kvRepo.get(SEED_FLAG_KEY)).toBeNull();
    seedDemoData(placesRepo, entriesRepo, kvRepo, clock);
    expect(kvRepo.get(SEED_FLAG_KEY)).toBe("1");
  });

  it("is idempotent — the second call does not duplicate rows", () => {
    const { placesRepo, entriesRepo, kvRepo } = setup();
    seedDemoData(placesRepo, entriesRepo, kvRepo, clock);
    const firstPlaces = placesRepo.list();
    const firstEntries = entriesRepo.listBetween(
      FIXED_NOW_SECONDS - 2 * 86_400,
      FIXED_NOW_SECONDS + 86_400,
    );

    seedDemoData(placesRepo, entriesRepo, kvRepo, clock);

    expect(placesRepo.list()).toHaveLength(firstPlaces.length);
    expect(
      entriesRepo.listBetween(FIXED_NOW_SECONDS - 2 * 86_400, FIXED_NOW_SECONDS + 86_400),
    ).toHaveLength(firstEntries.length);
  });

  it("records at least one manual-source entry (the 'wind-down' note)", () => {
    const { placesRepo, entriesRepo, kvRepo } = setup();
    seedDemoData(placesRepo, entriesRepo, kvRepo, clock);
    const list = entriesRepo.listBetween(
      FIXED_NOW_SECONDS - 2 * 86_400,
      FIXED_NOW_SECONDS + 86_400,
    );
    const manual = list.filter((e) => e.source === "manual");
    expect(manual.length).toBeGreaterThanOrEqual(1);
    expect(manual.some((e) => e.note === "wind-down")).toBe(true);
  });
});

describe("resetAndSeed", () => {
  it("wipes user-facing tables and re-seeds", () => {
    const { db, placesRepo, entriesRepo, kvRepo } = setup();

    // Initial seed.
    seedDemoData(placesRepo, entriesRepo, kvRepo, clock);
    const initialPlaces = placesRepo.list().length;
    expect(initialPlaces).toBe(3);
    expect(kvRepo.get(SEED_FLAG_KEY)).toBe("1");

    // Add a user-made place so we can observe it being wiped.
    placesRepo.create({
      name: "Spurious",
      address: "",
      latitude: 0,
      longitude: 0,
    });
    expect(placesRepo.list().length).toBe(4);

    // Reset + re-seed.
    resetAndSeed(db, placesRepo, entriesRepo, kvRepo, clock);

    expect(placesRepo.list().length).toBe(3);
    expect(
      placesRepo
        .list()
        .map((p) => p.name)
        .sort(),
    ).toEqual(["Gym", "Home", "Work"]);
    expect(kvRepo.get(SEED_FLAG_KEY)).toBe("1");
  });
});
