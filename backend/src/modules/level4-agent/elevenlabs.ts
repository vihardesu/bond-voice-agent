import { ElevenLabsClient, type ElevenLabs } from "@elevenlabs/elevenlabs-js";

import { summarizeMemoryBank } from "./daphne-v2.js";
import {
  buildLevel4AgentRemoteName,
  resolveAsrKeywords,
  resolveFirstMessage,
  resolveInterruptionIgnoreTerms,
  resolveLevel4SystemPrompt,
} from "./prompt.js";
import {
  explanationLevelNumber,
  VOICE_PRESET_IDS,
  type Level4AgentSettings,
} from "./settings.js";
import { buildLevel4ClientTools, buildLevel4ExaWebSearchTool } from "./tools.js";

function getApiKey(): string {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }
  return apiKey;
}

function getExaApiKey(): string {
  const apiKey = process.env.EXA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("EXA_API_KEY is not configured");
  }
  return apiKey;
}

function getClient(): ElevenLabsClient {
  return new ElevenLabsClient({ apiKey: getApiKey() });
}

export function formatElevenLabsError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const withBody = error as Error & {
    statusCode?: number;
    body?: unknown;
  };

  const detail =
    withBody.body &&
    typeof withBody.body === "object" &&
    withBody.body !== null &&
    "detail" in withBody.body
      ? (withBody.body as { detail?: unknown }).detail
      : undefined;

  if (detail && typeof detail === "object" && detail !== null) {
    const message =
      "message" in detail && typeof detail.message === "string"
        ? detail.message
        : null;
    const status =
      "status" in detail && typeof detail.status === "string"
        ? detail.status
        : null;
    if (message) {
      return status ? `${status}: ${message}` : message;
    }
  }

  const match = error.message.match(/Body:\s*(\{[\s\S]*\})\s*$/);
  if (match?.[1]) {
    try {
      const parsed = JSON.parse(match[1]) as {
        detail?: { message?: string; status?: string };
      };
      if (parsed.detail?.message) {
        return parsed.detail.status
          ? `${parsed.detail.status}: ${parsed.detail.message}`
          : parsed.detail.message;
      }
    } catch {
      // fall through
    }
  }

  return error.message;
}

function endCallTool(): ElevenLabs.SystemToolConfigInput {
  return {
    name: "end_call",
    params: {
      systemToolType: "end_call",
    },
  };
}

function agentConversationConfig(
  settings: Level4AgentSettings,
): ElevenLabs.ConversationalConfig {
  const tools = [
    ...buildLevel4ClientTools(settings.enabledTools),
    buildLevel4ExaWebSearchTool(getExaApiKey()),
  ];

  return {
    agent: {
      firstMessage: resolveFirstMessage(settings),
      language: "en",
      disableFirstMessageInterruptions: settings.interruptionMode !== "allow",
      dynamicVariables: {
        dynamicVariablePlaceholders: {
          memory_bank_summary: "empty",
          communication_style: settings.communicationStyle,
          explanation_level: String(
            explanationLevelNumber(settings.explanationLevel),
          ),
          safety_posture: settings.safetyPosture,
          resolution_bias: settings.resolutionBias,
        },
      },
      prompt: {
        prompt: resolveLevel4SystemPrompt(settings),
        llm: settings.llm,
        temperature: 0.4,
        tools,
        builtInTools: {
          endCall: endCallTool(),
        },
      },
    },
    tts: {
      voiceId: VOICE_PRESET_IDS[settings.voicePreset],
      modelId: settings.ttsModel,
      stability: 0.45,
      similarityBoost: 0.8,
      speed: 1.0,
      expressiveMode: true,
    },
    asr: {
      quality: "high",
      provider: "scribe_realtime",
      keywords: resolveAsrKeywords(settings),
    },
    turn: {
      turnTimeout: 7,
      turnEagerness: settings.turnEagerness,
      turnModel: "turn_v3",
      interruptionIgnoreTerms: resolveInterruptionIgnoreTerms(settings),
    },
    conversation: {
      maxDurationSeconds: 900,
      textOnly: false,
      monitoringEnabled: false,
      clientEvents: [
        "audio",
        "user_transcript",
        "agent_response",
        "agent_response_correction",
        "agent_tool_response",
        "agent_tool_request",
        "interruption",
        "vad_score",
        "ping",
      ],
    },
  };
}

function agentPlatformSettings(
  settings: Level4AgentSettings,
): ElevenLabs.AgentPlatformSettingsRequestModel {
  const customConfigs = [
    {
      isEnabled: true,
      name: "No medical diagnoses or prescribing",
      prompt:
        "Block the agent from providing a definitive medical diagnosis, prescribing medication, or changing dosages. Allow empathy, triage-style next steps, mock scheduling/pharmacy requests, memory bank lookups, and web search grounded facts.",
      executionMode: "blocking" as const,
      model: "gemini-2.5-flash-lite" as const,
      historyMessageCount: 2,
      triggerAction: {
        type: "retry" as const,
        feedback:
          "Reason: {{trigger_reason}}. Do not diagnose or prescribe. Offer a safe next step, ask for missing info, consult memory/web tools, or hand off.",
      },
    },
    ...(settings.extraGuardrailPrompt.trim()
      ? [
          {
            isEnabled: true,
            name: "Level 4 custom guardrail",
            prompt: settings.extraGuardrailPrompt.trim(),
            executionMode: "blocking" as const,
            model: "gemini-2.5-flash-lite" as const,
            historyMessageCount: 2,
            triggerAction: {
              type: "retry" as const,
              feedback:
                "Reason: {{trigger_reason}}. Follow the custom Level 4 guardrail and continue safely.",
            },
          },
        ]
      : []),
  ];

  return {
    auth: {
      enableAuth: true,
    },
    guardrails: {
      version: "1",
      focus: { isEnabled: true },
      promptInjection: { isEnabled: true },
      content: {
        executionMode: "blocking",
        config: {
          medicalAndLegalInformation: {
            isEnabled: false,
            threshold: 0.55,
          },
          selfHarm: {
            isEnabled: true,
            threshold: 0.3,
          },
        },
        triggerAction: {
          type: "retry",
          feedback:
            "Reason: {{trigger_reason}}. Stay within safe triage guidance. Prefer memory bank and web search tools when needed.",
        },
      },
      custom: {
        config: {
          configs: customConfigs,
        },
      },
    },
  };
}

