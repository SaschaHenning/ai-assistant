CREATE TABLE `channels` (
	`id` text PRIMARY KEY NOT NULL,
	`platform` text NOT NULL,
	`external_id` text NOT NULL,
	`session_id` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`platform` text NOT NULL,
	`user_id` text,
	`tool_calls` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`claude_session_id` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `skills` (
	`name` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`description` text NOT NULL,
	`type` text NOT NULL,
	`version` text NOT NULL,
	`generated` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL
);
