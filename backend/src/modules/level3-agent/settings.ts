/** Level 3 agent knobs: typed harness dials plus optional free-text overrides. */

export const COMMUNICATION_STYLES = ["patient", "balanced", "direct"] as const;
export type CommunicationStyle = (typeof COMMUNICATION_STYLES)[number];

export const EXPLANATION_LEVELS = [
  "minimal",
  "concise",
  "balanced",
  "detailed",
  "thorough",
] as const;
export type ExplanationLevel = (typeof EXPLANATION_LEVELS)[number];

export const SAFETY_POSTURES = ["conservative", "balanced", "assertive"] as const;
export type SafetyPosture = (typeof SAFETY_POSTURES)[number];

export const RESOLUTION_BIASES = ["fewest_steps", "thorough_intake"] as const;
export type ResolutionBias = (typeof RESOLUTION_BIASES)[number];

export const TURN_EAGERNESS_OPTIONS = ["patient", "normal", "eager"] as const;
export type TurnEagerness = (typeof TURN_EAGERNESS_OPTIONS)[number];

export const VOICE_PRESETS = ["sarah", "jessica", "george", "brian", "laura"] as const;
export type VoicePreset = (typeof VOICE_PRESETS)[number];

export const TTS_MODELS = ["eleven_flash_v2", "eleven_turbo_v2"] as const;
export type TtsModel = (typeof TTS_MODELS)[number];

export const LLM_OPTIONS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gpt-4o-mini",
  "gpt-4.1-mini",
  "claude-haiku-4-5",
] as const;
export type LlmOption = (typeof LLM_OPTIONS)[number];

export const INTERRUPTION_MODES = [
  "allow",
  "ignore_backchannels",
  "protect_tools",
] as const;
export type InterruptionMode = (typeof INTERRUPTION_MODES)[number];

export const PERSONA_PRESETS = ["mira", "alex", "jordan", "sam"] as const;
export type PersonaPreset = (typeof PERSONA_PRESETS)[number];

export const PROMPT_PROFILES = [
  "warm_empathetic",
  "efficient_triage",
  "calm_navigator",
] as const;
export type PromptProfile = (typeof PROMPT_PROFILES)[number];

export const TOOL_OPTIONS = [
  "update_clinical_context",
  "schedule_follow_up",
  "submit_pharmacy_request",
  "confirm_next_step",
  "request_human_handoff",
  "flag_watch_event",
] as const;
export type ToolOption = (typeof TOOL_OPTIONS)[number];

export const VARIANT_LABELS = [
  "alpha",
  "beta",
  "pilot",
  "staging",
  "production",
  "experiment_a",
  "experiment_b",
] as const;
export type VariantLabel = (typeof VARIANT_LABELS)[number];

export type Level3AgentSettings = {
  variantLabel: VariantLabel;
  communicationStyle: CommunicationStyle;
  explanationLevel: ExplanationLevel;
  safetyPosture: SafetyPosture;
  resolutionBias: ResolutionBias;
  turnEagerness: TurnEagerness;
  voicePreset: VoicePreset;
  ttsModel: TtsModel;
  llm: LlmOption;
  interruptionMode: InterruptionMode;
  personaPreset: PersonaPreset;
  promptProfile: PromptProfile;
  enabledTools: ToolOption[];
  /** Empty = compose from dials on save/sync. */
  displayName: string;
  /** Empty = compose from dials on sync. */
  systemPrompt: string;
  /** Empty = persona preset first message on sync. */
  firstMessage: string;
  /** Empty = built-in clinical keyword defaults. */
  asrKeywords: string[];
  /** Empty = mode defaults (backchannels when ignore_backchannels). */
  interruptionIgnoreTerms: string[];
  /** Optional extra custom guardrail instruction. */
  extraGuardrailPrompt: string;
};

export const DEFAULT_ASR_KEYWORDS = [
  "medication",
  "pharmacy",
  "Walgreens",
  "CVS",
  "refill",
  "symptom",
  "follow-up",
] as const;

