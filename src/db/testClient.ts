import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const MIGRATION_DIR = path.join(__dirname, "migrations");

function loadInitSql(): string {
  const file = path.join(MIGRATION_DIR, "0000_init.sql");
  return fs.readFileSync(file, "utf8");
}

export function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.exec(loadInitSql().replace(/--> statement-breakpoint/g, ";"));
  return drizzle(sqlite);
}
