import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { PlacesRepo } from "@/db/repository/places";
import { EntriesRepo } from "@/db/repository/entries";
import { PendingTransitionsRepo } from "@/db/repository/pending";
import { KvRepo } from "@/db/repository/kv";

// Guards the Day-1 upgrade path: a user who installed a pre-1.0 build has
// real data (places with a `category_id`, a live `categories` row, a running
// entry, a pending transition, some KV prefs). Ship v1.1 to them and every
// migration in the chain must apply cleanly with every repo still reading.
//
// Approach: apply only 0000_init, seed realistic production-shaped data,
// then apply every later migration in order and exercise the repos.
// Anything that ships as a new migration gets added to UPGRADE_MIGRATIONS
// so this test keeps gating real upgrades.

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

const INITIAL_MIGRATION = "0000_init.sql";
const UPGRADE_MIGRATIONS = [
  "0001_cleanup.sql",
  "0002_cascade.sql",
  "0003_goals.sql",
  "0004_goal_days.sql",
];

function loadSql(file: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
}

function applySql(sqlite: Database.Database, file: string): void {
  sqlite.exec(loadSql(file).replace(/--> statement-breakpoint/g, ";"));
}

describe("migrations — upgrade from a pre-1.0 device", () => {
  let sqlite: Database.Database;

  beforeEach(() => {
    sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");
    // Simulate a user who last updated when only the initial schema shipped.
    applySql(sqlite, INITIAL_MIGRATION);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("preserves existing places / entries / kv / pending rows across all migrations", () => {
    // Seed production-shaped data using the 0000_init schema (includes the
    // now-removed `categories` table + `places.category_id` column).
    sqlite
      .prepare(
        "INSERT INTO categories (id, name, color, created_at) VALUES ('c1', 'Work', '#FF7A1A', 1000)",
      )
      .run();

    sqlite
      .prepare(
        "INSERT INTO places (id, name, address, latitude, longitude, radius_m, entry_buffer_s, exit_buffer_s, category_id, color, icon, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
      .run("p1", "Home", "Köln", 50.94, 6.96, 120, 300, 180, "c1", "#FF7A1A", "home", 1000, 1000);

    sqlite
      .prepare(
        "INSERT INTO entries (id, place_id, started_at, ended_at, pause_s, source, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
      )
      .run("e1", "p1", 1000, 4600, 0, "auto", null, 1000, 1000);

    sqlite
      .prepare(
        "INSERT INTO pending_transitions (id, place_id, kind, region_event_at, confirm_at) VALUES (?,?,?,?,?)",
      )
      .run("t1", "p1", "enter", 1000, 1300);

    sqlite.prepare("INSERT INTO kv (key, value) VALUES (?, ?)").run("onboarding.done", "1");

    for (const m of UPGRADE_MIGRATIONS) applySql(sqlite, m);

    const db = drizzle(sqlite);
    const places = new PlacesRepo(db);
    const entries = new EntriesRepo(db);
    const pending = new PendingTransitionsRepo(db);
    const kv = new KvRepo(db);

    // Row counts survived untouched.
    const placesRow = sqlite.prepare("SELECT count(*) as c FROM places").get() as { c: number };
    const entriesRow = sqlite.prepare("SELECT count(*) as c FROM entries").get() as { c: number };
    expect(placesRow.c).toBe(1);
    expect(entriesRow.c).toBe(1);

    // Drizzle repos read the migrated rows.
    expect(places.get("p1")).toMatchObject({ id: "p1", name: "Home", radiusM: 120 });
    const entry = entries.get("e1");
    expect(entry).not.toBeNull();
    expect(entry!.placeId).toBe("p1");

    expect(pending.listAll()).toHaveLength(1);
    expect(kv.get("onboarding.done")).toBe("1");

    // Repos accept new writes post-migration.
    const p2 = places.create({
      name: "Work",
      address: "Mediapark",
      latitude: 50.95,
      longitude: 6.94,
    });
    expect(places.get(p2.id)?.name).toBe("Work");

    // Dropped table is gone and the dropped FK column is gone.
    const remainingTables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r) => (r as { name: string }).name);
    expect(remainingTables).not.toContain("categories");

    const placeColumns = sqlite
      .prepare("PRAGMA table_info(places)")
      .all()
      .map((r) => (r as { name: string }).name);
    expect(placeColumns).not.toContain("category_id");

    // 0003_goals + 0004_goal_days added columns — verify they exist.
    expect(placeColumns).toEqual(
      expect.arrayContaining(["daily_goal_minutes", "weekly_goal_minutes", "daily_goal_days"]),
    );
  });

  it("CASCADE fires after the 0002 migration — deleting a place sweeps its children", () => {
    sqlite
      .prepare(
        "INSERT INTO places (id, name, address, latitude, longitude, radius_m, entry_buffer_s, exit_buffer_s, color, icon, created_at, updated_at) VALUES ('p1','Home','x',0,0,100,300,180,'#FF7A1A','home',1,1)",
      )
      .run();
    sqlite
      .prepare(
        "INSERT INTO entries (id, place_id, started_at, ended_at, pause_s, source, created_at, updated_at) VALUES ('e1','p1',1,2,0,'auto',1,1)",
      )
      .run();
    sqlite
      .prepare(
        "INSERT INTO pending_transitions (id, place_id, kind, region_event_at, confirm_at) VALUES ('t1','p1','enter',1,2)",
      )
      .run();

    for (const m of UPGRADE_MIGRATIONS) applySql(sqlite, m);

    sqlite.prepare("DELETE FROM places WHERE id = 'p1'").run();

    const entriesCount = sqlite.prepare("SELECT count(*) as c FROM entries").get() as { c: number };
    const pendingCount = sqlite.prepare("SELECT count(*) as c FROM pending_transitions").get() as {
      c: number;
    };
    expect(entriesCount.c).toBe(0);
    expect(pendingCount.c).toBe(0);
  });
});
