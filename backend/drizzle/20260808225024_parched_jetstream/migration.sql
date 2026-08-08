CREATE TABLE `level4_agents` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`key` text DEFAULT 'daphne_v2' NOT NULL UNIQUE,
	`display_name` text NOT NULL,
	`elevenlabs_agent_id` text NOT NULL,
	`exa_web_search_tool_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `level4_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`agent_id` integer NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`memory_bank` text DEFAULT '' NOT NULL,
	`elevenlabs_agent_id` text NOT NULL,
	`elevenlabs_conversation_id` text,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`duration_ms` integer,
	`transcript` text DEFAULT '[]' NOT NULL,
	`clinical_context` text DEFAULT '{}' NOT NULL,
	`resolution` text,
	`events` text DEFAULT '[]' NOT NULL,
	`metrics` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_level4_sessions_agent_id_level4_agents_id_fk` FOREIGN KEY (`agent_id`) REFERENCES `level4_agents`(`id`) ON DELETE CASCADE
);
