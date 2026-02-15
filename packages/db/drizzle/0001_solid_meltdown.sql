CREATE TABLE `request_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`platform` text NOT NULL,
	`channel_id` text NOT NULL,
	`user_id` text,
	`user_message` text NOT NULL,
	`assistant_reply` text NOT NULL,
	`cost_usd` real,
	`claude_session_id` text,
	`duration_ms` integer,
	`created_at` integer NOT NULL
);
