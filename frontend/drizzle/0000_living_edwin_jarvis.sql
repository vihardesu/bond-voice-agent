CREATE TABLE `conversation_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transcript_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`sequence` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `conversation_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
