import { eq } from "drizzle-orm";
import { ElevenLabsClient, type ElevenLabs } from "@elevenlabs/elevenlabs-js";

import { db } from "../../db/index.js";
import {
  CONCIERGE_AGENT_NAME,
  CONCIERGE_FIRST_MESSAGE,
  CONCIERGE_SYSTEM_PROMPT,
  turnEagernessForStyle,
} from "./prompt.js";
import { conciergeConfig } from "./schema.js";
import { CONCIERGE_CLIENT_TOOLS } from "./tools.js";

const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Sarah
const DEFAULT_LLM = "gemini-2.5-flash";

function getApiKey(): string {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }
  return apiKey;
}

function getClient(): ElevenLabsClient {
  return new ElevenLabsClient({ apiKey: getApiKey() });
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
  style: "patient" | "balanced" | "direct" = "balanced",
): ElevenLabs.ConversationalConfig {
  return {
    agent: {
      firstMessage: CONCIERGE_FIRST_MESSAGE,
      language: "en",
      dynamicVariables: {
        dynamicVariablePlaceholders: {
          communication_style: style,
          explanation_level: "50",
        },
      },
      prompt: {
        prompt: CONCIERGE_SYSTEM_PROMPT,
        llm: DEFAULT_LLM,
        temperature: 0.4,
        tools: CONCIERGE_CLIENT_TOOLS,
        builtInTools: {
          endCall: endCallTool(),
        },
      },
    },
    tts: {
      voiceId: DEFAULT_VOICE_ID,
      modelId: "eleven_flash_v2_5",
      stability: 0.45,
      similarityBoost: 0.8,
      speed: 1.0,
      expressiveMode: true,
    },
    asr: {
      quality: "high",
      provider: "scribe_realtime",
      keywords: [
        "medication",
        "pharmacy",
        "Walgreens",
        "CVS",
        "refill",
        "symptom",
        "follow-up",
      ],
    },
    turn: {
      turnTimeout: 7,
      turnEagerness: turnEagernessForStyle(style),
      turnModel: "turn_v3",
    },
    conversation: {
      maxDurationSeconds: 900,
      textOnly: false,
      monitoringEnabled: true,
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
        config: {
          medicalAndLegalInformation: {
            isEnabled: true,
            threshold: 0.55,
          },
          selfHarm: {
            isEnabled: true,
            threshold: 0.3,
          },
        },
      },
      custom: {
        config: {
          configs: [
            {
              isEnabled: true,
              name: "No medical diagnoses or prescribing",
              prompt:
                "Block the agent from providing a definitive medical diagnosis, prescribing medication, or changing dosages. Allow empathy, triage-style next steps, and mock scheduling/pharmacy requests.",
              executionMode: "blocking",
              model: "gemini-2.5-flash-lite",
              historyMessageCount: 2,
              triggerAction: {
                type: "retry",
                feedback:
                  "Reason: {{trigger_reason}}. Do not diagnose or prescribe. Offer a safe next step, ask for missing info, or hand off.",
              },
            },
          ],
        },
      },
    },
  };
}

async function createAgent(): Promise<string> {
  const client = getClient();
  const created = await client.conversationalAi.agents.create({
    name: CONCIERGE_AGENT_NAME,
    tags: ["bond", "concierge-doctor"],
    conversationConfig: agentConversationConfig("balanced"),
    platformSettings: agentPlatformSettings(),
  });

  if (!created.agentId) {
    throw new Error("ElevenLabs agent create response missing agentId");
  }
  return created.agentId;
}

async function syncAgentConfig(agentId: string): Promise<void> {
  const client = getClient();
  await client.conversationalAi.agents.update(agentId, {
    name: CONCIERGE_AGENT_NAME,
    tags: ["bond", "concierge-doctor"],
    conversationConfig: agentConversationConfig("balanced"),
    platformSettings: agentPlatformSettings(),
  });
}

export async function ensureConciergeAgent(options?: {
  forceSync?: boolean;
}): Promise<{ agentId: string; created: boolean }> {
  const envAgentId = process.env.ELEVENLABS_CONCIERGE_AGENT_ID?.trim();
  if (envAgentId) {
    if (options?.forceSync) {
      await syncAgentConfig(envAgentId);
    }
    return { agentId: envAgentId, created: false };
  }

  const [existing] = await db.select().from(conciergeConfig).limit(1);
  if (existing?.elevenLabsAgentId) {
    if (options?.forceSync) {
      await syncAgentConfig(existing.elevenLabsAgentId);
    }
    return { agentId: existing.elevenLabsAgentId, created: false };
  }

  const agentId = await createAgent();
  await db.insert(conciergeConfig).values({ elevenLabsAgentId: agentId });
  return { agentId, created: true };
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
  } catch {
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
    analysisSummary: remote?.analysis?.transcriptSummary ?? null,
    ttsModel: "eleven_flash_v2_5",
    asrProvider: "scribe_realtime",
    turnModel: "turn_v3",
  };
}

export async function deleteCachedAgentId(agentId: string): Promise<void> {
  await db.delete(conciergeConfig).where(eq(conciergeConfig.elevenLabsAgentId, agentId));
}
