"use client";

import { useCallback, useEffect, useState } from "react";
import { MessagesSquare } from "lucide-react";

import { ConversationDetailModal } from "@/components/ConversationDetailModal";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type ConversationSummary = {
  id: string;
  title: string;
  durationMs: number;
  startedAt: string;
  endedAt: string;
  createdAt: string;
  messageCount: number;
  preview: string | null;
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
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ConversationsSidecar() {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/conversations");
      const data = (await response.json()) as {
        conversations?: ConversationSummary[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load conversations");
      }
      setConversations(data.conversations ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load conversations",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadConversations();
  }, [open, loadConversations]);

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="outline" size="sm" />}>
          <MessagesSquare data-icon="inline-start" />
          View Conversations
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader className="border-b border-border">
            <SheetTitle>Conversations</SheetTitle>
            <SheetDescription>
              Past voice sessions saved on this deployment.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {loading ? (
              <p className="px-2 py-6 text-sm text-muted-foreground">
                Loading conversations…
              </p>
            ) : null}

            {error ? (
              <div className="space-y-3 px-2 py-6">
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="outline" size="sm" onClick={loadConversations}>
                  Try again
                </Button>
              </div>
            ) : null}

            {!loading && !error && conversations.length === 0 ? (
              <p className="px-2 py-6 text-sm text-muted-foreground">
                No conversations yet. Start talking, then end a session to save
                it.
              </p>
            ) : null}

            {!loading && !error && conversations.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {conversations.map((conversation) => (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(conversation.id)}
                      className="w-full rounded-lg px-3 py-3 text-left transition hover:bg-muted"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="line-clamp-2 text-sm font-medium text-foreground">
                          {conversation.title}
                        </p>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatDuration(conversation.durationMs)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatTimestamp(conversation.endedAt)} ·{" "}
                        {conversation.messageCount} messages
                      </p>
                      {conversation.preview ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/90">
                          {conversation.preview}
                        </p>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <ConversationDetailModal
        conversationId={selectedId}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedId(null);
        }}
      />
    </>
  );
}
