const DEFAULT_MODEL = "gpt-realtime-2.1";
const DEFAULT_VOICE = "marin";

export type ClientSecretResult = {
  value: string;
  expiresAt?: number;
  model: string;
  voice: string;
};

export async function createRealtimeClientSecret(options?: {
  model?: string;
  voice?: string;
}): Promise<ClientSecretResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const model = options?.model?.trim() || DEFAULT_MODEL;
  const voice = options?.voice?.trim() || DEFAULT_VOICE;

  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model,
        audio: {
          input: {
            transcription: {
              model: "gpt-4o-mini-transcribe",
            },
          },
          output: {
            voice,
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Failed to create OpenAI client secret (${response.status}): ${detail || response.statusText}`,
    );
  }

  const data = (await response.json()) as {
    value?: string;
    expires_at?: number;
  };

  if (!data.value) {
    throw new Error("OpenAI client secret response missing value");
  }

  return {
    value: data.value,
    expiresAt: data.expires_at,
    model,
    voice,
  };
}
