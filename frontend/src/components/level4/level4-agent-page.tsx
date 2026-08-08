"use client";

import { useEffect, useRef, useState } from "react";
import {
  ConversationProvider,
  useConversationClientTool,
  useConversationControls,
  useConversationStatus,
} from "@elevenlabs/react";
import { Microphone01, PhoneHangUp, Trash01, XClose } from "@untitledui/icons";

import type {
  Level4Agent,
  Level4ClinicalContext,
  Level4Metrics,
  Level4ObservabilityEvent,
  Level4Resolution,
  Level4Session,
  Level4TranscriptEntry,
} from "@/client";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import {
  COMMUNICATION_STYLES,
  DEFAULT_DRAFT_SETTINGS,
  EXPLANATION_LEVELS,
  INTERRUPTION_MODES,
  LABELS,
  LLM_OPTIONS,
  listToText,
  PERSONA_PRESETS,
  PROMPT_PROFILES,
  RESOLUTION_BIASES,
  SAFETY_POSTURES,
  textToList,
  TOOL_OPTIONS,
  TTS_MODELS,
  TURN_EAGERNESS_OPTIONS,
  VARIANT_LABELS,
  VOICE_PRESETS,
  type Level4DraftSettings,
} from "@/components/level4/settings-options";
import {
  useComposeLevel4Defaults,
  useCreateLevel4Agent,
  useDeleteLevel4Agent,
  useDeleteLevel4Session,
  useLevel4Agents,
  useLevel4Sessions,
  useMockLevel4PharmacyRequest,
  useMockLevel4ScheduleFollowUp,
  useStartLevel4Session,
  useUpdateLevel4Agent,
  useUpdateLevel4Session,
} from "@/hooks/use-level4-agent";
import { cx } from "@/utils/cx";

type ResolutionValue = NonNullable<Level4Resolution>;
type ToolOption = (typeof TOOL_OPTIONS)[number];

function getErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof globalThis.Error) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (
    typeof error === "object" &&
    "error" in error &&
    typeof (error as { error: unknown }).error === "string"
  ) {
    return (error as { error: string }).error;
  }
  if (
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return "Something went wrong";
  }
}

