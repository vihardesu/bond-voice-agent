/** Exa instant search for Level 4 voice lookups. */

export type ExaSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export type ExaSearchResponse = {
  query: string;
  results: ExaSearchResult[];
};

function getExaApiKey(): string {
  const key = process.env.EXA_API_KEY?.trim();
  if (!key) {
    throw new Error("EXA_API_KEY is not configured");
  }
  return key;
}

function pickSnippet(result: Record<string, unknown>): string {
  const highlights = result.highlights;
  if (Array.isArray(highlights) && highlights.length > 0) {
    return highlights
      .map((item) => String(item))
      .join(" ")
      .slice(0, 420);
  }
  if (typeof result.text === "string" && result.text.trim()) {
    return result.text.trim().slice(0, 420);
  }
  if (typeof result.summary === "string" && result.summary.trim()) {
    return result.summary.trim().slice(0, 420);
  }
  return "";
}

export async function searchWebWithExa(query: string): Promise<ExaSearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error("Search query is required");
  }

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": getExaApiKey(),
      "x-exa-integration": "elevenlabs",
    },
    body: JSON.stringify({
      query: trimmed,
      type: "instant",
      numResults: 5,
      contents: {
        highlights: true,
      },
    }),
  });

  const payload = (await response.json()) as {
    results?: Array<Record<string, unknown>>;
    error?: string;
    detail?: string;
  };

  if (!response.ok) {
    throw new Error(
      payload.error ||
        payload.detail ||
        `Exa search failed with status ${response.status}`,
    );
  }

  const results = (payload.results ?? []).slice(0, 5).map((result) => ({
    title: typeof result.title === "string" ? result.title : "Untitled",
    url: typeof result.url === "string" ? result.url : "",
    snippet: pickSnippet(result),
  }));

  return { query: trimmed, results };
}
