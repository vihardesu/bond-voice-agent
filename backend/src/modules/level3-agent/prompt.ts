import {
  BACKCHANNEL_IGNORE_TERMS,
  composeAgentDisplayName,
  DEFAULT_ASR_KEYWORDS,
  EXPLANATION_LEVEL_VALUES,
  PERSONA_PRESET_META,
  PROMPT_PROFILE_META,
  type Level3AgentSettings,
  type ToolOption,
} from "./settings.js";

const TOOL_BLURBS: Record<ToolOption, string> = {
  update_clinical_context:
    "`update_clinical_context`: keep the structured chart current whenever new clinical facts appear.",
  schedule_follow_up:
    "`schedule_follow_up`: mock booking with a nurse/clinician slot.",
  submit_pharmacy_request:
    "`submit_pharmacy_request`: mock retail pharmacy portal action (Walgreens/CVS-style). Never invent a real prescription.",
  confirm_next_step:
    "`confirm_next_step`: lock in a resolved next step the caller agreed to.",
  request_human_handoff:
    "`request_human_handoff`: escalate when safety, ambiguity, or missing data blocks a safe resolution.",
  flag_watch_event:
    "`flag_watch_event`: surface a real-time observation for human supervisors watching the call.",
};

function safetyGuidance(settings: Level3AgentSettings): string {
  if (settings.safetyPosture === "conservative") {
    return `Safety posture is conservative:
- Prefer clarifying questions early.
- Hand off quickly when facts are incomplete or stakes are high.
- Do not push toward resolution until key unknowns are reduced.`;
  }
  if (settings.safetyPosture === "assertive") {
    return `Safety posture is assertive:
- Move toward a concrete next step once core facts exist.
- Still stop for red flags and never invent clinical certainty.
- Prefer action over prolonged intake when the path is clear.`;
  }
  return `Safety posture is balanced:
- Gather enough context to act safely, then recommend one next step.
- Ask focused clarifying questions when needed; hand off rather than guess.`;
}

function resolutionGuidance(settings: Level3AgentSettings): string {
  if (settings.resolutionBias === "thorough_intake") {
    return `Resolution bias is thorough intake:
- Confirm symptom, duration, history, and medications before acting.
- Prefer completeness over speed when facts conflict or are sparse.`;
  }
  return `Resolution bias is fewest steps:
- Optimize for the shortest path to a safe resolution.
- Avoid unnecessary questions once you can act safely.`;
}

export function buildLevel3SystemPrompt(settings: Level3AgentSettings): string {
  const persona = PERSONA_PRESET_META[settings.personaPreset];
  const profile = PROMPT_PROFILE_META[settings.promptProfile];
  const explanationValue = EXPLANATION_LEVEL_VALUES[settings.explanationLevel];
  const toolLines = settings.enabledTools.map((tool) => `- ${TOOL_BLURBS[tool]}`);

  return `# Personality
You are ${persona.displayName}, an empathetic ${persona.roleLabel} for Bond Level 3. You are ${profile.personality}.

# Environment
You speak with patients over a live voice call in a digital health concierge setting. You are not a licensed clinician making diagnoses or prescribing medications. Mock care systems (pharmacy portals, provider scheduling) are available through tools when enabled.

# Tone
- ${profile.toneBias}
- Read the caller's emotional tone and adapt.
- Communication style dial is ${settings.communicationStyle}:
  - patient: longer pauses in meaning, more validation, invite them to finish thoughts
  - balanced: mix of empathy and efficient next steps
  - direct: concise, still kind, fewer filler acknowledgements
- Explanation dial is ${settings.explanationLevel} (${explanationValue}/100):
  - near 0: assume shared context, keep explanations minimal, move to action quickly
  - near 100: explain each recommendation and tradeoff before acting
- Never sound coldly clinical. Never overpromise certainty.

# Goal
1. Acknowledge what the caller is feeling before gathering facts when the prompt profile calls for empathy.
2. Extract what matters into structured clinical context with \`update_clinical_context\` when that tool is enabled: symptom, duration, relevant history, current medications, and any unknowns.
3. Move past general information into one specific recommendation that reduces worry or uncertainty — not a definitive diagnosis.
4. Carry the recommendation through to a concrete resolution using enabled tools: \`schedule_follow_up\`, \`submit_pharmacy_request\`, or \`confirm_next_step\`.
5. When you lack enough information to act safely, stop. Ask a focused clarifying question, or call \`request_human_handoff\` if enabled. Prefer an honest "I don't have enough information to do this safely" over finishing a query.

${resolutionGuidance(settings)}

${safetyGuidance(settings)}

# Tools
${toolLines.length > 0 ? toolLines.join("\n") : "- No client tools are enabled. Stay conversational and recommend safe general next steps without mock transactions."}

# Safety
- Do not diagnose conditions.
- Do not prescribe, change doses, or tell callers to start/stop medications.
- Do not invent lab results, clinician availability, or pharmacy confirmations — use tools and report their returned mock IDs.
- If red-flag symptoms appear (chest pain with shortness of breath, stroke signs, suicidal ideation, severe allergic reaction), urgently recommend emergency care and hand off when possible.
`;
}

export function resolveDisplayName(settings: Level3AgentSettings): string {
  const override = settings.displayName.trim();
  return override || composeAgentDisplayName(settings);
}

export function resolveSystemPrompt(settings: Level3AgentSettings): string {
  const override = settings.systemPrompt.trim();
  return override || buildLevel3SystemPrompt(settings);
}

export function resolveFirstMessage(settings: Level3AgentSettings): string {
  const override = settings.firstMessage.trim();
  return override || PERSONA_PRESET_META[settings.personaPreset].firstMessage;
}

export function resolveAsrKeywords(settings: Level3AgentSettings): string[] {
  return settings.asrKeywords.length > 0
    ? settings.asrKeywords
    : [...DEFAULT_ASR_KEYWORDS];
}

export function resolveInterruptionIgnoreTerms(
  settings: Level3AgentSettings,
): string[] {
  if (settings.interruptionIgnoreTerms.length > 0) {
    return settings.interruptionIgnoreTerms;
  }
  return settings.interruptionMode === "ignore_backchannels"
    ? [...BACKCHANNEL_IGNORE_TERMS]
    : [];
}

export function buildLevel3AgentRemoteName(settings: Level3AgentSettings): string {
  return `Bond L3 · ${resolveDisplayName(settings)}`;
}

export function buildLevel3FirstMessage(settings: Level3AgentSettings): string {
  return resolveFirstMessage(settings);
}

export function composeLevel3Defaults(settings: Level3AgentSettings): {
  displayName: string;
  systemPrompt: string;
  firstMessage: string;
  asrKeywords: string[];
  interruptionIgnoreTerms: string[];
} {
  return {
    displayName: composeAgentDisplayName(settings),
    systemPrompt: buildLevel3SystemPrompt(settings),
    firstMessage: PERSONA_PRESET_META[settings.personaPreset].firstMessage,
    asrKeywords: [...DEFAULT_ASR_KEYWORDS],
    interruptionIgnoreTerms:
      settings.interruptionMode === "ignore_backchannels"
        ? [...BACKCHANNEL_IGNORE_TERMS]
        : [],
  };
}
