import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import rawBrain from "@/lib/brain/raw.json";
import {
  fallbackAnswer,
  matchBrain,
  textToSseStream,
  type BrainRaw,
  type Pathway,
} from "@/lib/brain/engine";

const Body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(50_000),
      }),
    )
    .min(1)
    .max(24),
  provider: z
    .enum(["brain", "xai", "gemini", "groq", "deepseek", "claude", "v1", "v2", "v3"])
    .optional(),
  systemPrompt: z.string().max(8000).optional(),
});

const DEFAULT_SYSTEM = `You are ZUZUXF_AI / Otak Samudra v1.6.7.
Help with legal tasks. Match user language (default Indonesian). Prefer clear answers.
Prefer single-file HTML for web. Images: Google Images URL only.`;

const brain = rawBrain as BrainRaw;
const pathways: Pathway[] = Array.isArray(brain.pathways) ? brain.pathways : [];

const DEEPSEEK_BASE = (
  process.env.DEEPSEEK_BASE_URL ||
  process.env.FREEMODEL_BASE_URL ||
  "https://api.freemodel.dev/v1"
).replace(/\/$/, "");
const DEEPSEEK_MODELS = ["deepseek-v4.1-flash", "deepseek-v4-flash-0731", "deepseek-flash"];

/** V3 Claude — Anthropic native di FreeModel */
const CLAUDE_BASE = (process.env.CLAUDE_BASE_URL || "https://cc.freemodel.dev").replace(/\/$/, "");
const CLAUDE_MODELS = [
  "claude-mythos-preview",
  "claude-sonnet-4",
  "claude-sonnet-4-20250514",
  "claude-3-5-sonnet-latest",
];

const GROQ_MODELS = [
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "gemma2-9b-it",
];

function envKey(names: string[]): string {
  for (const n of names) {
    try {
      const v = (process.env as Record<string, string | undefined>)[n];
      if (v?.trim()) return v.trim();
    } catch {
      /* */
    }
  }
  return "";
}

function v1Key() {
  return envKey(["FREEMODEL_API_KEY", "DEEPSEEK_API_KEY", "FM_API_KEY"]);
}

function v3Key() {
  return envKey(["FREEMODELV3", "FREEMODELCLAUDE", "FREEMODEL_CLAUDE", "FE_OA_KEY"]);
}

