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
  ConciergeClinicalContext,
  ConciergeMetrics,
  ConciergeObservabilityEvent,
  ConciergeResolution,
  ConciergeSession,
  ConciergeTranscriptEntry,
} from "@/client";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import {
  useConciergeDoctorSessions,
  useDeleteConciergeDoctorSession,
  useMockConciergePharmacyRequest,
  useMockConciergeScheduleFollowUp,
  useStartConciergeDoctorSession,
  useUpdateConciergeDoctorSession,
} from "@/hooks/use-concierge-doctor";
import { cx } from "@/utils/cx";

type CommunicationStyle = "patient" | "balanced" | "direct";
type ResolutionValue = NonNullable<ConciergeResolution>;

function getErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof globalThis.Error) return error.message;
  if (
    typeof error === "object" &&
    "error" in error &&
    typeof (error as { error: unknown }).error === "string"
  ) {
    return (error as { error: string }).error;
  }
  return "Something went wrong";
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

function sessionTitle(session: ConciergeSession): string {
  if (session.title.trim()) return session.title;
  if (session.clinicalContext.symptom) {
    return session.clinicalContext.symptom;
  }
  return `Visit ${formatDateTime(session.startedAt)}`;
}

function metricValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}

function ConciergeDoctorExperience() {
  const { data: sessions, isLoading, isError, error } = useConciergeDoctorSessions();
  const startSession = useStartConciergeDoctorSession();
  const updateSession = useUpdateConciergeDoctorSession();
  const deleteSession = useDeleteConciergeDoctorSession();
  const mockPharmacy = useMockConciergePharmacyRequest();
  const mockSchedule = useMockConciergeScheduleFollowUp();

  const { startSession: startConversation, endSession } = useConversationControls();
  const { status } = useConversationStatus();

  const [communicationStyle, setCommunicationStyle] =
    useState<CommunicationStyle>("balanced");
  const [explanationLevel, setExplanationLevel] = useState(55);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<ConciergeTranscriptEntry[]>([]);
  const [clinicalContext, setClinicalContext] = useState<ConciergeClinicalContext>({});
  const [resolution, setResolution] = useState<ResolutionValue | null>(null);
  const [events, setEvents] = useState<ConciergeObservabilityEvent[]>([]);
  const [metrics, setMetrics] = useState<ConciergeMetrics>({});
  const [selectedSession, setSelectedSession] = useState<ConciergeSession | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [mode, setMode] = useState<"speaking" | "listening" | "idle">("idle");

  const startedAtRef = useRef<number | null>(null);
  const transcriptRef = useRef<ConciergeTranscriptEntry[]>([]);
  const eventsRef = useRef<ConciergeObservabilityEvent[]>([]);
  const clinicalRef = useRef<ConciergeClinicalContext>({});
  const resolutionRef = useRef<ResolutionValue | null>(null);
  const latencySamplesRef = useRef<number[]>([]);
  const vadSamplesRef = useRef<number[]>([]);
  const activeSessionIdRef = useRef<number | null>(null);
  const pendingAppendRef = useRef<ConciergeObservabilityEvent[]>([]);

  const isLive = status === "connecting" || status === "connected";

  const pushEvent = (event: ConciergeObservabilityEvent) => {
    eventsRef.current = [...eventsRef.current, event];
    pendingAppendRef.current = [...pendingAppendRef.current, event];
    setEvents(eventsRef.current);
  };

  const pushTranscript = (role: "user" | "agent", text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const entry: ConciergeTranscriptEntry = {
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
    const next: ConciergeMetrics = {
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
      ttsModel: "eleven_flash_v2_5",
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

  useConversationClientTool("update_clinical_context", async (params) => {
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

  const endLiveConversation = async () => {
    const sessionId = activeSessionIdRef.current;
    endSession();
    setMode("idle");

    if (sessionId == null) return;

    const endedAt = new Date();
    const startedAt = startedAtRef.current ?? endedAt.getTime();
    const durationMs = Math.max(0, endedAt.getTime() - startedAt);
    const localMetrics = recomputeLocalMetrics();

    try {
      await updateSession.mutateAsync({
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
              message: "Conversation ended",
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
    } catch (err) {
      setLocalError(getErrorMessage(err) || "Failed to save conversation");
    } finally {
      setActiveSessionId(null);
      activeSessionIdRef.current = null;
      setConversationId(null);
      startedAtRef.current = null;
    }
  };

  const beginConversation = async () => {
    if (isLive) return;
    setLocalError(null);
    setLiveTranscript([]);
    setClinicalContext({});
    setResolution(null);
    setEvents([]);
    setMetrics({});
    transcriptRef.current = [];
    eventsRef.current = [];
    clinicalRef.current = {};
    resolutionRef.current = null;
    latencySamplesRef.current = [];
    vadSamplesRef.current = [];
    pendingAppendRef.current = [];

    try {
      const started = await startSession.mutateAsync({
        body: {
          communicationStyle,
          explanationLevel,
          forceSyncAgent: false,
        },
      });

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
        onDisconnect: () => {
          pushEvent({
            at: new Date().toISOString(),
            type: "status",
            message: "Disconnected",
          });
          setMode("idle");
        },
        onError: (message) => {
          setLocalError(message);
          pushEvent({
            at: new Date().toISOString(),
            type: "error",
            message,
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
          pushEvent({
            at: new Date().toISOString(),
            type: "tool_request",
            message: "Agent tool request",
            data: request as unknown as Record<string, unknown>,
          });
          recomputeLocalMetrics();
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
      setLocalError(getErrorMessage(err) || "Failed to start concierge conversation");
      setActiveSessionId(null);
      activeSessionIdRef.current = null;
    }
  };

  const mutationError = getErrorMessage(
    startSession.error || updateSession.error || deleteSession.error,
  );

  const watchEvents = events.filter((event) => event.type === "watch");

  return (
    <main className="flex min-h-dvh flex-1 justify-center bg-primary px-4 py-10">
      <section className="flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Badge color="brand" size="sm" type="pill-color">
            ElevenLabs · Concierge doctor
          </Badge>
          <div className="flex flex-col gap-1">
            <h1 className="text-display-xs font-semibold text-primary">
              Empathetic concierge doctor
            </h1>
            <p className="text-md text-tertiary">
              Talk with Mira, dial empathy vs. directness, extract clinical context, take
              mock care actions, and watch live observability while the call runs.
            </p>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="flex flex-col gap-4 rounded-2xl p-6 shadow-lg ring-1 ring-secondary">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-primary">Live conversation</h2>
                <p className="text-sm text-tertiary">
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
              <div className="flex gap-2">
                {!isLive ? (
                  <Button
                    size="md"
                    iconLeading={Microphone01}
                    onClick={beginConversation}
                    isLoading={startSession.isPending}
                    isDisabled={startSession.isPending}
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

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-secondary">
                  Communication style
                </span>
                <select
                  className="rounded-lg border border-secondary bg-primary px-3 py-2 text-sm text-primary"
                  value={communicationStyle}
                  disabled={isLive}
                  onChange={(event) =>
                    setCommunicationStyle(event.target.value as CommunicationStyle)
                  }
                >
                  <option value="patient">Patient — more validation</option>
                  <option value="balanced">Balanced</option>
                  <option value="direct">Direct — concise</option>
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-secondary">
                  Explanation level: {explanationLevel}
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={explanationLevel}
                  disabled={isLive}
                  onChange={(event) => setExplanationLevel(Number(event.target.value))}
                  className="w-full"
                />
                <span className="text-xs text-tertiary">
                  0 assumes context · 100 explains every step
                </span>
              </label>
            </div>

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
                    ? "Listening… Mira will greet you shortly."
                    : "Start a conversation to stream the transcript here."}
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
                  <p className="text-tertiary">TTS model</p>
                  <p className="font-semibold text-primary">
                    {metricValue(metrics.ttsModel)}
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
                  Watch flags appear when Mira marks uncertainty, safety stops, or
                  handoffs.
                </p>
              )}

              <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-xl bg-secondary p-3 font-mono text-[11px] text-tertiary">
                {events.length === 0 ? (
                  <span>Raw event log empty</span>
                ) : (
                  events
                    .slice(-40)
                    .map((event, index) => (
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
          {isLoading ? (
            <p className="text-md text-tertiary">Loading conversations…</p>
          ) : !sessions?.length ? (
            <p className="text-md text-tertiary">
              No concierge visits yet. Start one above to persist transcript, clinical
              context, and metrics.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {sessions.map((session) => (
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
                      {session.resolution?.type === "human_handoff" ? (
                        <Badge color="warning" size="sm" type="pill-color">
                          handoff
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-tertiary">
                      {formatDateTime(session.startedAt)} ·{" "}
                      {formatDuration(session.durationMs)} · style{" "}
                      {session.communicationStyle} · explain {session.explanationLevel}
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
                      {selectedSession.elevenLabsConversationId || "No remote conversation id"}
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

export function ConciergeDoctorPage() {
  return (
    <ConversationProvider>
      <ConciergeDoctorExperience />
    </ConversationProvider>
  );
}
