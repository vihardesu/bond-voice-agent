export const VARIANT_LABELS = [
  "alpha",
  "beta",
  "pilot",
  "staging",
  "production",
  "experiment_a",
  "experiment_b",
] as const;

export const COMMUNICATION_STYLES = ["patient", "balanced", "direct"] as const;
export const EXPLANATION_LEVELS = [
  "minimal",
  "concise",
  "balanced",
  "detailed",
  "thorough",
] as const;
export const SAFETY_POSTURES = ["conservative", "balanced", "assertive"] as const;
export const RESOLUTION_BIASES = ["fewest_steps", "thorough_intake"] as const;
export const TURN_EAGERNESS_OPTIONS = ["patient", "normal", "eager"] as const;
export const VOICE_PRESETS = ["sarah", "rachel", "george", "brian", "laura"] as const;
export const TTS_MODELS = ["eleven_flash_v2", "eleven_turbo_v2"] as const;
export const LLM_OPTIONS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gpt-4o-mini",
  "gpt-4.1-mini",
  "claude-haiku-4-5",
] as const;
export const INTERRUPTION_MODES = [
  "allow",
  "ignore_backchannels",
  "protect_tools",
] as const;
export const PERSONA_PRESETS = ["mira", "alex", "jordan", "sam"] as const;
export const PROMPT_PROFILES = [
  "warm_empathetic",
  "efficient_triage",
  "calm_navigator",
] as const;
export const TOOL_OPTIONS = [
  "update_clinical_context",
  "schedule_follow_up",
  "submit_pharmacy_request",
  "confirm_next_step",
  "request_human_handoff",
  "flag_watch_event",
] as const;

export type Level3DraftSettings = {
  variantLabel: (typeof VARIANT_LABELS)[number];
  communicationStyle: (typeof COMMUNICATION_STYLES)[number];
  explanationLevel: (typeof EXPLANATION_LEVELS)[number];
  safetyPosture: (typeof SAFETY_POSTURES)[number];
  resolutionBias: (typeof RESOLUTION_BIASES)[number];
  turnEagerness: (typeof TURN_EAGERNESS_OPTIONS)[number];
  voicePreset: (typeof VOICE_PRESETS)[number];
  ttsModel: (typeof TTS_MODELS)[number];
  llm: (typeof LLM_OPTIONS)[number];
  interruptionMode: (typeof INTERRUPTION_MODES)[number];
  personaPreset: (typeof PERSONA_PRESETS)[number];
  promptProfile: (typeof PROMPT_PROFILES)[number];
  enabledTools: Array<(typeof TOOL_OPTIONS)[number]>;
};

export const DEFAULT_DRAFT_SETTINGS: Level3DraftSettings = {
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
};

export const LABELS = {
  variantLabel: {
    alpha: "Alpha",
    beta: "Beta",
    pilot: "Pilot",
    staging: "Staging",
    production: "Production",
    experiment_a: "Experiment A",
    experiment_b: "Experiment B",
  },
  communicationStyle: {
    patient: "Patient — more validation",
    balanced: "Balanced",
    direct: "Direct — concise",
  },
  explanationLevel: {
    minimal: "Minimal (assume context)",
    concise: "Concise",
    balanced: "Balanced",
    detailed: "Detailed",
    thorough: "Thorough (explain every step)",
  },
  safetyPosture: {
    conservative: "Conservative — ask / hand off early",
    balanced: "Balanced",
    assertive: "Assertive — move to next step sooner",
  },
  resolutionBias: {
    fewest_steps: "Fewest steps",
    thorough_intake: "Thorough intake first",
  },
  turnEagerness: {
    patient: "Patient (waits longer)",
    normal: "Normal",
    eager: "Eager (responds sooner)",
  },
  voicePreset: {
    sarah: "Sarah",
    rachel: "Rachel",
    george: "George",
    brian: "Brian",
    laura: "Laura",
  },
  ttsModel: {
    eleven_flash_v2: "Flash v2 (lowest latency)",
    eleven_turbo_v2: "Turbo v2 (higher quality)",
  },
  llm: {
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite",
    "gpt-4o-mini": "GPT-4o Mini",
    "gpt-4.1-mini": "GPT-4.1 Mini",
    "claude-haiku-4-5": "Claude Haiku 4.5",
  },
  interruptionMode: {
    allow: "Allow barge-in freely",
    ignore_backchannels: "Ignore backchannels (uh-huh, gotcha)",
    protect_tools: "Protect tool turns from barge-in",
  },
  personaPreset: {
    mira: "Mira — concierge care guide",
    alex: "Alex — care navigator",
    jordan: "Jordan — triage concierge",
    sam: "Sam — wellness concierge",
  },
  promptProfile: {
    warm_empathetic: "Warm empathetic",
    efficient_triage: "Efficient triage",
    calm_navigator: "Calm navigator",
  },
  enabledTools: {
    update_clinical_context: "Update clinical context",
    schedule_follow_up: "Schedule follow-up (mock)",
    submit_pharmacy_request: "Pharmacy request (mock)",
    confirm_next_step: "Confirm next step",
    request_human_handoff: "Human handoff",
    flag_watch_event: "Flag watch event",
  },
} as const;
