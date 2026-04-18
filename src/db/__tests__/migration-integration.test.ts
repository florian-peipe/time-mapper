import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const MIGRATION_SQL_PATH = path.join(__dirname, "..", "migrations", "0000_init.sql");

describe("migration integration (on-device mirror)", () => {
  it("migration file exists at the expected device path", () => {
    expect(fs.existsSync(MIGRATION_SQL_PATH)).toBe(true);
  });

  it("raw SQL creates all five tables and accepts basic inserts", () => {
    const db = new Database(":memory:");
    const sql = fs.readFileSync(MIGRATION_SQL_PATH, "utf8");
    db.exec(sql.replace(/--> statement-breakpoint/g, ";"));

    // All five tables must exist
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r: any) => r.name);
    expect(tables).toEqual(
      expect.arrayContaining(["categories", "entries", "kv", "pending_transitions", "places"]),
    );

    // Insert a place + entry + kv to verify shape
    db.prepare(
      "INSERT INTO places (id, name, address, latitude, longitude, radius_m, entry_buffer_s, exit_buffer_s, color, icon, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run("p1", "Work", "Kinkelstr 3", 50.96, 6.94, 100, 300, 180, "#FF6A3D", "briefcase", 1, 1);

    db.prepare(
      "INSERT INTO entries (id, place_id, started_at, ended_at, pause_s, source, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
    ).run("e1", "p1", 1, 2, 0, "auto", 1, 1);

    db.prepare("INSERT INTO kv (key, value) VALUES (?, ?)").run("onboarding.seeded", "1");

    expect(db.prepare("SELECT count(*) as c FROM places").get()).toEqual({ c: 1 });
    expect(db.prepare("SELECT count(*) as c FROM entries").get()).toEqual({ c: 1 });
    expect(db.prepare("SELECT pause_s FROM entries WHERE id = 'e1'").get()).toEqual({ pause_s: 0 });
    db.close();
  });
});
