export type TranscriptRole = "user" | "assistant";

export type LiveTranscriptEntry = {
  role: TranscriptRole;
  text: string;
  at: string;
};

type RealtimeServerEvent = {
  type: string;
  transcript?: string;
  delta?: string;
};

export type RealtimeSpeechConnection = {
  peerConnection: RTCPeerConnection;
  dataChannel: RTCDataChannel;
  mediaStream: MediaStream;
  audioElement: HTMLAudioElement;
  stop: () => void;
};

function appendTranscript(
  entries: LiveTranscriptEntry[],
  role: TranscriptRole,
  text: string,
): LiveTranscriptEntry[] {
  const trimmed = text.trim();
  if (!trimmed) return entries;
  return [
    ...entries,
    {
      role,
      text: trimmed,
      at: new Date().toISOString(),
    },
  ];
}

export async function connectRealtimeSpeech(options: {
  ephemeralKey: string;
  onTranscript: (entries: LiveTranscriptEntry[]) => void;
  onStatus?: (status: "connecting" | "connected" | "disconnected") => void;
  onError?: (error: Error) => void;
}): Promise<RealtimeSpeechConnection> {
  const { ephemeralKey, onTranscript, onStatus, onError } = options;
  let transcript: LiveTranscriptEntry[] = [];
  let assistantBuffer = "";

  onStatus?.("connecting");

  const peerConnection = new RTCPeerConnection();
  const audioElement = document.createElement("audio");
  audioElement.autoplay = true;

  peerConnection.ontrack = (event) => {
    audioElement.srcObject = event.streams[0] ?? null;
  };

  const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  for (const track of mediaStream.getTracks()) {
    peerConnection.addTrack(track, mediaStream);
  }

  const dataChannel = peerConnection.createDataChannel("oai-events");

  dataChannel.addEventListener("open", () => {
    onStatus?.("connected");
  });

  dataChannel.addEventListener("message", (event) => {
    try {
      const serverEvent = JSON.parse(String(event.data)) as RealtimeServerEvent;

      if (serverEvent.type === "conversation.item.input_audio_transcription.completed") {
        transcript = appendTranscript(transcript, "user", serverEvent.transcript ?? "");
        onTranscript(transcript);
        return;
      }

      if (serverEvent.type === "response.output_audio_transcript.delta") {
        assistantBuffer += serverEvent.delta ?? "";
        return;
      }

      if (serverEvent.type === "response.output_audio_transcript.done") {
        const text = serverEvent.transcript || assistantBuffer;
        assistantBuffer = "";
        transcript = appendTranscript(transcript, "assistant", text);
        onTranscript(transcript);
      }
    } catch (error) {
      onError?.(
        error instanceof Error ? error : new Error("Failed to parse realtime event"),
      );
    }
  });

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    body: offer.sdp ?? "",
    headers: {
      Authorization: `Bearer ${ephemeralKey}`,
      "Content-Type": "application/sdp",
    },
  });

  if (!sdpResponse.ok) {
    const detail = await sdpResponse.text();
    mediaStream.getTracks().forEach((track) => track.stop());
    peerConnection.close();
    throw new Error(
      `Failed to start realtime call (${sdpResponse.status}): ${detail || sdpResponse.statusText}`,
    );
  }

  const answer: RTCSessionDescriptionInit = {
    type: "answer",
    sdp: await sdpResponse.text(),
  };
  await peerConnection.setRemoteDescription(answer);

  const stop = () => {
    dataChannel.close();
    mediaStream.getTracks().forEach((track) => track.stop());
    peerConnection.getSenders().forEach((sender) => sender.track?.stop());
    peerConnection.close();
    audioElement.srcObject = null;
    onStatus?.("disconnected");
  };

  peerConnection.addEventListener("connectionstatechange", () => {
    if (
      peerConnection.connectionState === "failed" ||
      peerConnection.connectionState === "closed" ||
      peerConnection.connectionState === "disconnected"
    ) {
      onStatus?.("disconnected");
    }
  });

  return {
    peerConnection,
    dataChannel,
    mediaStream,
    audioElement,
    stop,
  };
}
