-- Re-declare foreign keys on child tables with ON DELETE CASCADE so a
-- hard-delete of a place (retention sweep or the "erase all data" flow)
-- automatically removes its dependent entries + pending rows.
--
-- Soft-delete (PlacesRepo.softDelete, used by the UI with the undo
-- snackbar) is an UPDATE, not a DELETE — CASCADE does not fire. That's
-- the intended behaviour: the 5 s undo still works because the entries
-- remain untouched while `places.deleted_at` is non-null.
--
-- SQLite cannot ALTER a foreign-key constraint in place; the official
-- pattern is "recreate the table + copy data". We do that inside the
-- existing `PRAGMA foreign_keys` state (which, per `db/client.ts`, is
-- now enabled app-wide) and re-create the indexes + unique constraints
-- that 0001_cleanup added.

PRAGMA foreign_keys=OFF;
--> statement-breakpoint
-- entries → places CASCADE
CREATE TABLE `entries_new` (
  `id` text PRIMARY KEY NOT NULL,
  `place_id` text NOT NULL,
  `started_at` integer NOT NULL,
  `ended_at` integer,
  `pause_s` integer DEFAULT 0 NOT NULL,
  `source` text NOT NULL,
  `note` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `deleted_at` integer,
  FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `entries_new` SELECT * FROM `entries`;
--> statement-breakpoint
DROP TABLE `entries`;
--> statement-breakpoint
ALTER TABLE `entries_new` RENAME TO `entries`;
--> statement-breakpoint
-- Re-create the indexes from 0001_cleanup that were dropped with the table.
CREATE UNIQUE INDEX IF NOT EXISTS `ix_entries_open_unique`
  ON `entries` (`place_id`)
  WHERE `ended_at` IS NULL AND `deleted_at` IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_entries_ongoing`
  ON `entries` (`ended_at`, `deleted_at`, `started_at` DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_entries_started_at`
  ON `entries` (`started_at`, `deleted_at`);
--> statement-breakpoint
-- pending_transitions → places CASCADE
CREATE TABLE `pending_transitions_new` (
  `id` text PRIMARY KEY NOT NULL,
  `place_id` text NOT NULL,
  `kind` text NOT NULL,
  `region_event_at` integer NOT NULL,
  `confirm_at` integer NOT NULL,
  `resolved_at` integer,
  `outcome` text,
  FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `pending_transitions_new` SELECT * FROM `pending_transitions`;
--> statement-breakpoint
DROP TABLE `pending_transitions`;
--> statement-breakpoint
ALTER TABLE `pending_transitions_new` RENAME TO `pending_transitions`;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ix_pending_unresolved`
  ON `pending_transitions` (`resolved_at`, `region_event_at` DESC);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
