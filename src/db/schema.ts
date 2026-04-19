import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const places = sqliteTable("places", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  radiusM: integer("radius_m").notNull().default(100),
  entryBufferS: integer("entry_buffer_s").notNull().default(300),
  exitBufferS: integer("exit_buffer_s").notNull().default(180),
  color: text("color").notNull(),
  icon: text("icon").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
});

export const entries = sqliteTable("entries", {
  id: text("id").primaryKey(),
  placeId: text("place_id")
    .notNull()
    .references(() => places.id),
  startedAt: integer("started_at").notNull(),
  endedAt: integer("ended_at"),
  // Pause/break length in seconds, subtracted from gross duration for net time.
  // Used by the Ledger view (column C) and EntryEditSheet.
  pauseS: integer("pause_s").notNull().default(0),
  source: text("source", { enum: ["auto", "manual"] }).notNull(),
  note: text("note"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
});

export const pendingTransitions = sqliteTable("pending_transitions", {
  id: text("id").primaryKey(),
  placeId: text("place_id")
    .notNull()
    .references(() => places.id),
  kind: text("kind", { enum: ["enter", "exit"] }).notNull(),
  regionEventAt: integer("region_event_at").notNull(),
  confirmAt: integer("confirm_at").notNull(),
  resolvedAt: integer("resolved_at"),
  outcome: text("outcome", { enum: ["started", "ended", "cancelled"] }),
});

export const kv = sqliteTable("kv", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Place = typeof places.$inferSelect;
export type NewPlace = typeof places.$inferInsert;
export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
export type PendingTransition = typeof pendingTransitions.$inferSelect;
