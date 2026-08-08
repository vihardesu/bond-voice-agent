"use client";

import { ConversationsSidecar } from "@/components/ConversationsSidecar";

export function AppTopbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Bond Voice Agent
          </span>
        </div>

        <ConversationsSidecar />
      </div>
    </header>
  );
}
