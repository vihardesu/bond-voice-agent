"use client";

import { useEffect, useRef, useState } from "react";

type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

type TranscriptEntry = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type RealtimeEvent = {
  type: string;
  transcript?: string;
  delta?: string;
  error?: { message?: string };
};

function extractTranscript(event: RealtimeEvent): string | null {
  if (typeof event.transcript === "string" && event.transcript.trim()) {
    return event.transcript.trim();
  }
  if (typeof event.delta === "string" && event.delta.trim()) {
    return event.delta.trim();
  }
  return null;
}

export default function VoiceConversation() {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [assistantDraft, setAssistantDraft] = useState("");

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const assistantDraftRef = useRef("");

  function cleanup() {
    dataChannelRef.current?.close();
    dataChannelRef.current = null;

    peerConnectionRef.current?.getSenders().forEach((sender) => {
      sender.track?.stop();
    });
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;

    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
      audioElementRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  function appendTranscript(role: "user" | "assistant", text: string) {
    setTranscripts((prev) => [
      ...prev,
      {
        id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role,
        text,
      },
    ]);
  }

  function handleRealtimeEvent(raw: string) {
    let event: RealtimeEvent;
    try {
      event = JSON.parse(raw) as RealtimeEvent;
    } catch {
      return;
    }

    switch (event.type) {
      case "conversation.item.input_audio_transcription.completed": {
        const text = extractTranscript(event);
        if (text) appendTranscript("user", text);
        break;
      }
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta": {
        if (typeof event.delta === "string") {
          assistantDraftRef.current += event.delta;
          setAssistantDraft(assistantDraftRef.current);
        }
        break;
      }
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done": {
        const text = extractTranscript(event) ?? assistantDraftRef.current;
        if (text.trim()) appendTranscript("assistant", text.trim());
        assistantDraftRef.current = "";
        setAssistantDraft("");
        break;
      }
      case "error": {
        setError(event.error?.message ?? "Realtime session error");
        setStatus("error");
        break;
      }
      default:
        break;
    }
  }

  async function startConversation() {
    setError(null);
    setStatus("connecting");
    setTranscripts([]);
    assistantDraftRef.current = "";
    setAssistantDraft("");

    try {
      const tokenResponse = await fetch("/api/realtime/session", {
        method: "POST",
      });
      const tokenData = (await tokenResponse.json()) as {
        value?: string;
        error?: string;
      };

      if (!tokenResponse.ok || !tokenData.value) {
        throw new Error(tokenData.error ?? "Failed to create realtime session");
      }

      const ephemeralKey = tokenData.value;
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioElementRef.current = audioEl;
      pc.ontrack = (event) => {
        audioEl.srcObject = event.streams[0];
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      mediaStreamRef.current = mediaStream;
      mediaStream.getTracks().forEach((track) => pc.addTrack(track, mediaStream));

      const dataChannel = pc.createDataChannel("oai-events");
      dataChannelRef.current = dataChannel;
      dataChannel.addEventListener("message", (event) => {
        handleRealtimeEvent(String(event.data));
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch(
        "https://api.openai.com/v1/realtime/calls",
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            "Content-Type": "application/sdp",
          },
        },
      );

      if (!sdpResponse.ok) {
        const details = await sdpResponse.text();
        throw new Error(details || "Failed to connect to OpenAI Realtime");
      }

      const answer: RTCSessionDescriptionInit = {
        type: "answer",
        sdp: await sdpResponse.text(),
      };
      await pc.setRemoteDescription(answer);

      setStatus("connected");
    } catch (err) {
      cleanup();
      const message =
        err instanceof Error ? err.message : "Unable to start conversation";
      setError(message);
      setStatus("error");
    }
  }

  function stopConversation() {
    cleanup();
    setStatus("idle");
    setAssistantDraft("");
  }

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  return (
    <section className="flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
          Speech to speech
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
          Bond Voice Agent
        </h1>
        <p className="max-w-md text-base text-zinc-600">
          Talk with OpenAI&apos;s realtime audio model. Grant mic access, then
          speak naturally — the model replies in voice.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        {!isConnected ? (
          <button
            type="button"
            onClick={startConversation}
            disabled={isConnecting}
            className="rounded-full bg-zinc-900 px-8 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isConnecting ? "Connecting…" : "Start conversation"}
          </button>
        ) : (
          <button
            type="button"
            onClick={stopConversation}
            className="rounded-full bg-red-600 px-8 py-3 text-sm font-medium text-white transition hover:bg-red-500"
          >
            End conversation
          </button>
        )}

        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              isConnected
                ? "bg-emerald-500"
                : status === "error"
                  ? "bg-red-500"
                  : isConnecting
                    ? "bg-amber-400"
                    : "bg-zinc-300"
            }`}
          />
          {isConnected
            ? "Listening — speak anytime"
            : isConnecting
              ? "Setting up WebRTC session"
              : status === "error"
                ? "Connection failed"
                : "Ready"}
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="min-h-48 rounded-2xl border border-zinc-200 bg-white p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
          Live transcript
        </p>
        <div className="flex max-h-72 flex-col gap-3 overflow-y-auto">
          {transcripts.length === 0 && !assistantDraft ? (
            <p className="text-sm text-zinc-400">
              Transcripts will appear here once you start talking.
            </p>
          ) : null}
          {transcripts.map((entry) => (
            <div
              key={entry.id}
              className={`text-sm leading-relaxed ${
                entry.role === "user" ? "text-zinc-800" : "text-zinc-600"
              }`}
            >
              <span className="mr-2 font-medium text-zinc-400">
                {entry.role === "user" ? "You" : "Assistant"}
              </span>
              {entry.text}
            </div>
          ))}
          {assistantDraft ? (
            <div className="text-sm leading-relaxed text-zinc-600">
              <span className="mr-2 font-medium text-zinc-400">Assistant</span>
              {assistantDraft}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
