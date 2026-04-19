import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { kv } from "../schema";

type AnyDb = BetterSQLite3Database | ExpoSQLiteDatabase;

export class KvRepo {
  constructor(private db: AnyDb) {}

  get(key: string): string | null {
    const row = this.db.select().from(kv).where(eq(kv.key, key)).get();
    return (row as { value: string } | undefined)?.value ?? null;
  }

  /**
   * Atomic upsert — a single `INSERT … ON CONFLICT DO UPDATE` statement so
   * two concurrent writers never race between `get` and `write`. Required
   * on the mobile runtime where the background geofence task can fire
   * while the foreground JS is in the middle of a KV write.
   */
  set(key: string, value: string): void {
    this.db
      .insert(kv)
      .values({ key, value })
      .onConflictDoUpdate({ target: kv.key, set: { value } })
      .run();
  }

  delete(key: string): void {
    this.db.delete(kv).where(eq(kv.key, key)).run();
  }
}
