import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const MIGRATION_DIR = path.join(__dirname, "migrations");

function loadSql(file: string): string {
  return fs.readFileSync(path.join(MIGRATION_DIR, file), "utf8");
}

/**
 * Apply every migration in order so the test db mirrors production's
 * final schema + indexes + FK constraints. Cheaper than running
 * drizzle's own migrator because we don't need to fake the __drizzle
 * migrations table — tests always start from a clean in-memory db.
 */
function applyAllMigrations(sqlite: Database.Database): void {
  const migrations = [
    "0000_init.sql",
    "0001_cleanup.sql",
    "0002_cascade.sql",
    "0003_goals.sql",
    "0004_goal_days.sql",
  ];
  for (const m of migrations) {
    sqlite.exec(loadSql(m).replace(/--> statement-breakpoint/g, ";"));
  }
}

export function createTestDb() {
  const sqlite = new Database(":memory:");
  // Match production: enforce foreign keys so CASCADE and NOT-NULL checks
  // actually fire during tests.
  sqlite.pragma("foreign_keys = ON");
  applyAllMigrations(sqlite);
  return drizzle(sqlite);
}
