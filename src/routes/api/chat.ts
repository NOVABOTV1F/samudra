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

const DEFAULT_SYSTEM = `You are ZUZUXF_AI / Otak Samudra v1.6.6.
Help with legal tasks. Match user language (default Indonesian). Prefer short clear answers unless user asks for detail.
Prefer single-file HTML for web. Images: Google Images URL only.`;

const brain = rawBrain as BrainRaw;
const pathways: Pathway[] = Array.isArray(brain.pathways) ? brain.pathways : [];

const DEEPSEEK_BASE = (
  process.env.DEEPSEEK_BASE_URL ||
  process.env.FREEMODEL_BASE_URL ||
  "https://freemodel.in/v1"
).replace(/\/$/, "");
const DEEPSEEK_MODELS = ["deepseek-v4.1-flash", "deepseek-v4-flash-0731", "deepseek-flash"];

const CLAUDE_BASE = (process.env.CLAUDE_BASE_URL || "https://cc.freemodel.dev").replace(/\/$/, "");
const CLAUDE_MODELS = ["claude-mythos-preview", "claude-mythos", "claude-sonnet-4"];

const GROQ_MODELS = [
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
  "gemma2-9b-it",
  "openai/gpt-oss-20b",
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
  return envKey(["FREEMODELCLAUDE", "FREEMODEL_CLAUDE", "FE_OA_KEY"]);
}

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

  let lastErr = "";
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
            "X-Samudra-Version": "1.6.6",
          },
        });
      }

      const t = await upstream.text().catch(() => "");
      lastErr = `${upstream.status} ${t.slice(0, 180)}`;
      if (upstream.status === 401 || upstream.status === 403) {
        return Response.json(
          { error: `Key ditolak (${providerTag}). Cek secret Cloudflare.` },
          { status: 502 },
        );
      }
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "network";
    }
  }
  console.warn("[chat]", providerTag, model, lastErr);
  return null;
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
              { error: "V1: set FREEMODEL_API_KEY di Cloudflare (Edit, jangan Add dobel)." },
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
          return Response.json(
            { error: "DeepSeek gagal. Cek model/kredit FreeModel." },
            { status: 502 },
          );
        }

        if (want === "claude") {
          if (!k3) {
            return Response.json(
              {
                error:
                  "V3: Add secret FREEMODELCLAUDE (value key fe_oa_…). Nama harus beda dari FREEMODEL_API_KEY.",
              },
              { status: 503 },
            );
          }
          const preferred = (process.env.CLAUDE_MODEL || "").trim();
          const list = preferred
            ? [preferred, ...CLAUDE_MODELS.filter((m) => m !== preferred)]
            : CLAUDE_MODELS;
          for (const model of list) {
            const res = await openaiStream(
              CLAUDE_BASE,
              k3,
              model,
              system,
              messages,
              request.signal,
              "claude",
            );
            if (res) return res;
          }
          return Response.json({ error: "Claude V3 gagal. Cek FREEMODELCLAUDE." }, { status: 502 });
        }

        if (want === "groq") {
          if (!groqKey) {
            return Response.json({ error: "V2: set GROQ_API_KEY." }, { status: 503 });
          }
          const preferred = (process.env.GROQ_MODEL || "").trim();
          const list = preferred
            ? [preferred, ...GROQ_MODELS.filter((m) => m !== preferred)]
            : GROQ_MODELS;
          let last = "";
          for (const model of list) {
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
                    "X-Samudra-Version": "1.6.6",
                  },
                });
              }
              last = `${upstream.status} ${await upstream.text().then((t) => t.slice(0, 160))}`;
              if (upstream.status === 401 || upstream.status === 403) {
                return Response.json({ error: "Groq key ditolak / invalid." }, { status: 502 });
              }
            } catch (e) {
              last = e instanceof Error ? e.message : "err";
            }
          }
          return Response.json(
            { error: `Groq gagal. ${last || "Cek GROQ_API_KEY & model."}` },
            { status: 502 },
          );
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
