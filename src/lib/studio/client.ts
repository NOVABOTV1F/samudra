export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatProvider =
  | "brain"
  | "deepseek"
  | "groq"
  | "claude"
  | "gemini"
  | "xai"
  | "v1"
  | "v2"
  | "v3";

export type SystemStatus = {
  version: string;
  deepseek: boolean;
  groq: boolean;
  claude?: boolean;
  models?: { v1?: string; v2?: string; v3?: string };
  endpoints?: { v1?: string; v3?: string };
  time: string;
  ready?: boolean;
};

export async function streamChat(options: {
  messages: ChatTurn[];
  signal: AbortSignal;
  onDelta: (chunk: string) => void;
  provider?: ChatProvider;
  systemPrompt?: string;
}) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: options.messages,
      provider: options.provider,
      systemPrompt: options.systemPrompt,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    let detail = `Permintaan gagal (${response.status})`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) detail = payload.error;
    } catch {
      /* */
    }
    throw new Error(detail);
  }

  if (!response.body) throw new Error("Aliran kosong dari server.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const json = JSON.parse(data) as {
          choices?: { delta?: { content?: string | null } }[];
        };
        const token = json.choices?.[0]?.delta?.content;
        if (typeof token === "string" && token.length > 0) options.onDelta(token);
      } catch {
        /* */
      }
    }
  }
}

export async function fetchSystemStatus(): Promise<SystemStatus | null> {
  try {
    const r = await fetch("/api/status", { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as SystemStatus;
  } catch {
    return null;
  }
}