function formatUnknown(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (value instanceof globalThis.Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatConversationError(message: string, context?: unknown): string {
  const contextText = formatUnknown(context);
  if (!contextText || contextText === "{}" || contextText === "null") {
    return message || "Conversation error";
  }
  return `${message || "Conversation error"} (${contextText})`;
}

type DisconnectDetails =
  | {
      reason: "error";
      message: string;
      context: { type?: string; reason?: string; code?: number };
      closeCode?: number;
      closeReason?: string;
    }
  | {
      reason: "agent";
      context?: { type?: string; reason?: string; code?: number };
      closeCode?: number;
      closeReason?: string;
    }
  | {
      reason: "user";
    };

function formatDisconnectDetails(details: DisconnectDetails): string {
  if (details.reason === "user") return "reason=user";
  const parts = [
    `reason=${details.reason}`,
    details.reason === "error" && details.message ? `message=${details.message}` : null,
    details.closeCode != null ? `closeCode=${details.closeCode}` : null,
    details.closeReason ? `closeReason=${details.closeReason}` : null,
    details.context?.type ? `contextType=${details.context.type}` : null,
    details.context?.code != null ? `contextCode=${details.context.code}` : null,
    details.context?.reason ? `contextReason=${details.context.reason}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function formatDuration(durationMs: number | null | undefined): string {
  if (durationMs == null) return "—";
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function sessionTitle(session: Level4Session): string {
  if (session.title.trim()) return session.title;
  if (session.clinicalContext.symptom) return session.clinicalContext.symptom;
  return `Visit ${formatDateTime(session.startedAt)}`;
}

function metricValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}

function queryMemoryBank(memoryBank: string, query: string | undefined) {
  const bank = memoryBank.trim();
  const normalizedQuery = typeof query === "string" ? query.trim() : "";
  if (!bank) {
    return {
      ok: true,
      query: normalizedQuery,
      memoryBank: "",
      matches: [] as string[],
      empty: true,
    };
  }

  if (!normalizedQuery) {
    return {
      ok: true,
      query: "",
      memoryBank: bank,
      matches: [bank],
      empty: false,
    };
  }

  const needle = normalizedQuery.toLowerCase();
  const paragraphs = bank
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  const paragraphMatches = paragraphs.filter((part) =>
    part.toLowerCase().includes(needle),
  );
  if (paragraphMatches.length > 0) {
    return {
      ok: true,
      query: normalizedQuery,
      memoryBank: bank,
      matches: paragraphMatches,
      empty: false,
    };
  }

  const lineMatches = bank
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.toLowerCase().includes(needle));
  if (lineMatches.length > 0) {
    return {
      ok: true,
      query: normalizedQuery,
      memoryBank: bank,
      matches: lineMatches,
      empty: false,
    };
  }

  return {
    ok: true,
    query: normalizedQuery,
    memoryBank: bank,
    matches: [] as string[],
    empty: false,
    note: "No exact matches; share relevant bank facts if helpful.",
  };
}


function draftFromAgent(agent: Level4Agent): Level4DraftSettings {
  return {
    variantLabel: agent.variantLabel,
    communicationStyle: agent.communicationStyle,
    explanationLevel: agent.explanationLevel,
    safetyPosture: agent.safetyPosture,
    resolutionBias: agent.resolutionBias,
    turnEagerness: agent.turnEagerness,
    voicePreset: agent.voicePreset,
    ttsModel: agent.ttsModel,
    llm: agent.llm,
    interruptionMode: agent.interruptionMode,
    personaPreset: agent.personaPreset,
    promptProfile: agent.promptProfile,
    enabledTools: agent.enabledTools,
    displayName: agent.displayName,
    systemPrompt: agent.systemPrompt,
    firstMessage: agent.firstMessage,
    asrKeywordsText: listToText(agent.asrKeywords),
    interruptionIgnoreTermsText: listToText(agent.interruptionIgnoreTerms),
    extraGuardrailPrompt: agent.extraGuardrailPrompt,
  };
}

function draftToBody(draft: Level4DraftSettings) {
  return {
    variantLabel: draft.variantLabel,
    communicationStyle: draft.communicationStyle,
    explanationLevel: draft.explanationLevel,
    safetyPosture: draft.safetyPosture,
    resolutionBias: draft.resolutionBias,
    turnEagerness: draft.turnEagerness,
    voicePreset: draft.voicePreset,
    ttsModel: draft.ttsModel,
    llm: draft.llm,
    interruptionMode: draft.interruptionMode,
    personaPreset: draft.personaPreset,
    promptProfile: draft.promptProfile,
    enabledTools: draft.enabledTools,
    displayName: draft.displayName.trim(),
    systemPrompt: draft.systemPrompt,
    firstMessage: draft.firstMessage.trim(),
    asrKeywords: textToList(draft.asrKeywordsText),
    interruptionIgnoreTerms: textToList(draft.interruptionIgnoreTermsText),
    extraGuardrailPrompt: draft.extraGuardrailPrompt.trim(),
  };
}

function SelectField<T extends string>({
  label,
  value,
  options,
  labels,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-secondary">{label}</span>
      <select
        className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option]}
          </option>
        ))}
      </select>
    </label>
  );
}

function Level4AgentExperience() {
  const { data: agents, isLoading: agentsLoading } = useLevel4Agents();
  const { data: sessions, isLoading: sessionsLoading, isError, error } = useLevel4Sessions();
  const createAgent = useCreateLevel4Agent();
  const updateAgent = useUpdateLevel4Agent();
  const deleteAgent = useDeleteLevel4Agent();
  const composeDefaults = useComposeLevel4Defaults();
  const startSession = useStartLevel4Session();
  const updateSession = useUpdateLevel4Session();
  const deleteSession = useDeleteLevel4Session();
  const mockPharmacy = useMockLevel4PharmacyRequest();
  const mockSchedule = useMockLevel4ScheduleFollowUp();

  const { startSession: startConversation, endSession } = useConversationControls();
  const { status } = useConversationStatus();

  const [draft, setDraft] = useState<Level4DraftSettings>(DEFAULT_DRAFT_SETTINGS);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<Level4TranscriptEntry[]>([]);
  const [clinicalContext, setClinicalContext] = useState<Level4ClinicalContext>({});
  const [resolution, setResolution] = useState<ResolutionValue | null>(null);
  const [events, setEvents] = useState<Level4ObservabilityEvent[]>([]);
  const [metrics, setMetrics] = useState<Level4Metrics>({});
  const [selectedSession, setSelectedSession] = useState<Level4Session | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [mode, setMode] = useState<"speaking" | "listening" | "idle">("idle");
  const [enabledToolsLive, setEnabledToolsLive] = useState<ToolOption[]>([...TOOL_OPTIONS]);
  const [memoryBank, setMemoryBank] = useState("");
  const [toolWorking, setToolWorking] = useState(false);

  const startedAtRef = useRef<number | null>(null);
  const memoryBankRef = useRef("");
  const transcriptRef = useRef<Level4TranscriptEntry[]>([]);
  const eventsRef = useRef<Level4ObservabilityEvent[]>([]);
  const clinicalRef = useRef<Level4ClinicalContext>({});
  const resolutionRef = useRef<ResolutionValue | null>(null);
  const latencySamplesRef = useRef<number[]>([]);
  const vadSamplesRef = useRef<number[]>([]);
  const activeSessionIdRef = useRef<number | null>(null);
  const pendingAppendRef = useRef<Level4ObservabilityEvent[]>([]);
  const isClosingRef = useRef(false);
  const selectedAgent = agents?.find((agent) => agent.id === selectedAgentId) ?? null;

  const isLive = status === "connecting" || status === "connected";

  const pushEvent = (event: Level4ObservabilityEvent) => {
    eventsRef.current = [...eventsRef.current, event];
    pendingAppendRef.current = [...pendingAppendRef.current, event];
    setEvents(eventsRef.current);
  };

  const pushTranscript = (role: "user" | "agent", text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const entry: Level4TranscriptEntry = {
      role,
      text: trimmed,
      at: new Date().toISOString(),
    };
    transcriptRef.current = [...transcriptRef.current, entry];
    setLiveTranscript(transcriptRef.current);
    pushEvent({
      at: entry.at,
      type: "transcript",
      message: `${role}: ${trimmed}`,
      data: { role },
    });
  };

  const recomputeLocalMetrics = () => {
    const latencySamples = latencySamplesRef.current;
    const vadSamples = vadSamplesRef.current;
    const next: Level4Metrics = {
      avgLatencyMs:
        latencySamples.length > 0
          ? Math.round(
              latencySamples.reduce((sum, value) => sum + value, 0) / latencySamples.length,
            )
          : null,
      latestLatencyMs: latencySamples.at(-1) ?? null,
      latencySampleCount: latencySamples.length,
      turnCount: transcriptRef.current.length,
      toolCallCount: eventsRef.current.filter((event) => event.type === "tool_request")
        .length,
      watchEventCount: eventsRef.current.filter((event) => event.type === "watch").length,
      interruptionCount: eventsRef.current.filter((event) => event.type === "interruption")
        .length,
      avgVadScore:
        vadSamples.length > 0
          ? Number(
              (
                vadSamples.reduce((sum, value) => sum + value, 0) / vadSamples.length
              ).toFixed(3),
            )
          : null,
      ttsModel: selectedAgent?.ttsModel ?? draft.ttsModel,
      llm: selectedAgent?.llm ?? draft.llm,
      voicePreset: selectedAgent?.voicePreset ?? draft.voicePreset,
      asrProvider: "scribe_realtime",
      turnModel: "turn_v3",
    };
    setMetrics(next);
    return next;
  };

  const flushPendingEvents = async () => {
    const sessionId = activeSessionIdRef.current;
    const pending = pendingAppendRef.current;
    if (sessionId == null || pending.length === 0) return;

    pendingAppendRef.current = [];
    try {
      await updateSession.mutateAsync({
        path: { id: String(sessionId) },
        body: {
          appendEvents: pending,
          clinicalContext: clinicalRef.current,
          resolution: resolutionRef.current,
          transcript: transcriptRef.current,
          metrics: recomputeLocalMetrics(),
        },
      });
    } catch {
      pendingAppendRef.current = [...pending, ...pendingAppendRef.current];
    }
  };

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    if (!isLive) return;
    const timer = window.setInterval(() => {
      void flushPendingEvents();
    }, 4000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]);

  useEffect(() => {
    if (selectedAgentId != null) return;
    if (agents?.length) {
      setSelectedAgentId(agents[0].id);
      setDraft(draftFromAgent(agents[0]));
    }
  }, [agents, selectedAgentId]);

  const toolEnabled = (name: ToolOption) => enabledToolsLive.includes(name);

  useConversationClientTool("query_memory_bank", async (params) => {
    setToolWorking(true);
    try {
      const query = typeof params.query === "string" ? params.query : undefined;
      pushEvent({
        at: new Date().toISOString(),
        type: "tool_request",
        message: "query_memory_bank",
        data: { query },
      });
      const result = queryMemoryBank(memoryBankRef.current, query);
      pushEvent({
        at: new Date().toISOString(),
        type: "tool_response",
        message: result.empty
          ? "Memory bank empty"
          : `Memory bank lookup (${result.matches.length} match${result.matches.length === 1 ? "" : "es"})`,
        data: result,
      });
      recomputeLocalMetrics();
      return JSON.stringify(result);
    } finally {
      setToolWorking(false);
    }
  });

  useConversationClientTool("update_clinical_context", async (params) => {
    if (!toolEnabled("update_clinical_context")) {
      return JSON.stringify({ ok: false, error: "Tool disabled for this agent" });
    }
    const next = {
      ...clinicalRef.current,
      ...(typeof params.symptom === "string" ? { symptom: params.symptom } : {}),
      ...(typeof params.duration === "string" ? { duration: params.duration } : {}),
      ...(typeof params.history === "string" ? { history: params.history } : {}),
      ...(typeof params.currentMedications === "string"
        ? { currentMedications: params.currentMedications }
        : {}),
      ...(typeof params.unknowns === "string" ? { unknowns: params.unknowns } : {}),
      ...(typeof params.notes === "string" ? { notes: params.notes } : {}),
    };
    clinicalRef.current = next;
    setClinicalContext(next);
    pushEvent({
      at: new Date().toISOString(),
      type: "tool_response",
      message: "Updated clinical context",
      data: next,
    });
    return JSON.stringify({ ok: true, clinicalContext: next });
  });

  useConversationClientTool("schedule_follow_up", async (params) => {
    if (!toolEnabled("schedule_follow_up")) {
      return JSON.stringify({ ok: false, error: "Tool disabled for this agent" });
    }
    pushEvent({
      at: new Date().toISOString(),
      type: "tool_request",
      message: "schedule_follow_up",
      data: params,
    });
    const result = await mockSchedule.mutateAsync({
      body: {
        reason: String(params.reason ?? ""),
        urgency: (params.urgency as "routine" | "soon" | "urgent") || "soon",
        preferredWindow:
          typeof params.preferredWindow === "string" ? params.preferredWindow : undefined,
      },
    });
    const nextResolution: ResolutionValue = {
      type: "scheduled_follow_up",
      summary: result.message,
      confirmationId: result.confirmationId,
      details: { slot: result.slot },
    };
    resolutionRef.current = nextResolution;
    setResolution(nextResolution);
    pushEvent({
      at: new Date().toISOString(),
      type: "tool_response",
      message: result.message,
      data: result,
    });
    return JSON.stringify(result);
  });

  useConversationClientTool("submit_pharmacy_request", async (params) => {
    if (!toolEnabled("submit_pharmacy_request")) {
      return JSON.stringify({ ok: false, error: "Tool disabled for this agent" });
    }
    pushEvent({
      at: new Date().toISOString(),
      type: "tool_request",
      message: "submit_pharmacy_request",
      data: params,
    });
    const result = await mockPharmacy.mutateAsync({
      body: {
        pharmacy: (params.pharmacy as "walgreens" | "cvs" | "other") || "other",
        requestType:
          (params.requestType as
            | "refill_status"
            | "pickup_ready_check"
            | "transfer_request"
            | "general_question") || "general_question",
        medicationName:
          typeof params.medicationName === "string" ? params.medicationName : undefined,
        details: typeof params.details === "string" ? params.details : undefined,
      },
    });
    const nextResolution: ResolutionValue = {
      type: "pharmacy_request",
      summary: result.message,
      confirmationId: result.confirmationId,
      pharmacy: String(params.pharmacy ?? "other"),
    };
    resolutionRef.current = nextResolution;
    setResolution(nextResolution);
    pushEvent({
      at: new Date().toISOString(),
      type: "tool_response",
      message: result.message,
      data: result,
    });
    return JSON.stringify(result);
  });

  useConversationClientTool("confirm_next_step", async (params) => {
    if (!toolEnabled("confirm_next_step")) {
      return JSON.stringify({ ok: false, error: "Tool disabled for this agent" });
    }
    const nextResolution: ResolutionValue = {
      type: (params.nextStepType as ResolutionValue["type"]) || "other",
      summary: String(params.summary ?? "Next step confirmed"),
      reassurance:
        typeof params.reassurance === "string" ? params.reassurance : undefined,
      confirmationId: resolutionRef.current?.confirmationId,
    };
    resolutionRef.current = nextResolution;
    setResolution(nextResolution);
    pushEvent({
      at: new Date().toISOString(),
      type: "tool_response",
      message: "Confirmed next step",
      data: nextResolution,
    });
    return JSON.stringify({ ok: true, resolution: nextResolution });
  });

  useConversationClientTool("request_human_handoff", async (params) => {
    if (!toolEnabled("request_human_handoff")) {
      return JSON.stringify({ ok: false, error: "Tool disabled for this agent" });
    }
    const nextResolution: ResolutionValue = {
      type: "human_handoff",
      summary: String(params.reason ?? "Human handoff requested"),
      handoffReason: String(params.reason ?? "Insufficient information"),
      details: {
        missingInformation: params.missingInformation,
        urgency: params.urgency,
      },
    };
    resolutionRef.current = nextResolution;
    setResolution(nextResolution);
    pushEvent({
      at: new Date().toISOString(),
      type: "watch",
      message: `Handoff: ${nextResolution.summary}`,
      data: { level: "warning", category: "handoff", ...params },
    });
    return JSON.stringify({
      ok: true,
      queued: true,
      message:
        "Human care team notified (mock). Agent should stop guessing and wait for handoff.",
    });
  });

  useConversationClientTool("flag_watch_event", async (params) => {
    if (!toolEnabled("flag_watch_event")) {
      return JSON.stringify({ ok: false, error: "Tool disabled for this agent" });
    }
    pushEvent({
      at: new Date().toISOString(),
      type: "watch",
      message: String(params.message ?? "Watch event"),
      data: {
        level: params.level,
        category: params.category,
      },
    });
    return JSON.stringify({ ok: true });
  });

  const persistEndedSession = async (options?: {
    statusMessage?: string;
    errorMessage?: string | null;
  }) => {
    const sessionId = activeSessionIdRef.current;
    if (sessionId == null || isClosingRef.current) return;
    isClosingRef.current = true;

    const endedAt = new Date();
    const startedAt = startedAtRef.current ?? endedAt.getTime();
    const durationMs = Math.max(0, endedAt.getTime() - startedAt);
    const localMetrics = recomputeLocalMetrics();
    const statusMessage = options?.statusMessage ?? "Conversation ended";

    try {
      const updated = await updateSession.mutateAsync({
        path: { id: String(sessionId) },
        body: {
          status: "ended",
          endedAt: endedAt.toISOString(),
          durationMs,
          transcript: transcriptRef.current,
          clinicalContext: clinicalRef.current,
          resolution: resolutionRef.current,
          appendEvents: [
            ...pendingAppendRef.current,
            {
              at: endedAt.toISOString(),
              type: "status",
              message: statusMessage,
            },
          ],
          metrics: localMetrics,
          syncRemoteMetrics: true,
          title:
            clinicalRef.current.symptom ||
            transcriptRef.current.find((entry) => entry.role === "user")?.text.slice(0, 80) ||
            `Visit ${formatDateTime(endedAt.toISOString())}`,
        },
      });
      pendingAppendRef.current = [];
      setMetrics(updated.metrics);

      const remoteReason =
        typeof updated.metrics.terminationReason === "string"
          ? updated.metrics.terminationReason
          : typeof updated.metrics.elevenLabsErrorReason === "string"
            ? updated.metrics.elevenLabsErrorReason
            : null;

      if (options?.errorMessage || remoteReason) {
        setLocalError([options?.errorMessage, remoteReason].filter(Boolean).join(" — "));
      }
    } catch (err) {
      setLocalError(getErrorMessage(err) || "Failed to save conversation");
    } finally {
      setActiveSessionId(null);
      activeSessionIdRef.current = null;
      setConversationId(null);
      startedAtRef.current = null;
      isClosingRef.current = false;
    }
  };

  const endLiveConversation = async () => {
    setToolWorking(false);
    endSession();
    setMode("idle");
    await persistEndedSession({ statusMessage: "Conversation ended by user" });
  };

  const beginConversation = async () => {
    if (isLive || selectedAgentId == null) return;
    setLocalError(null);
    setLiveTranscript([]);
    setClinicalContext({});
    setResolution(null);
    setEvents([]);
    setMetrics({});
    setToolWorking(false);
    transcriptRef.current = [];
    eventsRef.current = [];
    clinicalRef.current = {};
    resolutionRef.current = null;
    latencySamplesRef.current = [];
    vadSamplesRef.current = [];
    pendingAppendRef.current = [];
    isClosingRef.current = false;

    try {
      const started = await startSession.mutateAsync({
        path: { id: String(selectedAgentId) },
        body: { memoryBank, forceSyncAgent: true },
      });

      memoryBankRef.current = started.memoryBank;
      setEnabledToolsLive(started.enabledTools);
      setActiveSessionId(started.session.id);
      activeSessionIdRef.current = started.session.id;
      setConversationId(started.conversationId);
      startedAtRef.current = Date.now();

      startConversation({
        conversationToken: started.conversationToken,
        connectionType: "webrtc",
        dynamicVariables: started.dynamicVariables,
        onConnect: ({ conversationId: connectedId }) => {
          setConversationId(connectedId);
          pushEvent({
            at: new Date().toISOString(),
            type: "status",
            message: "Connected to ElevenLabs agent",
            data: { conversationId: connectedId },
          });
        },
        onDisconnect: (details) => {
          const typedDetails = details as DisconnectDetails;
          const detailText = formatDisconnectDetails(typedDetails);
          pushEvent({
            at: new Date().toISOString(),
            type: typedDetails.reason === "error" ? "error" : "status",
            message:
              typedDetails.reason === "error"
                ? `Disconnected: ${typedDetails.message || "Unknown error"}`
                : `Disconnected (${typedDetails.reason})`,
            data: {
              reason: typedDetails.reason,
              detailText,
              ...(typedDetails.reason === "user"
                ? {}
                : {
                    message:
                      typedDetails.reason === "error" ? typedDetails.message : undefined,
                    closeCode: typedDetails.closeCode,
                    closeReason: typedDetails.closeReason,
                    context: typedDetails.context as Record<string, unknown> | undefined,
                  }),
            },
          });
          setMode("idle");
          if (typedDetails.reason === "user") return;

          const errorMessage =
            typedDetails.reason === "error"
              ? formatConversationError(
                  typedDetails.message || typedDetails.closeReason || "Server error",
                  {
                    closeCode: typedDetails.closeCode,
                    closeReason: typedDetails.closeReason,
                    context: typedDetails.context,
                  },
                )
              : typedDetails.closeReason ||
                "Agent ended the conversation unexpectedly";

          setLocalError(errorMessage);
          void persistEndedSession({
            statusMessage: `Conversation disconnected (${typedDetails.reason})`,
            errorMessage,
          });
        },
        onError: (message, context) => {
          const formatted = formatConversationError(message, context);
          setLocalError(formatted);
          pushEvent({
            at: new Date().toISOString(),
            type: "error",
            message: formatted,
            data: {
              message,
              context: context as Record<string, unknown> | undefined,
            },
          });
        },
        onMessage: ({ message, role }) => {
          pushTranscript(role === "user" ? "user" : "agent", message);
        },
        onModeChange: ({ mode: nextMode }) => {
          setMode(nextMode);
          pushEvent({
            at: new Date().toISOString(),
            type: "mode",
            message: `Mode: ${nextMode}`,
            data: { mode: nextMode },
          });
        },
        onPing: (pingEvent) => {
          const pingMs =
            typeof pingEvent.ping_ms === "number" ? pingEvent.ping_ms : undefined;
          if (pingMs != null) {
            latencySamplesRef.current = [...latencySamplesRef.current, pingMs];
            recomputeLocalMetrics();
          }
          pushEvent({
            at: new Date().toISOString(),
            type: "ping",
            message: pingMs != null ? `Latency ${pingMs}ms` : "Ping",
            data: { pingMs },
          });
        },
        onVadScore: ({ vadScore }) => {
          vadSamplesRef.current = [...vadSamplesRef.current, vadScore];
          recomputeLocalMetrics();
          pushEvent({
            at: new Date().toISOString(),
            type: "vad",
            message: `VAD ${vadScore.toFixed(2)}`,
            data: { vadScore },
          });
        },
        onInterruption: () => {
          pushEvent({
            at: new Date().toISOString(),
            type: "interruption",
            message: "User interruption detected",
          });
          recomputeLocalMetrics();
        },
        onAgentToolRequest: (request) => {
          setToolWorking(true);
          pushEvent({
            at: new Date().toISOString(),
            type: "tool_request",
            message: "Agent tool request",
            data: request as unknown as Record<string, unknown>,
          });
          recomputeLocalMetrics();
          window.setTimeout(() => setToolWorking(false), 8000);
        },
        onGuardrailTriggered: () => {
          pushEvent({
            at: new Date().toISOString(),
            type: "guardrail",
            message: "Guardrail triggered — agent will retry safely",
            data: { level: "warning" },
          });
        },
      });
    } catch (err) {
      setLocalError(getErrorMessage(err) || "Failed to start Level 4 conversation");
      setActiveSessionId(null);
      activeSessionIdRef.current = null;
    }
  };

  const patchDraft = <K extends keyof Level4DraftSettings>(
    key: K,
    value: Level4DraftSettings[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const toggleTool = (tool: ToolOption) => {
    setDraft((prev) => {
      const exists = prev.enabledTools.includes(tool);
      if (exists && prev.enabledTools.length === 1) return prev;
      return {
        ...prev,
        enabledTools: exists
          ? prev.enabledTools.filter((item) => item !== tool)
          : [...prev.enabledTools, tool],
      };
    });
  };

  const handlePrefillFreeText = async () => {
    setLocalError(null);
    try {
      const composed = await composeDefaults.mutateAsync({
        body: draftToBody(draft),
      });
      setDraft((prev) => ({
        ...prev,
        displayName: composed.displayName,
        systemPrompt: composed.systemPrompt,
        firstMessage: composed.firstMessage,
        asrKeywordsText: listToText(composed.asrKeywords),
        interruptionIgnoreTermsText: listToText(composed.interruptionIgnoreTerms),
      }));
    } catch (err) {
      setLocalError(getErrorMessage(err) || "Failed to compose defaults from dials");
    }
  };

  const handleCreateAgent = async () => {
    setLocalError(null);
    try {
      const created = await createAgent.mutateAsync({ body: draftToBody(draft) });
      setSelectedAgentId(created.id);
      setDraft(draftFromAgent(created));
    } catch (err) {
      setLocalError(getErrorMessage(err) || "Failed to create agent");
    }
  };

  const handleUpdateAgent = async () => {
    if (selectedAgentId == null) return;
    setLocalError(null);
    try {
      const updated = await updateAgent.mutateAsync({
        path: { id: String(selectedAgentId) },
        body: draftToBody(draft),
      });
      setDraft(draftFromAgent(updated));
    } catch (err) {
      setLocalError(getErrorMessage(err) || "Failed to update agent");
    }
  };

  const mutationError = getErrorMessage(
    composeDefaults.error ||
      createAgent.error ||
      updateAgent.error ||
      deleteAgent.error ||
      startSession.error ||
      updateSession.error ||
      deleteSession.error,
  );

  const watchEvents = events.filter((event) => event.type === "watch");
  const visibleSessions =
    selectedAgentId == null
      ? sessions ?? []
      : (sessions ?? []).filter((session) => session.agentId === selectedAgentId);

  return (
    <main className="flex min-h-dvh flex-1 justify-center bg-primary px-4 py-10">
      <section className="flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <Badge color="brand" size="sm" type="pill-color">
            Level 4 Agent
          </Badge>
          <div className="flex flex-col gap-2">
            <h1 className="text-display-xs font-semibold text-primary">Level 4 Agent</h1>
            <p className="text-md text-tertiary">
              Same tunable harness as Level 3, plus a session memory bank, Exa web search,
              and native tool-call typing sounds. Save configurations as agents, load a
              memory bank, then talk with full observability.
            </p>
          </div>
        </header>

        <div className="flex flex-col gap-4 rounded-2xl p-6 ring-1 ring-secondary">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-primary">Agent settings</h2>
              <p className="text-sm text-tertiary">
                All inputs are enums/selectors so saved agents map cleanly to ElevenLabs
                config.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="md"
                color="secondary"
                onClick={handlePrefillFreeText}
                isLoading={composeDefaults.isPending}
                isDisabled={isLive || composeDefaults.isPending}
              >
                Prefill text from dials
              </Button>
              <Button
                size="md"
                color="secondary"
                onClick={handleCreateAgent}
                isLoading={createAgent.isPending}
                isDisabled={isLive || createAgent.isPending}
              >
                Save as new agent
              </Button>
              <Button
                size="md"
                onClick={handleUpdateAgent}
                isLoading={updateAgent.isPending}
                isDisabled={
                  isLive || selectedAgentId == null || updateAgent.isPending
                }
              >
                Update selected
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SelectField
              label="Persona (name + first message)"
              value={draft.personaPreset}
              options={PERSONA_PRESETS}
              labels={LABELS.personaPreset}
              disabled={isLive}
              onChange={(value) => patchDraft("personaPreset", value)}
            />
            <SelectField
              label="Prompt profile"
              value={draft.promptProfile}
              options={PROMPT_PROFILES}
              labels={LABELS.promptProfile}
              disabled={isLive}
              onChange={(value) => patchDraft("promptProfile", value)}
            />
            <SelectField
              label="Variant label"
              value={draft.variantLabel}
              options={VARIANT_LABELS}
              labels={LABELS.variantLabel}
              disabled={isLive}
              onChange={(value) => patchDraft("variantLabel", value)}
            />
            <SelectField
              label="Communication style"
              value={draft.communicationStyle}
              options={COMMUNICATION_STYLES}
              labels={LABELS.communicationStyle}
              disabled={isLive}
              onChange={(value) => patchDraft("communicationStyle", value)}
            />
            <SelectField
              label="Explanation level"
              value={draft.explanationLevel}
              options={EXPLANATION_LEVELS}
              labels={LABELS.explanationLevel}
              disabled={isLive}
              onChange={(value) => patchDraft("explanationLevel", value)}
            />
            <SelectField
              label="Safety posture"
              value={draft.safetyPosture}
              options={SAFETY_POSTURES}
              labels={LABELS.safetyPosture}
              disabled={isLive}
              onChange={(value) => patchDraft("safetyPosture", value)}
            />
            <SelectField
              label="Resolution bias"
              value={draft.resolutionBias}
              options={RESOLUTION_BIASES}
              labels={LABELS.resolutionBias}
              disabled={isLive}
              onChange={(value) => patchDraft("resolutionBias", value)}
            />
            <SelectField
              label="Turn eagerness"
              value={draft.turnEagerness}
              options={TURN_EAGERNESS_OPTIONS}
              labels={LABELS.turnEagerness}
              disabled={isLive}
              onChange={(value) => patchDraft("turnEagerness", value)}
            />
            <SelectField
              label="Interruptions"
              value={draft.interruptionMode}
              options={INTERRUPTION_MODES}
              labels={LABELS.interruptionMode}
              disabled={isLive}
              onChange={(value) => patchDraft("interruptionMode", value)}
            />
            <SelectField
              label="Voice"
              value={draft.voicePreset}
              options={VOICE_PRESETS}
              labels={LABELS.voicePreset}
              disabled={isLive}
              onChange={(value) => patchDraft("voicePreset", value)}
            />
            <SelectField
              label="TTS model"
              value={draft.ttsModel}
              options={TTS_MODELS}
              labels={LABELS.ttsModel}
              disabled={isLive}
              onChange={(value) => patchDraft("ttsModel", value)}
            />
            <SelectField
              label="LLM"
              value={draft.llm}
              options={LLM_OPTIONS}
              labels={LABELS.llm}
              disabled={isLive}
              onChange={(value) => patchDraft("llm", value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-secondary">Enabled tools</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {TOOL_OPTIONS.map((tool) => {
                const checked = draft.enabledTools.includes(tool);
                return (
                  <label
                    key={tool}
                    className={cx(
                      "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm ring-1 ring-secondary",
                      checked ? "bg-secondary text-primary" : "text-tertiary",
                      isLive && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isLive}
                      onChange={() => toggleTool(tool)}
                    />
                    {LABELS.enabledTools[tool]}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-secondary pt-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-md font-semibold text-primary">Free-text overrides</h3>
              <p className="text-sm text-tertiary">
                Leave blank to use dial-composed defaults on save. Use “Prefill text from
                dials” to load a starting prompt, then edit freely.
              </p>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-secondary">Display name</span>
              <input
                className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary"
                value={draft.displayName}
                disabled={isLive}
                maxLength={120}
                placeholder="e.g. Mira Pilot — thorough intake"
                onChange={(event) => patchDraft("displayName", event.target.value)}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-secondary">First message</span>
              <textarea
                className="min-h-20 rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary"
                value={draft.firstMessage}
                disabled={isLive}
                maxLength={1000}
                placeholder="What the agent says when the call starts"
                onChange={(event) => patchDraft("firstMessage", event.target.value)}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-secondary">System prompt</span>
              <textarea
                className="min-h-56 rounded-lg border border-secondary bg-primary px-3 py-2 font-mono text-xs text-primary"
                value={draft.systemPrompt}
                disabled={isLive}
                maxLength={20000}
                placeholder="Full system prompt controlling how the agent responds"
                onChange={(event) => patchDraft("systemPrompt", event.target.value)}
              />
            </label>

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-secondary">
                  ASR keywords (comma-separated)
                </span>
                <textarea
                  className="min-h-24 rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary"
                  value={draft.asrKeywordsText}
                  disabled={isLive}
                  placeholder="medication, pharmacy, refill"
                  onChange={(event) => patchDraft("asrKeywordsText", event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-secondary">
                  Interruption ignore terms (comma-separated)
                </span>
                <textarea
                  className="min-h-24 rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary"
                  value={draft.interruptionIgnoreTermsText}
                  disabled={isLive}
                  placeholder="uh huh, gotcha, okay"
                  onChange={(event) =>
                    patchDraft("interruptionIgnoreTermsText", event.target.value)
                  }
                />
              </label>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-secondary">
                Extra guardrail instruction
              </span>
              <textarea
                className="min-h-24 rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary"
                value={draft.extraGuardrailPrompt}
                disabled={isLive}
                maxLength={2000}
                placeholder="Optional custom rule, e.g. never mention competitor clinics"
                onChange={(event) =>
                  patchDraft("extraGuardrailPrompt", event.target.value)
                }
              />
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-primary">Saved agents</h2>
          {agentsLoading ? (
            <p className="text-sm text-tertiary">Loading agents…</p>
          ) : !agents?.length ? (
            <p className="text-sm text-tertiary">
              No saved Level 4 agents yet. Configure settings above and save a new agent.
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {agents.map((agent) => {
                const active = agent.id === selectedAgentId;
                return (
                  <li
                    key={agent.id}
                    className={cx(
                      "flex flex-col gap-3 rounded-xl p-4 ring-1 transition",
                      active
                        ? "bg-secondary ring-brand-600"
                        : "ring-secondary hover:bg-primary_hover",
                    )}
                  >
                    <button
                      type="button"
                      className="flex flex-col gap-1 text-left"
                      disabled={isLive}
                      onClick={() => {
                        setSelectedAgentId(agent.id);
                        setDraft(draftFromAgent(agent));
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-primary">{agent.displayName}</p>
                        {active ? (
                          <Badge color="brand" size="sm" type="pill-color">
                            selected
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-tertiary">
                        {agent.llm} · {agent.ttsModel} · {agent.voicePreset} · turn{" "}
                        {agent.turnEagerness}
                      </p>
                      <p className="text-xs text-quaternary">
                        {agent.enabledTools.length} tools · {agent.safetyPosture} safety ·{" "}
                        {agent.resolutionBias.replace("_", " ")}
                      </p>
                    </button>
                    <Button
                      color="secondary-destructive"
                      size="sm"
                      iconLeading={Trash01}
                      isDisabled={isLive || deleteAgent.isPending}
                      onClick={() => {
                        deleteAgent.mutate(
                          { path: { id: String(agent.id) } },
                          {
                            onSuccess: () => {
                              if (selectedAgentId === agent.id) {
                                setSelectedAgentId(null);
                                setDraft(DEFAULT_DRAFT_SETTINGS);
                              }
                            },
                          },
                        );
                      }}
                    >
                      Delete agent
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="flex flex-col gap-4 rounded-2xl p-6 shadow-lg ring-1 ring-secondary">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-primary">Live conversation</h2>
                <p className="text-sm text-tertiary">
                  Agent:{" "}
                  <span className="font-medium text-secondary">
                    {selectedAgent?.displayName ?? "none selected"}
                  </span>
                  {" · "}
                  Status:{" "}
                  <span className="font-medium text-secondary">
                    {status === "disconnected" ? "ready" : status}
                  </span>
                  {mode !== "idle" ? ` · ${mode}` : ""}
                </p>
                {conversationId ? (
                  <p className="mt-1 text-xs text-quaternary">conv: {conversationId}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {toolWorking ? (
                  <Badge color="brand" size="sm" type="pill-color">
                    Looking something up…
                  </Badge>
                ) : null}
                {!isLive ? (
                  <Button
                    size="md"
                    iconLeading={Microphone01}
                    onClick={beginConversation}
                    isLoading={startSession.isPending}
                    isDisabled={selectedAgentId == null || startSession.isPending}
                  >
                    Start conversation
                  </Button>
                ) : (
                  <Button
                    size="md"
                    color="secondary-destructive"
                    iconLeading={PhoneHangUp}
                    onClick={endLiveConversation}
                    isLoading={updateSession.isPending}
                  >
                    End conversation
                  </Button>
                )}
              </div>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-secondary">
                Session memory bank
              </span>
              <textarea
                className="min-h-32 rounded-xl border border-secondary bg-primary px-3 py-3 text-sm text-primary placeholder:text-quaternary disabled:opacity-60"
                value={memoryBank}
                disabled={isLive}
                placeholder={`Example:\nPreferred pharmacy: Walgreens on Main St\nMedications: lisinopril 10mg daily, metformin 500mg BID\nAllergies: penicillin\nCaregiver: spouse Sam, prefers evening callbacks`}
                onChange={(event) => setMemoryBank(event.target.value)}
              />
              <span className="text-xs text-tertiary">
                Available to the agent via <code className="text-xs">query_memory_bank</code>{" "}
                for this call only. Exa web search and typing sounds stay enabled on every
                Level 4 agent.
              </span>
            </label>

            {(localError || mutationError || isError) && (
              <p className="text-sm text-error-primary">
                {localError ||
                  mutationError ||
                  getErrorMessage(error) ||
                  "Something went wrong"}
              </p>
            )}

            <div className="flex max-h-72 flex-col gap-3 overflow-y-auto rounded-xl bg-secondary p-4">
              {liveTranscript.length === 0 ? (
                <p className="text-sm text-tertiary">
                  {isLive
                    ? "Listening… the agent will greet you shortly."
                    : "Select a saved agent and start a conversation to stream the transcript."}
                </p>
              ) : (
                liveTranscript.map((entry, index) => (
                  <div key={`${entry.at}-${index}`} className="flex flex-col gap-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-quaternary">
                      {entry.role}
                    </p>
                    <p className="text-sm text-primary">{entry.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-2xl p-5 ring-1 ring-secondary">
              <h2 className="text-md font-semibold text-primary">Clinical context</h2>
              <dl className="grid gap-2 text-sm">
                {(
                  [
                    ["Symptom", clinicalContext.symptom],
                    ["Duration", clinicalContext.duration],
                    ["History", clinicalContext.history],
                    ["Medications", clinicalContext.currentMedications],
                    ["Unknowns", clinicalContext.unknowns],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-tertiary">{label}</dt>
                    <dd className="font-medium text-primary">{value || "—"}</dd>
                  </div>
                ))}
              </dl>
              {resolution ? (
                <div className="rounded-xl bg-secondary p-3 text-sm">
                  <p className="font-semibold text-primary">Resolution</p>
                  <p className="text-secondary">{resolution.summary}</p>
                  {resolution.confirmationId ? (
                    <p className="mt-1 text-xs text-quaternary">
                      {resolution.confirmationId}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 rounded-2xl p-5 ring-1 ring-secondary">
              <h2 className="text-md font-semibold text-primary">Live observability</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-tertiary">Avg latency</p>
                  <p className="font-semibold text-primary">
                    {metricValue(metrics.avgLatencyMs)}
                    {metrics.avgLatencyMs != null ? " ms" : ""}
                  </p>
                </div>
                <div>
                  <p className="text-tertiary">Turns</p>
                  <p className="font-semibold text-primary">
                    {metricValue(metrics.turnCount)}
                  </p>
                </div>
                <div>
                  <p className="text-tertiary">Tool calls</p>
                  <p className="font-semibold text-primary">
                    {metricValue(metrics.toolCallCount)}
                  </p>
                </div>
                <div>
                  <p className="text-tertiary">Interruptions</p>
                  <p className="font-semibold text-primary">
                    {metricValue(metrics.interruptionCount)}
                  </p>
                </div>
                <div>
                  <p className="text-tertiary">Avg VAD</p>
                  <p className="font-semibold text-primary">
                    {metricValue(metrics.avgVadScore)}
                  </p>
                </div>
                <div>
                  <p className="text-tertiary">LLM / TTS</p>
                  <p className="font-semibold text-primary">
                    {metricValue(metrics.llm)} / {metricValue(metrics.ttsModel)}
                  </p>
                </div>
              </div>

              {watchEvents.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold text-primary">Watch flags</p>
                  {watchEvents.slice(-4).map((event, index) => (
                    <p
                      key={`${event.at}-${index}`}
                      className={cx(
                        "rounded-lg px-3 py-2 text-xs",
                        event.data?.level === "critical"
                          ? "bg-error-primary/10 text-error-primary"
                          : "bg-secondary text-secondary",
                      )}
                    >
                      {event.message}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-tertiary">
                  Watch flags appear when the agent marks uncertainty, safety stops, or
                  handoffs.
                </p>
              )}

              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-xl bg-secondary p-3 font-mono text-[11px] text-tertiary">
                {events.length === 0 ? (
                  <span>Raw event log empty</span>
                ) : (
                  events.slice(-40).map((event, index) => (
                    <div key={`${event.at}-${event.type}-${index}`}>
                      [{new Date(event.at).toLocaleTimeString()}] {event.type}:{" "}
                      {event.message}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-primary">Past conversations</h2>
          {sessionsLoading ? (
            <p className="text-md text-tertiary">Loading conversations…</p>
          ) : !visibleSessions.length ? (
            <p className="text-md text-tertiary">
              No Level 4 visits yet for this agent. Start one above to persist transcript,
              clinical context, and metrics.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {visibleSessions.map((session) => (
                <li
                  key={session.id}
                  className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-secondary transition hover:bg-primary_hover sm:flex-row sm:items-start sm:justify-between"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedSession(session)}
                    className="flex min-w-0 flex-1 flex-col gap-1 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-md font-semibold text-primary">
                        {sessionTitle(session)}
                      </p>
                      <Badge
                        color={session.status === "active" ? "success" : "gray"}
                        size="sm"
                        type="pill-color"
                      >
                        {session.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-tertiary">
                      {session.agentDisplayName} · {formatDateTime(session.startedAt)} ·{" "}
                      {formatDuration(session.durationMs)}
                      {session.memoryBank.trim()
                        ? ` · memory ${session.memoryBank.trim().length} chars`
                        : ""}
                    </p>
                  </button>
                  <Button
                    color="secondary-destructive"
                    size="sm"
                    iconLeading={Trash01}
                    isDisabled={deleteSession.isPending}
                    onClick={() =>
                      deleteSession.mutate({
                        path: { id: String(session.id) },
                      })
                    }
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <ModalOverlay
        isOpen={selectedSession !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedSession(null);
        }}
        isDismissable
      >
        <Modal className="w-full max-w-2xl">
          <Dialog className="flex flex-col gap-5 p-6">
            {selectedSession ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-semibold text-primary">
                      {sessionTitle(selectedSession)}
                    </h3>
                    <p className="text-sm text-tertiary">
                      {selectedSession.agentDisplayName}
                      {selectedSession.elevenLabsConversationId
                        ? ` · ${selectedSession.elevenLabsConversationId}`
                        : ""}
                    </p>
                  </div>
                  <Button
                    color="tertiary"
                    size="sm"
                    aria-label="Close"
                    iconLeading={XClose}
                    onClick={() => setSelectedSession(null)}
                  />
                </div>

                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-tertiary">Duration</dt>
                    <dd className="font-medium text-primary">
                      {formatDuration(selectedSession.durationMs)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-tertiary">Avg latency</dt>
                    <dd className="font-medium text-primary">
                      {metricValue(selectedSession.metrics.avgLatencyMs)}
                      {selectedSession.metrics.avgLatencyMs != null ? " ms" : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-tertiary">Cost (USD)</dt>
                    <dd className="font-medium text-primary">
                      {metricValue(selectedSession.metrics.elevenLabsCostUsd)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-tertiary">Credits</dt>
                    <dd className="font-medium text-primary">
                      {metricValue(selectedSession.metrics.elevenLabsCostCredits)}
                    </dd>
                  </div>
                </dl>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <h4 className="text-sm font-semibold text-primary">Clinical context</h4>
                    <pre className="max-h-48 overflow-auto rounded-xl bg-secondary p-3 text-xs text-secondary">
                      {JSON.stringify(selectedSession.clinicalContext, null, 2)}
                    </pre>
                  </div>
                  <div className="flex flex-col gap-2">
                    <h4 className="text-sm font-semibold text-primary">Metrics</h4>
                    <pre className="max-h-48 overflow-auto rounded-xl bg-secondary p-3 text-xs text-secondary">
                      {JSON.stringify(selectedSession.metrics, null, 2)}
                    </pre>
                  </div>
                </div>

                {selectedSession.memoryBank.trim() ? (
                  <div className="flex flex-col gap-2">
                    <h4 className="text-sm font-semibold text-primary">Memory bank</h4>
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-secondary p-3 text-xs text-secondary">
                      {selectedSession.memoryBank}
                    </pre>
                  </div>
                ) : null}

                {selectedSession.resolution ? (
                  <div className="rounded-xl bg-secondary p-3 text-sm">
                    <p className="font-semibold text-primary">Resolution</p>
                    <p className="text-secondary">{selectedSession.resolution.summary}</p>
                  </div>
                ) : null}

                <div className="flex flex-col gap-3">
                  <h4 className="text-sm font-semibold text-primary">Transcript</h4>
                  <div className="flex max-h-64 flex-col gap-3 overflow-y-auto rounded-xl bg-secondary p-4">
                    {selectedSession.transcript.length === 0 ? (
                      <p className="text-sm text-tertiary">No transcript captured.</p>
                    ) : (
                      selectedSession.transcript.map((entry, index) => (
                        <div key={`${entry.at}-${index}`} className="flex flex-col gap-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-quaternary">
                            {entry.role}
                          </p>
                          <p className="text-sm text-primary">{entry.text}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </main>
  );
}

export function Level4AgentPage() {
  return (
    <ConversationProvider>
      <Level4AgentExperience />
    </ConversationProvider>
  );
}
