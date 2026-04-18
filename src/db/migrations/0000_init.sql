CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `entries` (
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
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `kv` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pending_transitions` (
	`id` text PRIMARY KEY NOT NULL,
	`place_id` text NOT NULL,
	`kind` text NOT NULL,
	`region_event_at` integer NOT NULL,
	`confirm_at` integer NOT NULL,
	`resolved_at` integer,
	`outcome` text,
	FOREIGN KEY (`place_id`) REFERENCES `places`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `places` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`radius_m` integer DEFAULT 100 NOT NULL,
	`entry_buffer_s` integer DEFAULT 300 NOT NULL,
	`exit_buffer_s` integer DEFAULT 180 NOT NULL,
	`category_id` text,
	`color` text NOT NULL,
	`icon` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
