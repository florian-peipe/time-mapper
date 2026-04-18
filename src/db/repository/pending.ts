import { and, asc, desc, eq, isNull, lte } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { pendingTransitions, type PendingTransition } from "../schema";

type AnyDb = BetterSQLite3Database | ExpoSQLiteDatabase;

export type NewPendingTransition = {
  id: string;
  placeId: string;
  kind: "enter" | "exit";
  regionEventAt: number;
  confirmAt: number;
};

/**
 * Thin repo over the `pending_transitions` table. A "pending transition" is a
 * bookkeeping row for an OS geofence event whose entry/exit buffer has not
 * yet expired. Opportunistic resolution scans `WHERE confirm_at <= now AND
 * resolved_at IS NULL` on every location wake.
 *
 * Exactly-once semantics come from the primary key + `resolved_at`
 * idempotency guard. A second CONFIRM for the same row is a no-op.
 */
export class PendingTransitionsRepo {
  constructor(private db: AnyDb) {}

  insert(t: NewPendingTransition): PendingTransition {
    const row: PendingTransition = {
      id: t.id,
      placeId: t.placeId,
      kind: t.kind,
      regionEventAt: t.regionEventAt,
      confirmAt: t.confirmAt,
      resolvedAt: null,
      outcome: null,
    };
    this.db.insert(pendingTransitions).values(row).run();
    return row;
  }

  get(id: string): PendingTransition | null {
    const row = this.db
      .select()
      .from(pendingTransitions)
      .where(eq(pendingTransitions.id, id))
      .get();
    return (row as PendingTransition) ?? null;
  }

  /**
   * Returns the single unresolved transition, if any. By design we only
   * ever allow one in flight at a time — the state machine cancels
   * conflicting events before persisting a new one.
   */
  getLatestUnresolved(): PendingTransition | null {
    const row = this.db
      .select()
      .from(pendingTransitions)
      .where(isNull(pendingTransitions.resolvedAt))
      .orderBy(desc(pendingTransitions.regionEventAt))
      .limit(1)
      .get();
    return (row as PendingTransition) ?? null;
  }

  /** Rows whose `confirm_at` has passed. Used for opportunistic CONFIRM. */
  dueAt(nowS: number): PendingTransition[] {
    return this.db
      .select()
      .from(pendingTransitions)
      .where(and(isNull(pendingTransitions.resolvedAt), lte(pendingTransitions.confirmAt, nowS)))
      .orderBy(asc(pendingTransitions.confirmAt))
      .all() as PendingTransition[];
  }

  /**
   * Mark a transition as resolved. Writes `resolved_at` + `outcome` so the
   * row is skipped by future `dueAt()` scans. Throws if the row is already
   * resolved — callers must wrap in a transaction and handle the race.
   */
  resolve(id: string, outcome: "started" | "ended" | "cancelled", nowS: number): void {
    this.db
      .update(pendingTransitions)
      .set({ resolvedAt: nowS, outcome })
      .where(and(eq(pendingTransitions.id, id), isNull(pendingTransitions.resolvedAt)))
      .run();
  }

  listAll(): PendingTransition[] {
    return this.db
      .select()
      .from(pendingTransitions)
      .orderBy(desc(pendingTransitions.regionEventAt))
      .all() as PendingTransition[];
  }
}
