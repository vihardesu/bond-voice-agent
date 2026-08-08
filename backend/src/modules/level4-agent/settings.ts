/**
 * Level 4 uses the same typed harness dials as Level 3.
 * Defaults seed from the proven Daphne v2 snapshot.
 */

export {
  BACKCHANNEL_IGNORE_TERMS,
  COMMUNICATION_STYLES,
  composeAgentDisplayName,
  DEFAULT_ASR_KEYWORDS,
  EXPLANATION_LEVEL_VALUES,
  EXPLANATION_LEVELS,
  explanationLevelNumber,
  INTERRUPTION_MODES,
  LLM_OPTIONS,
  normalizeEnabledTools,
  normalizeStringList,
  PERSONA_PRESET_META,
  PERSONA_PRESETS,
  PROMPT_PROFILE_META,
  PROMPT_PROFILES,
  RESOLUTION_BIASES,
  SAFETY_POSTURES,
  TOOL_OPTIONS,
  TTS_MODELS,
  TURN_EAGERNESS_OPTIONS,
  VARIANT_LABELS,
  VOICE_PRESET_IDS,
  VOICE_PRESETS,
  type CommunicationStyle,
  type ExplanationLevel,
  type InterruptionMode,
  type Level3AgentSettings as Level4AgentSettings,
  type LlmOption,
  type PersonaPreset,
  type PromptProfile,
  type ResolutionBias,
  type SafetyPosture,
  type ToolOption,
  type TtsModel,
  type TurnEagerness,
  type VariantLabel,
  type VoicePreset,
} from "../level3-agent/settings.js";

import { TOOL_OPTIONS, type Level3AgentSettings } from "../level3-agent/settings.js";
import {
  DAPHNE_V2_DISPLAY_NAME,
  DAPHNE_V2_FIRST_MESSAGE,
  DAPHNE_V2_SETTINGS,
  DAPHNE_V2_SYSTEM_PROMPT,
} from "./daphne-v2.js";

export const DEFAULT_LEVEL4_SETTINGS: Level3AgentSettings = {
  displayName: DAPHNE_V2_DISPLAY_NAME,
  variantLabel: DAPHNE_V2_SETTINGS.variantLabel,
  communicationStyle: DAPHNE_V2_SETTINGS.communicationStyle,
  explanationLevel: DAPHNE_V2_SETTINGS.explanationLevel,
  safetyPosture: DAPHNE_V2_SETTINGS.safetyPosture,
  resolutionBias: DAPHNE_V2_SETTINGS.resolutionBias,
  turnEagerness: DAPHNE_V2_SETTINGS.turnEagerness,
  voicePreset: DAPHNE_V2_SETTINGS.voicePreset,
  ttsModel: DAPHNE_V2_SETTINGS.ttsModel,
  llm: DAPHNE_V2_SETTINGS.llm,
  interruptionMode: DAPHNE_V2_SETTINGS.interruptionMode,
  personaPreset: DAPHNE_V2_SETTINGS.personaPreset,
  promptProfile: DAPHNE_V2_SETTINGS.promptProfile,
  enabledTools: [...DAPHNE_V2_SETTINGS.enabledTools],
  systemPrompt: DAPHNE_V2_SYSTEM_PROMPT,
  firstMessage: DAPHNE_V2_FIRST_MESSAGE,
  asrKeywords: [...DAPHNE_V2_SETTINGS.asrKeywords],
  interruptionIgnoreTerms: [...DAPHNE_V2_SETTINGS.interruptionIgnoreTerms],
  extraGuardrailPrompt: DAPHNE_V2_SETTINGS.extraGuardrailPrompt,
};

/** Fallback when a stored tool list is empty/corrupt. */
export const DEFAULT_ENABLED_TOOLS = [...TOOL_OPTIONS];
