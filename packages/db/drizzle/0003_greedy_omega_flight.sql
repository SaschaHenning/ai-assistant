CREATE TABLE `scheduled_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`prompt` text NOT NULL,
	`cron_expression` text NOT NULL,
	`timezone` text DEFAULT 'Europe/Berlin' NOT NULL,
	`platform` text NOT NULL,
	`channel_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`last_run_at` integer,
	`last_run_status` text,
	`last_run_error` text,
	`next_run_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
