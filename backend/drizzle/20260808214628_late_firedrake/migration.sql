ALTER TABLE `level3_agents` ADD `system_prompt` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `level3_agents` ADD `first_message` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `level3_agents` ADD `asr_keywords` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `level3_agents` ADD `interruption_ignore_terms` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `level3_agents` ADD `extra_guardrail_prompt` text DEFAULT '' NOT NULL;