"use client";

import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TranscriptMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sequence: number;
};

type ConversationDetail = {
  id: string;
  title: string;
  durationMs: number;
  startedAt: string;
  endedAt: string;
  createdAt: string;
  messages: TranscriptMessage[];
};

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString();
}

type ConversationDetailModalProps = {
  conversationId: string | null;
  onOpenChange: (open: boolean) => void;
};

export function ConversationDetailModal({
  conversationId,
  onOpenChange,
}: ConversationDetailModalProps) {
  const open = conversationId != null;
  const [conversation, setConversation] = useState<ConversationDetail | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId) {
      setConversation(null);
      setError(null);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/conversations/${conversationId}`);
        const data = (await response.json()) as {
          conversation?: ConversationDetail;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load conversation");
        }
        if (!cancelled) {
          setConversation(data.conversation ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load conversation",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {conversation?.title ?? "Conversation details"}
          </DialogTitle>
          <DialogDescription>
            {conversation
              ? `${formatTimestamp(conversation.startedAt)} · ${formatDuration(conversation.durationMs)}`
              : "Full transcript and session metadata"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
          {loading ? (
            <p className="py-6 text-sm text-muted-foreground">
              Loading transcript…
            </p>
          ) : null}

          {error ? (
            <p className="py-6 text-sm text-destructive">{error}</p>
          ) : null}

          {!loading && !error && conversation ? (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted/60 p-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">Started</dt>
                  <dd className="mt-0.5 text-foreground">
                    {formatTimestamp(conversation.startedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Ended</dt>
                  <dd className="mt-0.5 text-foreground">
                    {formatTimestamp(conversation.endedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Duration</dt>
                  <dd className="mt-0.5 text-foreground">
                    {formatDuration(conversation.durationMs)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Messages</dt>
                  <dd className="mt-0.5 text-foreground">
                    {conversation.messages.length}
                  </dd>
                </div>
              </dl>

              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Transcript
                </p>
                {conversation.messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No transcript messages were saved.
                  </p>
                ) : (
                  conversation.messages.map((message) => (
                    <div
                      key={message.id}
                      className="rounded-lg border border-border/70 px-3 py-2"
                    >
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        {message.role === "user" ? "You" : "Assistant"}
                      </p>
                      <p className="text-sm leading-relaxed text-foreground">
                        {message.content}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
