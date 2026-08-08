CREATE TABLE `concierge_config` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`elevenlabs_agent_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `concierge_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`title` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`elevenlabs_agent_id` text NOT NULL,
	`elevenlabs_conversation_id` text,
	`communication_style` text DEFAULT 'balanced' NOT NULL,
	`explanation_level` integer DEFAULT 50 NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`duration_ms` integer,
	`transcript` text DEFAULT '[]' NOT NULL,
	`clinical_context` text DEFAULT '{}' NOT NULL,
	`resolution` text,
	`events` text DEFAULT '[]' NOT NULL,
	`metrics` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
