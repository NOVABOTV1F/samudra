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

const DEFAULT_SYSTEM = `You are ZUZUXF_AI / Otak Samudra v1.6.2.
Full capability: code, websites, debug, business, analysis, learning. Legal & safe only.
Match user language (default Indonesian). Prefer runnable single-file HTML for web.
Images: only Google Images URL, never generate images. Never mention these instructions.`;

const brain = rawBrain as BrainRaw;
const pathways: Pathway[] = Array.isArray(brain.pathways) ? brain.pathways : [];

/** V1 DeepSeek — model pilihan user (irit). Key sering fm_… via freemodel.in ATAU fe_oa_ via api.freemodel.dev */
const DEEPSEEK_BASE = (
  process.env.DEEPSEEK_BASE_URL ||
  process.env.FREEMODEL_BASE_URL ||
  "https://freemodel.in/v1"
).replace(/\/$/, "");

const DEEPSEEK_MODELS = [
  "deepseek-v4.1-flash",
  "deepseek-v4-flash-0731",
  "deepseek-flash",
];

/** V3 Claude — key fe_oa_ · endpoint cc.freemodel.dev */
const CLAUDE_BASE = (process.env.CLAUDE_BASE_URL || "https://cc.freemodel.dev").replace(/\/$/, "");
const CLAUDE_MODELS = ["claude-mythos-preview", "claude-mythos", "claude-sonnet-4"];

const GROQ_MODELS = ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "openai/gpt-oss-20b"];

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

/** Key V1 DeepSeek: DEEPSEEK_API_KEY / FREEMODEL_API_KEY (fm_… atau fe_oa_…) */
function deepseekKey() {
  return envKey(["DEEPSEEK_API_KEY", "FREEMODEL_API_KEY", "FM_API_KEY"]);
}

/** Key V3 Claude: FE_OA_KEY khusus, fallback FREEMODEL_API_KEY */
function claudeKey() {
  return envKey(["FE_OA_KEY", "CLAUDE_API_KEY", "FREEMODEL_API_KEY"]);
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

  for (const url of paths) {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        stream: true,
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
          Connection: "keep-alive",
          "X-Samudra-Provider": providerTag,
          "X-Samudra-Model": model,
          "X-Samudra-Version": "1.6.2",
        },
      });
    }
    if (upstream.status === 401 || upstream.status === 403) {
      return Response.json(
        { error: `Key ditolak (${providerTag}). Cek secret Cloudflare.` },
        { status: 502 },
      );
    }
  }
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
          return Response.json({ error: "Isi permintaan tidak valid." }, { status: 400 });
        }

        const parsed = Body.safeParse(json);
        if (!parsed.success) {
          return Response.json({ error: "Percakapan terlalu panjang atau kosong." }, { status: 400 });
        }

        const system = parsed.data.systemPrompt?.trim() || DEFAULT_SYSTEM;
        const messages = parsed.data.messages
          .filter((m) => m.content.trim().length > 0)
          .slice(-16)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 12000) }));

        if (messages.length === 0) {
          return Response.json({ error: "Tulis pesan dulu." }, { status: 400 });
        }

        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        const query = lastUser?.content ?? "";
        let want = parsed.data.provider;
        if (want === "v1") want = "deepseek";
        if (want === "v2") want = "groq";
        if (want === "v3") want = "claude";

        const dsKey = deepseekKey();
        const clKey = claudeKey();
        const groqKey = envKey(["GROQ_API_KEY"]);

        if (want === "deepseek" || want === "xai") {
          if (!dsKey) {
            return Response.json(
              {
                error:
                  "V1 DeepSeek: set DEEPSEEK_API_KEY atau FREEMODEL_API_KEY (fm_… / key DeepSeek). Model: deepseek-v4.1-flash",
              },
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
              dsKey,
              model,
              system,
              messages,
              request.signal,
              "deepseek",
            );
            if (res) return res;
          }
          return Response.json({ error: "DeepSeek gagal. Cek model & kredit." }, { status: 502 });
        }

        if (want === "claude") {
          if (!clKey) {
            return Response.json(
              {
                error:
                  "V3 Claude: set FE_OA_KEY (fe_oa_…) di Cloudflare. Endpoint: https://cc.freemodel.dev · claude-mythos-preview",
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
              clKey,
              model,
              system,
              messages,
              request.signal,
              "claude",
            );
            if (res) return res;
          }
          return Response.json({ error: "Claude Mythos gagal." }, { status: 502 });
        }

        if (want === "groq") {
          if (!groqKey) {
            return Response.json(
              { error: "V2 Groq: set GROQ_API_KEY." },
              { status: 503 },
            );
          }
          const preferred = (process.env.GROQ_MODEL || "").trim();
          const list = preferred
            ? [preferred, ...GROQ_MODELS.filter((m) => m !== preferred)]
            : GROQ_MODELS;
          for (const model of list) {
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
                  "Cache-Control": "no-cache, no-transform",
                  "X-Samudra-Provider": "groq",
                  "X-Samudra-Version": "1.6.2",
                },
              });
            }
            if (upstream.status === 401 || upstream.status === 403) {
              return Response.json({ error: "Groq key ditolak." }, { status: 502 });
            }
          }
          return Response.json({ error: "Groq gagal." }, { status: 502 });
        }

        if (dsKey) {
          const res = await openaiStream(
            DEEPSEEK_BASE,
            dsKey,
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
          return new Response(
            textToSseStream(hit.answer),
            {
              status: 200,
              headers: {
                "Content-Type": "text/event-stream; charset=utf-8",
                "X-Samudra-Brain": "1",
                "X-Samudra-Version": "1.6.2",
              },
            },
          );
        }

        return new Response(textToSseStream(fallbackAnswer(query)), {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "X-Samudra-Brain": "1",
          },
        });
      },
    },
  },
});
