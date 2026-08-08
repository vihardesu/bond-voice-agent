import { ElevenLabsClient, type ElevenLabs } from "@elevenlabs/elevenlabs-js";

import {
  buildLevel4SystemPrompt,
  DAPHNE_V2_DISPLAY_NAME,
  DAPHNE_V2_FIRST_MESSAGE,
  DAPHNE_V2_SETTINGS,
  summarizeMemoryBank,
} from "./daphne-v2.js";
import { buildLevel4ClientTools, buildLevel4ExaWebSearchTool } from "./tools.js";

const VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // sarah / Daphne

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

function agentConversationConfig(): ElevenLabs.ConversationalConfig {
  const tools = [
    ...buildLevel4ClientTools(),
    buildLevel4ExaWebSearchTool(getExaApiKey()),
  ];

  return {
    agent: {
      firstMessage: DAPHNE_V2_FIRST_MESSAGE,
      language: "en",
      disableFirstMessageInterruptions: true,
      dynamicVariables: {
        dynamicVariablePlaceholders: {
          memory_bank_summary: "empty",
          communication_style: DAPHNE_V2_SETTINGS.communicationStyle,
          safety_posture: DAPHNE_V2_SETTINGS.safetyPosture,
          resolution_bias: DAPHNE_V2_SETTINGS.resolutionBias,
        },
      },
      prompt: {
        prompt: buildLevel4SystemPrompt(),
        llm: DAPHNE_V2_SETTINGS.llm,
        temperature: 0.4,
        tools,
        builtInTools: {
          endCall: endCallTool(),
        },
      },
    },
    tts: {
      voiceId: VOICE_ID,
      modelId: DAPHNE_V2_SETTINGS.ttsModel,
      stability: 0.45,
      similarityBoost: 0.8,
      speed: 1.0,
      expressiveMode: true,
    },
    asr: {
      quality: "high",
      provider: "scribe_realtime",
      keywords: [...DAPHNE_V2_SETTINGS.asrKeywords],
    },
    turn: {
      turnTimeout: 7,
      turnEagerness: DAPHNE_V2_SETTINGS.turnEagerness,
      turnModel: "turn_v3",
      interruptionIgnoreTerms: [...DAPHNE_V2_SETTINGS.interruptionIgnoreTerms],
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

function agentPlatformSettings(): ElevenLabs.AgentPlatformSettingsRequestModel {
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
          configs: [
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
          ],
        },
      },
    },
  };
}

export function level4RemoteAgentName(): string {
  return `Bond L4 · ${DAPHNE_V2_DISPLAY_NAME}`;
}

export async function createRemoteLevel4Agent(): Promise<string> {
  const client = getClient();
  const name = level4RemoteAgentName();
  console.info("[level4-agent] Creating ElevenLabs agent", { name });

  const created = await client.conversationalAi.agents.create({
    name,
    tags: ["bond", "level4-agent", "daphne-v2"],
    conversationConfig: agentConversationConfig(),
    platformSettings: agentPlatformSettings(),
  });

  if (!created.agentId) {
    throw new Error("ElevenLabs agent create response missing agentId");
  }

  console.info("[level4-agent] Created ElevenLabs agent", {
    agentId: created.agentId,
  });
  return created.agentId;
}

export async function syncRemoteLevel4Agent(agentId: string): Promise<void> {
  const client = getClient();
  const name = level4RemoteAgentName();
  console.info("[level4-agent] Syncing ElevenLabs agent", { agentId, name });

  await client.conversationalAi.agents.update(agentId, {
    name,
    tags: ["bond", "level4-agent", "daphne-v2"],
    conversationConfig: agentConversationConfig(),
    platformSettings: agentPlatformSettings(),
  });
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
    ttsModel: DAPHNE_V2_SETTINGS.ttsModel,
    llm: DAPHNE_V2_SETTINGS.llm,
    voicePreset: DAPHNE_V2_SETTINGS.voicePreset,
    asrProvider: "scribe_realtime",
    turnModel: "turn_v3",
    memoryBankSummary: summarizeMemoryBank(""),
  };
}

export function sessionDynamicVariables(memoryBank: string) {
  return {
    memory_bank_summary: summarizeMemoryBank(memoryBank),
    communication_style: DAPHNE_V2_SETTINGS.communicationStyle,
    safety_posture: DAPHNE_V2_SETTINGS.safetyPosture,
    resolution_bias: DAPHNE_V2_SETTINGS.resolutionBias,
  };
}