export const DEFAULT_LEVEL3_SETTINGS: Level3AgentSettings = {
  variantLabel: "alpha",
  communicationStyle: "balanced",
  explanationLevel: "balanced",
  safetyPosture: "balanced",
  resolutionBias: "fewest_steps",
  turnEagerness: "normal",
  voicePreset: "sarah",
  ttsModel: "eleven_flash_v2",
  llm: "gemini-2.5-flash",
  interruptionMode: "ignore_backchannels",
  personaPreset: "mira",
  promptProfile: "warm_empathetic",
  enabledTools: [...TOOL_OPTIONS],
  displayName: "",
  systemPrompt: "",
  firstMessage: "",
  asrKeywords: [...DEFAULT_ASR_KEYWORDS],
  interruptionIgnoreTerms: [],
  extraGuardrailPrompt: "",
};

export const EXPLANATION_LEVEL_VALUES: Record<ExplanationLevel, number> = {
  minimal: 0,
  concise: 25,
  balanced: 50,
  detailed: 75,
  thorough: 100,
};

/** Premade voice IDs verified against the ElevenLabs Voices API. */
export const VOICE_PRESET_IDS: Record<VoicePreset, string> = {
  sarah: "EXAVITQu4vr4xnSDxMaL",
  jessica: "cgSgspJ2msm6clMCkdW9",
  george: "JBFqnCBsd6RMkjVDRZzb",
  brian: "nPczCjzI2devNBz1zQrb",
  laura: "FGY2WhTYpPnrIDTdsKH5",
};

export const PERSONA_PRESET_META: Record<
  PersonaPreset,
  { displayName: string; firstMessage: string; roleLabel: string }
> = {
  mira: {
    displayName: "Mira",
    roleLabel: "concierge care guide",
    firstMessage:
      "Hi, I'm Mira, your concierge care guide. I'm here to listen and help you take a clear next step — not to diagnose. What's going on today?",
  },
  alex: {
    displayName: "Alex",
    roleLabel: "care navigator",
    firstMessage:
      "Hi, I'm Alex. I'll help you sort out what's going on and land on a safe next step — not a diagnosis. What brought you in today?",
  },
  jordan: {
    displayName: "Jordan",
    roleLabel: "triage concierge",
    firstMessage:
      "Hey, I'm Jordan. Let's gather what matters and pick the shortest safe path forward. What are you dealing with right now?",
  },
  sam: {
    displayName: "Sam",
    roleLabel: "wellness concierge",
    firstMessage:
      "Hi, I'm Sam. I'm here to listen carefully and help reduce uncertainty with a concrete next step. What's on your mind?",
  },
};

export const PROMPT_PROFILE_META: Record<
  PromptProfile,
  { label: string; personality: string; toneBias: string }
> = {
  warm_empathetic: {
    label: "Warm empathetic",
    personality:
      "warm, calm, carefully precise, and never rushed into false certainty",
    toneBias:
      "Lead with validation. Slow down for anxious callers. Keep language soft but clear.",
  },
  efficient_triage: {
    label: "Efficient triage",
    personality:
      "crisp, organized, and focused on extracting decision-critical facts quickly",
    toneBias:
      "Stay kind but efficient. Prefer short turns and clear questions. Minimize small talk.",
  },
  calm_navigator: {
    label: "Calm navigator",
    personality:
      "steady, reassuring, and oriented toward reducing worry with transparent next steps",
    toneBias:
      "Narrate the path briefly. Keep callers oriented. Avoid urgency unless safety requires it.",
  },
};

export const BACKCHANNEL_IGNORE_TERMS = [
  "uh huh",
  "uh-huh",
  "mm hmm",
  "mm-hmm",
  "mhm",
  "gotcha",
  "got it",
  "okay",
  "ok",
  "yeah",
  "yep",
  "right",
  "understood",
];

export function explanationLevelNumber(level: ExplanationLevel): number {
  return EXPLANATION_LEVEL_VALUES[level];
}

export function composeAgentDisplayName(settings: Level3AgentSettings): string {
  const persona = PERSONA_PRESET_META[settings.personaPreset].displayName;
  const profile = PROMPT_PROFILE_META[settings.promptProfile].label;
  return `${persona} · ${profile} · ${settings.variantLabel}`;
}

export function normalizeEnabledTools(tools: ToolOption[]): ToolOption[] {
  const unique = Array.from(new Set(tools));
  return TOOL_OPTIONS.filter((tool) => unique.includes(tool));
}

export function normalizeStringList(values: string[] | undefined, max = 50): string[] {
  if (!values?.length) return [];
  const cleaned = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .slice(0, max);
  return Array.from(new Set(cleaned));
}
