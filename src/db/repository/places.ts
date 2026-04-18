import { desc, eq, isNull } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { places, type Place, type NewPlace } from "../schema";
import { uuid } from "@/lib/id";

type AnyDb = BetterSQLite3Database | ExpoSQLiteDatabase;
type Clock = { now: () => number };

export type CreatePlaceInput = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusM?: number;
  entryBufferS?: number;
  exitBufferS?: number;
  categoryId?: string | null;
  color?: string;
  icon?: string;
};

export class PlacesRepo {
  constructor(
    private db: AnyDb,
    private clock: Clock = { now: () => (Date.now() / 1000) | 0 },
  ) {}

  create(input: CreatePlaceInput): Place {
    const now = this.clock.now();
    const row: NewPlace = {
      id: uuid(),
      name: input.name,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      radiusM: input.radiusM ?? 100,
      entryBufferS: input.entryBufferS ?? 300,
      exitBufferS: input.exitBufferS ?? 180,
      categoryId: input.categoryId ?? null,
      color: input.color ?? "#FF7A1A",
      icon: input.icon ?? "pin",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    this.db.insert(places).values(row).run();
    return row as Place;
  }

  get(id: string): Place | null {
    const row = this.db.select().from(places).where(eq(places.id, id)).get();
    return (row as Place) ?? null;
  }

  list(): Place[] {
    return this.db
      .select()
      .from(places)
      .where(isNull(places.deletedAt))
      .orderBy(desc(places.updatedAt))
      .all() as Place[];
  }

  count(): number {
    return this.list().length;
  }

  update(id: string, patch: Partial<CreatePlaceInput>): Place {
    const now = this.clock.now();
    this.db
      .update(places)
      .set({ ...patch, updatedAt: now })
      .where(eq(places.id, id))
      .run();
    const row = this.get(id);
    if (!row) throw new Error(`Place ${id} not found after update`);
    return row;
  }

  softDelete(id: string): void {
    const now = this.clock.now();
    this.db.update(places).set({ deletedAt: now, updatedAt: now }).where(eq(places.id, id)).run();
  }
}
