"use client";

import { useEffect, useRef, useState } from "react";
import { Microphone01, PhoneHangUp, Trash01, XClose } from "@untitledui/icons";

import type { SpeechSession, SpeechTranscriptEntry } from "@/client";
import { Dialog, Modal, ModalOverlay } from "@/components/application/modals/modal";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";
import {
  useCreateSpeechClientSecret,
  useCreateSpeechSession,
  useDeleteSpeechSession,
  useSpeechSessions,
  useUpdateSpeechSession,
} from "@/hooks/use-speech-sessions";
import {
  connectRealtimeSpeech,
  type LiveTranscriptEntry,
  type RealtimeSpeechConnection,
} from "@/lib/realtime-speech";

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

function sessionTitle(session: SpeechSession): string {
  if (session.title.trim()) return session.title;
  return `Conversation ${formatDateTime(session.startedAt)}`;
}

export function SpeechSessionsPage() {
  const { data: sessions, isLoading, isError, error } = useSpeechSessions();
  const createSession = useCreateSpeechSession();
  const updateSession = useUpdateSpeechSession();
  const deleteSession = useDeleteSpeechSession();
  const createClientSecret = useCreateSpeechClientSecret();

  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "connecting" | "connected" | "disconnected"
  >("idle");
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [liveTranscript, setLiveTranscript] = useState<LiveTranscriptEntry[]>([]);
  const [selectedSession, setSelectedSession] = useState<SpeechSession | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const connectionRef = useRef<RealtimeSpeechConnection | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const transcriptRef = useRef<LiveTranscriptEntry[]>([]);

  useEffect(() => {
    return () => {
      connectionRef.current?.stop();
      connectionRef.current = null;
    };
  }, []);

  const isLive = connectionStatus === "connecting" || connectionStatus === "connected";
  const mutationError = getErrorMessage(
    createSession.error ||
      updateSession.error ||
      deleteSession.error ||
      createClientSecret.error,
  );

  const persistSessionEnd = async (sessionId: number, transcript: LiveTranscriptEntry[]) => {
    const endedAt = new Date();
    const startedAt = startedAtRef.current ?? endedAt.getTime();
    const durationMs = Math.max(0, endedAt.getTime() - startedAt);

    await updateSession.mutateAsync({
      path: { id: String(sessionId) },
      body: {
        status: "ended",
        endedAt: endedAt.toISOString(),
        durationMs,
        transcript: transcript as SpeechTranscriptEntry[],
        title:
          transcript.find((entry) => entry.role === "user")?.text.slice(0, 80) ||
          `Conversation ${formatDateTime(endedAt.toISOString())}`,
      },
    });
  };

  const endConversation = async () => {
    const sessionId = activeSessionId;
    const transcript = transcriptRef.current;
    connectionRef.current?.stop();
    connectionRef.current = null;
    setConnectionStatus("disconnected");

    if (sessionId != null) {
      try {
        await persistSessionEnd(sessionId, transcript);
      } catch (err) {
        setLocalError(getErrorMessage(err) || "Failed to save conversation");
      }
    }

    setActiveSessionId(null);
    setLiveTranscript([]);
    transcriptRef.current = [];
    startedAtRef.current = null;
  };

  const startConversation = async () => {
    if (isLive) return;
    setLocalError(null);
    let createdSessionId: number | null = null;

    try {
      const session = await createSession.mutateAsync({
        body: {
          title: "",
          model: "gpt-realtime-2.1",
          voice: "marin",
        },
      });

      createdSessionId = session.id;
      setActiveSessionId(session.id);
      startedAtRef.current = Date.now();
      transcriptRef.current = [];
      setLiveTranscript([]);
      setConnectionStatus("connecting");

      const secret = await createClientSecret.mutateAsync({
        body: {
          model: session.model,
          voice: session.voice,
        },
      });

      const connection = await connectRealtimeSpeech({
        ephemeralKey: secret.value,
        onTranscript: (entries) => {
          transcriptRef.current = entries;
          setLiveTranscript(entries);
        },
        onStatus: (status) => {
          setConnectionStatus(status);
        },
        onError: (err) => {
          setLocalError(err.message);
        },
      });

      connectionRef.current = connection;
    } catch (err) {
      connectionRef.current?.stop();
      connectionRef.current = null;
      setConnectionStatus("idle");

      if (createdSessionId != null) {
        try {
          await persistSessionEnd(createdSessionId, transcriptRef.current);
        } catch {
          // Ignore secondary persistence errors while surfacing the primary failure.
        }
      }

      setActiveSessionId(null);
      setLiveTranscript([]);
      transcriptRef.current = [];
      startedAtRef.current = null;
      setLocalError(getErrorMessage(err) || "Failed to start conversation");
    }
  };

  return (
    <main className="flex min-h-dvh flex-1 justify-center bg-primary px-4 py-10">
      <section className="flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <Badge color="brand" size="sm" type="pill-color">
            Level 1 Agent
          </Badge>
          <div className="flex flex-col gap-2">
            <h1 className="text-display-xs font-semibold text-primary">
              Level 1 Agent
            </h1>
            <p className="text-md text-tertiary">
              A basic voice agent built on OpenAI&apos;s latest speech-to-speech realtime model
              (`gpt-realtime-2.1`, voice `marin`). There is no custom harness, system prompt,
              tool layer, or guardrail stack — the browser opens a raw WebRTC session and you
              talk directly to the model. Saved transcripts below are for review only.
            </p>
          </div>
        </header>

        <div className="flex flex-col gap-4 rounded-2xl p-6 shadow-lg ring-1 ring-secondary">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-primary">Live conversation</h2>
              <p className="text-sm text-tertiary">
                Status:{" "}
                <span className="font-medium text-secondary">
                  {connectionStatus === "idle" ? "ready" : connectionStatus}
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              {!isLive ? (
                <Button
                  size="md"
                  iconLeading={Microphone01}
                  onClick={startConversation}
                  isLoading={createSession.isPending || createClientSecret.isPending}
                  isDisabled={createSession.isPending || createClientSecret.isPending}
                >
                  Start conversation
                </Button>
              ) : (
                <Button
                  size="md"
                  color="secondary-destructive"
                  iconLeading={PhoneHangUp}
                  onClick={endConversation}
                  isLoading={updateSession.isPending}
                >
                  End conversation
                </Button>
              )}
            </div>
          </div>

          {(localError || mutationError || isError) && (
            <p className="text-sm text-error-primary">
              {localError || mutationError || getErrorMessage(error) || "Something went wrong"}
            </p>
          )}

          {isLive || liveTranscript.length > 0 ? (
            <div className="flex max-h-72 flex-col gap-3 overflow-y-auto rounded-xl bg-secondary p-4">
              {liveTranscript.length === 0 ? (
                <p className="text-sm text-tertiary">Listening… start speaking anytime.</p>
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
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-primary">Past conversations</h2>

          {isLoading ? (
            <p className="text-md text-tertiary">Loading conversations…</p>
          ) : !sessions?.length ? (
            <p className="text-md text-tertiary">
              No conversations yet. Start one above to persist a transcript.
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
                    </div>
                    <p className="text-sm text-tertiary">
                      Started {formatDateTime(session.startedAt)} · Duration{" "}
                      {formatDuration(session.durationMs)}
                    </p>
                  </button>

                  <div className="flex shrink-0 gap-2">
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
                  </div>
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
        <Modal className="w-full max-w-xl">
          <Dialog className="flex flex-col gap-5 p-6">
            {selectedSession ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-semibold text-primary">
                      {sessionTitle(selectedSession)}
                    </h3>
                    <p className="text-sm text-tertiary">
                      {selectedSession.model} · {selectedSession.voice}
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

                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-tertiary">Started</dt>
                    <dd className="font-medium text-primary">
                      {formatDateTime(selectedSession.startedAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-tertiary">Ended</dt>
                    <dd className="font-medium text-primary">
                      {formatDateTime(selectedSession.endedAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-tertiary">Duration</dt>
                    <dd className="font-medium text-primary">
                      {formatDuration(selectedSession.durationMs)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-tertiary">Status</dt>
                    <dd className="font-medium text-primary">{selectedSession.status}</dd>
                  </div>
                </dl>

                <div className="flex flex-col gap-3">
                  <h4 className="text-sm font-semibold text-primary">Transcript</h4>
                  {selectedSession.transcript.length === 0 ? (
                    <p className="text-sm text-tertiary">No transcript captured.</p>
                  ) : (
                    <div className="flex max-h-80 flex-col gap-3 overflow-y-auto rounded-xl bg-secondary p-4">
                      {selectedSession.transcript.map((entry, index) => (
                        <div key={`${entry.at}-${index}`} className="flex flex-col gap-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-quaternary">
                            {entry.role}
                          </p>
                          <p className="text-sm text-primary">{entry.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </main>
  );
}
