import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { entries, type Entry } from "../schema";
import { uuid } from "@/lib/id";

type AnyDb = BetterSQLite3Database | ExpoSQLiteDatabase;
type Clock = { now: () => number };

export class EntriesRepo {
  constructor(
    private db: AnyDb,
    private clock: Clock = { now: () => (Date.now() / 1000) | 0 },
  ) {}

  open(input: {
    placeId: string;
    source: "auto" | "manual";
    startedAt?: number;
    pauseS?: number;
  }): Entry {
    const now = this.clock.now();
    const row = {
      id: uuid(),
      placeId: input.placeId,
      startedAt: input.startedAt ?? now,
      endedAt: null as number | null,
      pauseS: input.pauseS ?? 0,
      source: input.source,
      note: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.db.insert(entries).values(row).run();
    return row as Entry;
  }

  createManual(input: {
    placeId: string;
    startedAt: number;
    endedAt: number;
    note?: string;
    pauseS?: number;
  }): Entry {
    const now = this.clock.now();
    const row = {
      id: uuid(),
      placeId: input.placeId,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      pauseS: input.pauseS ?? 0,
      source: "manual" as const,
      note: input.note ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.db.insert(entries).values(row).run();
    return row as Entry;
  }

  close(id: string): Entry {
    const now = this.clock.now();
    this.db.update(entries).set({ endedAt: now, updatedAt: now }).where(eq(entries.id, id)).run();
    const row = this.get(id);
    if (!row) throw new Error(`Entry ${id} not found after close`);
    return row;
  }

  get(id: string): Entry | null {
    const row = this.db.select().from(entries).where(eq(entries.id, id)).get();
    return (row as Entry) ?? null;
  }

  ongoing(): Entry | null {
    const row = this.db
      .select()
      .from(entries)
      .where(and(isNull(entries.endedAt), isNull(entries.deletedAt)))
      .orderBy(desc(entries.startedAt))
      .limit(1)
      .get();
    return (row as Entry) ?? null;
  }

  listBetween(fromUnix: number, toUnix: number): Entry[] {
    return this.db
      .select()
      .from(entries)
      .where(
        and(
          isNull(entries.deletedAt),
          gte(entries.startedAt, fromUnix),
          lte(entries.startedAt, toUnix),
        ),
      )
      .orderBy(desc(entries.startedAt))
      .all() as Entry[];
  }

  softDelete(id: string): void {
    const now = this.clock.now();
    this.db
      .update(entries)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(entries.id, id))
      .run();
  }
}