/** OpenAI-compatible stream → passthrough SSE */
async function openaiStream(
  base: string,
  key: string,
  model: string,
  system: string,
  messages: { role: string; content: string }[],
  signal: AbortSignal,
  providerTag: string,
): Promise<Response | null> {
  const paths = base.endsWith("/v1")
    ? [`${base}/chat/completions`]
    : [`${base}/v1/chat/completions`, `${base}/chat/completions`];

  for (const url of paths) {
    try {
      const upstream = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          stream: true,
          temperature: 0.7,
          messages: [{ role: "system", content: system }, ...messages],
        }),
        signal,
      });
      if (upstream.ok && upstream.body) {
        return new Response(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "X-Samudra-Provider": providerTag,
            "X-Samudra-Model": model,
            "X-Samudra-Version": "1.6.7",
          },
        });
      }
      if (upstream.status === 401 || upstream.status === 403) {
        return Response.json(
          { error: `Key ditolak (${providerTag}). Cek secret Cloudflare.` },
          { status: 502 },
        );
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Anthropic Messages API (FreeModel cc.freemodel.dev) → convert stream ke format OpenAI SSE */
async function anthropicStream(
  base: string,
  key: string,
  model: string,
  system: string,
  messages: { role: string; content: string }[],
  signal: AbortSignal,
): Promise<Response | null> {
  const url = `${base.replace(/\/$/, "")}/v1/messages`;
  const anthropicMessages = messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  // Anthropic requires alternating roles; merge consecutive same roles lightly
  const cleaned: { role: string; content: string }[] = [];
  for (const m of anthropicMessages) {
    const last = cleaned[cleaned.length - 1];
    if (last && last.role === m.role) {
      last.content += "\n\n" + m.content;
    } else {
      cleaned.push({ ...m });
    }
  }
  if (cleaned[0]?.role === "assistant") {
    cleaned.unshift({ role: "user", content: "." });
  }

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        stream: true,
        system,
        messages: cleaned,
      }),
      signal,
    });

    if (upstream.status === 401 || upstream.status === 403) {
      return Response.json(
        {
          error:
            "Key ditolak (V3 Claude). Pastikan FREEMODELV3 = key fe_oa_… dari freemodel.dev (bukan key lain).",
        },
        { status: 502 },
      );
    }

    if (!upstream.ok || !upstream.body) {
      const t = await upstream.text().catch(() => "");
      console.warn("[claude anthropic]", upstream.status, t.slice(0, 200));
      return null;
    }

    // Convert Anthropic SSE → OpenAI-style delta content for our client
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let buf = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const data = trimmed.slice(5).trim();
              if (!data || data === "[DONE]") continue;
              try {
                const ev = JSON.parse(data) as {
                  type?: string;
                  delta?: { type?: string; text?: string };
                  content_block?: { text?: string };
                };
                let text = "";
                if (ev.type === "content_block_delta" && ev.delta?.text) {
                  text = ev.delta.text;
                } else if (ev.delta?.type === "text_delta" && ev.delta.text) {
                  text = ev.delta.text;
                }
                if (text) {
                  const chunk = {
                    choices: [{ delta: { content: text }, index: 0 }],
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                }
              } catch {
                /* skip */
              }
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (e) {
          controller.error(e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Samudra-Provider": "claude",
        "X-Samudra-Model": model,
        "X-Samudra-Version": "1.6.7",
      },
    });
  } catch (e) {
    console.warn("[claude]", e);
    return null;
  }
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return Response.json({ error: "Isi tidak valid." }, { status: 400 });
        }
        const parsed = Body.safeParse(json);
        if (!parsed.success) {
          return Response.json({ error: "Percakapan terlalu panjang." }, { status: 400 });
        }
        const system = parsed.data.systemPrompt?.trim() || DEFAULT_SYSTEM;
        const messages = parsed.data.messages
          .filter((m) => m.content.trim().length > 0)
          .slice(-16)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 12000) }));
        if (!messages.length) {
          return Response.json({ error: "Tulis pesan dulu." }, { status: 400 });
        }

        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        const query = lastUser?.content ?? "";
        let want = parsed.data.provider;
        if (want === "v1") want = "deepseek";
        if (want === "v2") want = "groq";
        if (want === "v3") want = "claude";

        const k1 = v1Key();
        const k3 = v3Key();
        const groqKey = envKey(["GROQ_API_KEY"]);

        if (want === "deepseek" || want === "xai") {
          if (!k1) {
            return Response.json(
              { error: "V1: set FREEMODEL_API_KEY di Cloudflare." },
              { status: 503 },
            );
          }
          const preferred = (process.env.DEEPSEEK_MODEL || "").trim();
          const list = preferred
            ? [preferred, ...DEEPSEEK_MODELS.filter((m) => m !== preferred)]
            : DEEPSEEK_MODELS;
          for (const model of list) {
            const res = await openaiStream(
              DEEPSEEK_BASE,
              k1,
              model,
              system,
              messages,
              request.signal,
              "deepseek",
            );
            if (res) return res;
          }
          return Response.json({ error: "DeepSeek gagal." }, { status: 502 });
        }

        if (want === "claude") {
          if (!k3) {
            return Response.json(
              {
                error:
                  "V3: Add secret FREEMODELV3 = key fe_oa_… dari freemodel.dev (API Keys).",
              },
              { status: 503 },
            );
          }
          const preferred = (process.env.CLAUDE_MODEL || "").trim();
          const list = preferred
            ? [preferred, ...CLAUDE_MODELS.filter((m) => m !== preferred)]
            : CLAUDE_MODELS;

          // 1) Anthropic native (benar untuk cc.freemodel.dev)
          for (const model of list) {
            const res = await anthropicStream(
              CLAUDE_BASE,
              k3,
              model,
              system,
              messages,
              request.signal,
            );
            if (res) return res;
          }

          // 2) Fallback OpenAI format di api.freemodel.dev
          for (const model of list) {
            const res = await openaiStream(
              "https://api.freemodel.dev/v1",
              k3,
              model,
              system,
              messages,
              request.signal,
              "claude",
            );
            if (res) return res;
          }

          return Response.json(
            {
              error:
                "Claude V3 gagal. Cek FREEMODELV3 (fe_oa_…) + model di freemodel.dev. Endpoint: cc.freemodel.dev",
            },
            { status: 502 },
          );
        }

        if (want === "groq") {
          if (!groqKey) {
            return Response.json({ error: "V2: set GROQ_API_KEY." }, { status: 503 });
          }
          let last = "";
          for (const model of GROQ_MODELS) {
            try {
              const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${groqKey}`,
                },
                body: JSON.stringify({
                  model,
                  stream: true,
                  messages: [{ role: "system", content: system }, ...messages],
                }),
                signal: request.signal,
              });
              if (upstream.ok && upstream.body) {
                return new Response(upstream.body, {
                  status: 200,
                  headers: {
                    "Content-Type": "text/event-stream; charset=utf-8",
                    "X-Samudra-Provider": "groq",
                    "X-Samudra-Version": "1.6.7",
                  },
                });
              }
              last = `${upstream.status}`;
            } catch (e) {
              last = e instanceof Error ? e.message : "err";
            }
          }
          return Response.json({ error: `Groq gagal (${last}).` }, { status: 502 });
        }

        if (k1) {
          const res = await openaiStream(
            DEEPSEEK_BASE,
            k1,
            DEEPSEEK_MODELS[0],
            system,
            messages,
            request.signal,
            "deepseek",
          );
          if (res) return res;
        }

        const hit = matchBrain(query, pathways, 4);
        if (hit) {
          return new Response(textToSseStream(hit.answer), {
            status: 200,
            headers: { "Content-Type": "text/event-stream; charset=utf-8", "X-Samudra-Brain": "1" },
          });
        }
        return new Response(textToSseStream(fallbackAnswer(query)), {
          status: 200,
          headers: { "Content-Type": "text/event-stream; charset=utf-8", "X-Samudra-Brain": "1" },
        });
      },
    },
  },
});
