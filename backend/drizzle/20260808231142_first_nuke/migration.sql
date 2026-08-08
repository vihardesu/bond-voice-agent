ALTER TABLE `level4_agents` ADD `variant_label` text DEFAULT 'alpha' NOT NULL;--> statement-breakpoint
ALTER TABLE `level4_agents` ADD `communication_style` text DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE `level4_agents` ADD `explanation_level` text DEFAULT 'minimal' NOT NULL;--> statement-breakpoint
ALTER TABLE `level4_agents` ADD `safety_posture` text DEFAULT 'balanced' NOT NULL;--> statement-breakpoint
ALTER TABLE `level4_agents` ADD `resolution_bias` text DEFAULT 'fewest_steps' NOT NULL;--> statement-breakpoint
ALTER TABLE `level4_agents` ADD `turn_eagerness` text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `level4_agents` ADD `voice_preset` text DEFAULT 'sarah' NOT NULL;--> statement-breakpoint
ALTER TABLE `level4_agents` ADD `tts_model` text DEFAULT 'eleven_flash_v2' NOT NULL;--> statement-breakpoint
ALTER TABLE `level4_agents` ADD `llm` text DEFAULT 'qwen36-35b-a3b' NOT NULL;--> statement-breakpoint
ALTER TABLE `level4_agents` ADD `interruption_mode` text DEFAULT 'protect_tools' NOT NULL;--> statement-breakpoint
ALTER TABLE `level4_agents` ADD `persona_preset` text DEFAULT 'sam' NOT NULL;--> statement-breakpoint
ALTER TABLE `level4_agents` ADD `prompt_profile` text DEFAULT 'warm_empathetic' NOT NULL;--> statement-breakpoint
ALTER TABLE `level4_agents` ADD `enabled_tools` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `level4_agents` ADD `system_prompt` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `level4_agents` ADD `first_message` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `level4_agents` ADD `asr_keywords` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `level4_agents` ADD `interruption_ignore_terms` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `level4_agents` ADD `extra_guardrail_prompt` text DEFAULT '' NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_level4_agents` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`display_name` text NOT NULL,
	`variant_label` text DEFAULT 'alpha' NOT NULL,
	`elevenlabs_agent_id` text NOT NULL,
	`communication_style` text DEFAULT 'direct' NOT NULL,
	`explanation_level` text DEFAULT 'minimal' NOT NULL,
	`safety_posture` text DEFAULT 'balanced' NOT NULL,
	`resolution_bias` text DEFAULT 'fewest_steps' NOT NULL,
	`turn_eagerness` text DEFAULT 'normal' NOT NULL,
	`voice_preset` text DEFAULT 'sarah' NOT NULL,
	`tts_model` text DEFAULT 'eleven_flash_v2' NOT NULL,
	`llm` text DEFAULT 'qwen36-35b-a3b' NOT NULL,
	`interruption_mode` text DEFAULT 'protect_tools' NOT NULL,
	`persona_preset` text DEFAULT 'sam' NOT NULL,
	`prompt_profile` text DEFAULT 'warm_empathetic' NOT NULL,
	`enabled_tools` text DEFAULT '[]' NOT NULL,
	`system_prompt` text DEFAULT '' NOT NULL,
	`first_message` text DEFAULT '' NOT NULL,
	`asr_keywords` text DEFAULT '[]' NOT NULL,
	`interruption_ignore_terms` text DEFAULT '[]' NOT NULL,
	`extra_guardrail_prompt` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_level4_agents`(
	`id`,
	`display_name`,
	`variant_label`,
	`elevenlabs_agent_id`,
	`communication_style`,
	`explanation_level`,
	`safety_posture`,
	`resolution_bias`,
	`turn_eagerness`,
	`voice_preset`,
	`tts_model`,
	`llm`,
	`interruption_mode`,
	`persona_preset`,
	`prompt_profile`,
	`enabled_tools`,
	`system_prompt`,
	`first_message`,
	`asr_keywords`,
	`interruption_ignore_terms`,
	`extra_guardrail_prompt`,
	`created_at`,
	`updated_at`
)
SELECT
	`id`,
	`display_name`,
	COALESCE(`variant_label`, 'alpha'),
	`elevenlabs_agent_id`,
	COALESCE(`communication_style`, 'direct'),
	COALESCE(`explanation_level`, 'minimal'),
	COALESCE(`safety_posture`, 'balanced'),
	COALESCE(`resolution_bias`, 'fewest_steps'),
	COALESCE(`turn_eagerness`, 'normal'),
	COALESCE(`voice_preset`, 'sarah'),
	COALESCE(`tts_model`, 'eleven_flash_v2'),
	COALESCE(`llm`, 'qwen36-35b-a3b'),
	COALESCE(`interruption_mode`, 'protect_tools'),
	COALESCE(`persona_preset`, 'sam'),
	COALESCE(`prompt_profile`, 'warm_empathetic'),
	CASE
		WHEN `enabled_tools` IS NULL OR `enabled_tools` = '' OR `enabled_tools` = '[]'
		THEN '["update_clinical_context","schedule_follow_up","submit_pharmacy_request","confirm_next_step","request_human_handoff","flag_watch_event"]'
		ELSE `enabled_tools`
	END,
	COALESCE(`system_prompt`, ''),
	COALESCE(`first_message`, ''),
	CASE
		WHEN `asr_keywords` IS NULL OR `asr_keywords` = '' OR `asr_keywords` = '[]'
		THEN '["medication","pharmacy","Walgreens","CVS","refill","symptom","follow-up"]'
		ELSE `asr_keywords`
	END,
	CASE
		WHEN `interruption_ignore_terms` IS NULL OR `interruption_ignore_terms` = '' OR `interruption_ignore_terms` = '[]'
		THEN '["uh huh","uh-huh","mm hmm","mm-hmm","mhm","gotcha","got it","okay","ok","yeah","yep","right","understood"]'
		ELSE `interruption_ignore_terms`
	END,
	COALESCE(`extra_guardrail_prompt`, ''),
	`created_at`,
	`updated_at`
FROM `level4_agents`;--> statement-breakpoint
DROP TABLE `level4_agents`;--> statement-breakpoint
ALTER TABLE `__new_level4_agents` RENAME TO `level4_agents`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
UPDATE `level4_agents`
SET
	`first_message` = CASE
		WHEN TRIM(`first_message`) = '' THEN 'Hi, I''m Daphne. I''m your personal health concierge. How can I help?'
		ELSE `first_message`
	END,
	`enabled_tools` = CASE
		WHEN `enabled_tools` = '' OR `enabled_tools` = '[]'
		THEN '["update_clinical_context","schedule_follow_up","submit_pharmacy_request","confirm_next_step","request_human_handoff","flag_watch_event"]'
		ELSE `enabled_tools`
	END;