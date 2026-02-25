CREATE TABLE `memories` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`tags` text,
	`salience` real DEFAULT 1 NOT NULL,
	`source` text NOT NULL,
	`channel_id` text,
	`created_at` integer NOT NULL,
	`last_accessed_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_memories_type` ON `memories` (`type`);--> statement-breakpoint
CREATE INDEX `idx_memories_salience` ON `memories` (`salience`);--> statement-breakpoint
CREATE INDEX `idx_memories_last_accessed` ON `memories` (`last_accessed_at`);