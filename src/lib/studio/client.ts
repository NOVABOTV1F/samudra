export type ChatTurn = { role: "user" | "assistant"; content: string };

export async function streamChat(options: {
  messages: ChatTurn[];
  signal: AbortSignal;
  onDelta: (chunk: string) => void;
  provider?: "brain" | "gemini" | "groq" | "xai";
  geminiKey?: string;
  groqKey?: string;
  systemPrompt?: string;
}) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: options.messages,
      provider: options.provider,
      geminiKey: options.geminiKey,
      groqKey: options.groqKey,
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
      /* keep default */
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
        if (typeof token === "string" && token.length > 0) {
          options.onDelta(token);
        }
      } catch {
        /* ignore */
      }
    }
  }
}
