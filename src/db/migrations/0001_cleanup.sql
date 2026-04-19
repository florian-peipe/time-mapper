-- Drop the unused `categories` table that shipped in 0000_init but was
-- never wired into any code path. Nothing referenced it, so no data is
-- lost.
DROP TABLE IF EXISTS `categories`;
--> statement-breakpoint
-- Drop the now-orphaned FK column on `places` (SQLite 3.35+ supports
-- ALTER TABLE DROP COLUMN; expo-sqlite ships 3.39+).
ALTER TABLE `places` DROP COLUMN `category_id`;
--> statement-breakpoint
-- Enforce at the DB layer what the state machine has always guaranteed:
-- at most one unresolved open entry per place. A partial unique index
-- makes the constraint cheap to enforce + free to read.
CREATE UNIQUE INDEX IF NOT EXISTS `ix_entries_open_unique`
  ON `entries` (`place_id`)
  WHERE `ended_at` IS NULL AND `deleted_at` IS NULL;
--> statement-breakpoint
-- Speed up the hot `ongoing()` query (used by TimelineScreen + every bg
-- task fire). Covers the predicate and ordering.
CREATE INDEX IF NOT EXISTS `ix_entries_ongoing`
  ON `entries` (`ended_at`, `deleted_at`, `started_at` DESC);
--> statement-breakpoint
-- Speed up `getLatestUnresolved()` + `dueAt()` on the pending table.
CREATE INDEX IF NOT EXISTS `ix_pending_unresolved`
  ON `pending_transitions` (`resolved_at`, `region_event_at` DESC);
--> statement-breakpoint
-- Speed up `listBetween(from, to)` for the Stats/Ledger week queries.
CREATE INDEX IF NOT EXISTS `ix_entries_started_at`
  ON `entries` (`started_at`, `deleted_at`);
