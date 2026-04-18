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

  set(key: string, value: string): void {
    const existing = this.get(key);
    if (existing === null) this.db.insert(kv).values({ key, value }).run();
    else this.db.update(kv).set({ value }).where(eq(kv.key, key)).run();
  }

  delete(key: string): void {
    this.db.delete(kv).where(eq(kv.key, key)).run();
  }
}