export async function createRemoteLevel4Agent(
  settings: Level4AgentSettings,
): Promise<string> {
  const client = getClient();
  const name = buildLevel4AgentRemoteName(settings);
  console.info("[level4-agent] Creating ElevenLabs agent", { name });

  const created = await client.conversationalAi.agents.create({
    name,
    tags: ["bond", "level4-agent"],
    conversationConfig: agentConversationConfig(settings),
    platformSettings: agentPlatformSettings(settings),
  });

  if (!created.agentId) {
    throw new Error("ElevenLabs agent create response missing agentId");
  }

  console.info("[level4-agent] Created ElevenLabs agent", {
    agentId: created.agentId,
  });
  return created.agentId;
}

export async function syncRemoteLevel4Agent(
  agentId: string,
  settings: Level4AgentSettings,
): Promise<void> {
  const client = getClient();
  const name = buildLevel4AgentRemoteName(settings);
  console.info("[level4-agent] Syncing ElevenLabs agent", { agentId, name });

  await client.conversationalAi.agents.update(agentId, {
    name,
    tags: ["bond", "level4-agent"],
    conversationConfig: agentConversationConfig(settings),
    platformSettings: agentPlatformSettings(settings),
  });
}

export async function deleteRemoteLevel4Agent(agentId: string): Promise<void> {
  try {
    const client = getClient();
    await client.conversationalAi.agents.delete(agentId);
    console.info("[level4-agent] Deleted ElevenLabs agent", { agentId });
  } catch (error) {
    console.error("[level4-agent] Failed to delete ElevenLabs agent", {
      agentId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function createConversationCredentials(options: {
  agentId: string;
}): Promise<{
  conversationToken: string;
  conversationId: string;
}> {
  const client = getClient();
  const webrtc = await client.conversationalAi.conversations.getWebrtcToken({
    agentId: options.agentId,
  });

  if (!webrtc.token || !webrtc.conversationId) {
    throw new Error("ElevenLabs WebRTC token response incomplete");
  }

  return {
    conversationToken: webrtc.token,
    conversationId: webrtc.conversationId,
  };
}

export type RemoteConversationDetails = {
  conversationId: string;
  status?: string;
  transcript: Array<{ role: string; message?: string; timeInCallSecs?: number }>;
  metadata?: ElevenLabs.ConversationHistoryMetadataCommonModel;
  analysis?: ElevenLabs.ConversationHistoryAnalysisCommonModel;
};

export async function fetchConversationDetails(
  conversationId: string,
): Promise<RemoteConversationDetails | null> {
  try {
    const client = getClient();
    const details = await client.conversationalAi.conversations.get(conversationId);
    return {
      conversationId,
      status: details.status,
      transcript: (details.transcript ?? []).map((entry) => ({
        role: entry.role,
        message: entry.message ?? undefined,
        timeInCallSecs: entry.timeInCallSecs,
      })),
      metadata: details.metadata,
      analysis: details.analysis,
    };
  } catch (error) {
    console.error("[level4-agent] Failed to fetch conversation details", {
      conversationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export function extractMetricsFromRemote(
  remote: RemoteConversationDetails | null,
  local: {
    latencySamplesMs: number[];
    turnCount: number;
    toolCallCount: number;
    watchEventCount: number;
    interruptionCount: number;
    avgVadScore: number | null;
    ttsModel: string;
    llm: string;
    voicePreset: string;
  },
): Record<string, unknown> {
  const metadata = remote?.metadata;

  return {
    avgLatencyMs:
      local.latencySamplesMs.length > 0
        ? Math.round(
            local.latencySamplesMs.reduce((sum, value) => sum + value, 0) /
              local.latencySamplesMs.length,
          )
        : null,
    latestLatencyMs: local.latencySamplesMs.at(-1) ?? null,
    latencySampleCount: local.latencySamplesMs.length,
    turnCount: local.turnCount,
    toolCallCount: local.toolCallCount,
    watchEventCount: local.watchEventCount,
    interruptionCount: local.interruptionCount,
    avgVadScore: local.avgVadScore,
    elevenLabsCostCredits: metadata?.cost ?? null,
    elevenLabsCostUsd: metadata?.costFiat ?? null,
    callDurationSecs: metadata?.callDurationSecs ?? null,
    charging: metadata?.charging ?? null,
    featuresUsage: metadata?.featuresUsage ?? null,
    terminationReason: metadata?.terminationReason ?? null,
    remoteStatus: remote?.status ?? null,
    analysisSummary: remote?.analysis?.transcriptSummary ?? null,
    ttsModel: local.ttsModel,
    llm: local.llm,
    voicePreset: local.voicePreset,
    asrProvider: "scribe_realtime",
    turnModel: "turn_v3",
  };
}

export function sessionDynamicVariables(
  settings: Level4AgentSettings,
  memoryBank: string,
) {
  return {
    memory_bank_summary: summarizeMemoryBank(memoryBank),
    communication_style: settings.communicationStyle,
    explanation_level: String(explanationLevelNumber(settings.explanationLevel)),
    safety_posture: settings.safetyPosture,
    resolution_bias: settings.resolutionBias,
  };
}
