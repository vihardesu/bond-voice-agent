import {
  composeLevel3Defaults,
  resolveAsrKeywords,
  resolveDisplayName,
  resolveFirstMessage,
  resolveInterruptionIgnoreTerms,
  resolveSystemPrompt,
} from "../level3-agent/prompt.js";
import { LEVEL4_PROMPT_APPENDIX } from "./daphne-v2.js";
import type { Level4AgentSettings } from "./settings.js";

export {
  resolveAsrKeywords,
  resolveDisplayName,
  resolveFirstMessage,
  resolveInterruptionIgnoreTerms,
};

export function resolveLevel4SystemPrompt(settings: Level4AgentSettings): string {
  const core = resolveSystemPrompt(settings).trim();
  return `${core}\n\n${LEVEL4_PROMPT_APPENDIX}`;
}

export function buildLevel4AgentRemoteName(settings: Level4AgentSettings): string {
  return `Bond L4 · ${resolveDisplayName(settings)}`;
}

export function composeLevel4Defaults(settings: Level4AgentSettings): {
  displayName: string;
  systemPrompt: string;
  firstMessage: string;
  asrKeywords: string[];
  interruptionIgnoreTerms: string[];
} {
  const composed = composeLevel3Defaults(settings);
  return {
    ...composed,
    systemPrompt: `${composed.systemPrompt.trim()}\n\n${LEVEL4_PROMPT_APPENDIX}`,
  };
}
