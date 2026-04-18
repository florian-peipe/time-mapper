import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import type { PlacesRepo } from "./repository/places";
import type { EntriesRepo } from "./repository/entries";
import type { KvRepo } from "./repository/kv";
import { entries, places, categories, pendingTransitions, kv } from "./schema";

type AnyDb = BetterSQLite3Database | ExpoSQLiteDatabase;
type Clock = () => number;

/**
 * Unix-seconds clock. Extracted so both production (`Date.now()`) and tests
 * (fixed timestamp) can pass their own sampler into `seedDemoData`.
 */
const defaultClock: Clock = () => Math.floor(Date.now() / 1000);

/** kv flag that marks first-boot seeding as complete. */
export const SEED_FLAG_KEY = "onboarding.seeded";

/**
 * Realistic Köln-area demo places — seeded once on first boot so the fresh
 * app has something to render. Coordinates are from OpenStreetMap lookups;
 * radius defaults (100m) apply. Icons match shared `IconName` keys.
 */
const DEMO_PLACES = [
  {
    name: "Home",
    address: "Nippes, Köln",
    color: "#FF6A3D",
    icon: "home",
    latitude: 50.964,
    longitude: 6.956,
  },
  {
    name: "Work",
    address: "Kinkelstr. 3, 50733 Köln",
    color: "#1D7FD1",
    icon: "briefcase",
    latitude: 50.96,
    longitude: 6.944,
  },
  {
    name: "Gym",
    address: "Mediapark, Köln",
    color: "#2E9A5E",
    icon: "dumbbell",
    latitude: 50.949,
    longitude: 6.941,
  },
] as const;

/**
 * Seed realistic demo data on first boot so every freshly-installed copy of
 * Time Mapper has something to show. Idempotent: guarded by a
 * `kv.onboarding.seeded` flag, so calling twice is a no-op.
 *
 * Shape (relative to the wall-clock `now`, which is locally anchored to
 * midnight of today and midnight of yesterday before slotting entries):
 *   - 3 places: Home, Work, Gym (Köln coordinates).
 *   - ~15 entries spanning yesterday + today:
 *     Yesterday: Home 07:30-09:00, Work 09:20-12:40 + 13:30-17:45,
 *       Gym 18:30-19:45, Home 20:00-23:30, plus one manual entry with a
 *       note (Home 23:45-23:59, note "wind-down").
 *     Today:     Home 07:00-08:45, Work 09:05-… (ongoing, endedAt null).
 *
 * Accepts repos rather than the raw `db` so tests can inject repos bound to
 * the in-memory test client. Callers pass the device repos in production.
 */
export function seedDemoData(
  placesRepo: PlacesRepo,
  entriesRepo: EntriesRepo,
  kvRepo: KvRepo,
  clock: Clock = defaultClock,
): void {
  if (kvRepo.get(SEED_FLAG_KEY) === "1") return;

  const nowUnix = clock();
  const nowDate = new Date(nowUnix * 1000);

  // Anchor each entry to midnight of the relevant day, then shift by hours/
  // minutes. Using Date constructors keeps DST math honest without pulling
  // in date-fns here.
  const todayMidnight = new Date(nowDate);
  todayMidnight.setHours(0, 0, 0, 0);
  const yesterdayMidnight = new Date(todayMidnight);
  yesterdayMidnight.setDate(yesterdayMidnight.getDate() - 1);

  const at = (anchor: Date, hh: number, mm: number): number => {
    const d = new Date(anchor);
    d.setHours(hh, mm, 0, 0);
    return Math.floor(d.getTime() / 1000);
  };

  // Create places first — we need their ids to associate entries.
  const created = DEMO_PLACES.map((p) =>
    placesRepo.create({
      name: p.name,
      address: p.address,
      latitude: p.latitude,
      longitude: p.longitude,
      color: p.color,
      icon: p.icon,
    }),
  );
  const home = created[0];
  const work = created[1];
  const gym = created[2];
  if (!home || !work || !gym) throw new Error("seed: place creation failed");

  // --- Yesterday: a full day of auto-tracked entries + one manual wind-down.
  seedAutoEntry(entriesRepo, home.id, at(yesterdayMidnight, 7, 30), at(yesterdayMidnight, 9, 0));
  seedAutoEntry(entriesRepo, work.id, at(yesterdayMidnight, 9, 20), at(yesterdayMidnight, 12, 40));
  seedAutoEntry(entriesRepo, work.id, at(yesterdayMidnight, 13, 30), at(yesterdayMidnight, 17, 45));
  seedAutoEntry(entriesRepo, gym.id, at(yesterdayMidnight, 18, 30), at(yesterdayMidnight, 19, 45));
  seedAutoEntry(entriesRepo, home.id, at(yesterdayMidnight, 20, 0), at(yesterdayMidnight, 23, 30));
  entriesRepo.createManual({
    placeId: home.id,
    startedAt: at(yesterdayMidnight, 23, 45),
    endedAt: at(yesterdayMidnight, 23, 59),
    note: "wind-down",
  });

  // --- Today: a completed morning at home, and an ongoing work session so
  // the RunningTimerCard has something to render on first launch.
  seedAutoEntry(entriesRepo, home.id, at(todayMidnight, 7, 0), at(todayMidnight, 8, 45));
  entriesRepo.open({
    placeId: work.id,
    source: "auto",
    startedAt: at(todayMidnight, 9, 5),
  });

  kvRepo.set(SEED_FLAG_KEY, "1");
}

/**
 * Nuke every user-facing table + the seed flag, then replay `seedDemoData`.
 * Exposed to the Settings Developer "Re-seed demo data" row so we can reset
 * the app between screenshot sessions without reinstalling.
 *
 * Drizzle's `.delete(table)` with no `.where(...)` truncates the table.
 */
export function resetAndSeed(
  db: AnyDb,
  placesRepo: PlacesRepo,
  entriesRepo: EntriesRepo,
  kvRepo: KvRepo,
  clock: Clock = defaultClock,
): void {
  // Order: child rows before parents — entries + pending_transitions both
  // reference places, so they go first. categories + kv are independent.
  db.delete(entries).run();
  db.delete(pendingTransitions).run();
  db.delete(places).run();
  db.delete(categories).run();
  db.delete(kv).run();
  seedDemoData(placesRepo, entriesRepo, kvRepo, clock);
}

/**
 * Open + immediately close an auto-tracked entry — used for completed
 * historical entries in the seed. Sets `source: "auto"` on the insert path
 * (rather than the manual path) so `EntryEditSheet` renders the "Auto-
 * tracked" source chip for the row.
 */
function seedAutoEntry(
  repo: EntriesRepo,
  placeId: string,
  startedAt: number,
  endedAt: number,
): void {
  const opened = repo.open({ placeId, source: "auto", startedAt });
  repo.update(opened.id, { endedAt });
}
