CREATE TABLE `speech_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`title` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`model` text DEFAULT 'gpt-realtime-2.1' NOT NULL,
	`voice` text DEFAULT 'marin' NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`duration_ms` integer,
	`transcript` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
