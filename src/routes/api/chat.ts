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

const DEFAULT_SYSTEM = `You are ZUZUXF_AI / Otak Samudra v1.6.9.
Help with legal tasks. Match user language (default Indonesian). Prefer clear answers.
Prefer single-file HTML for web. Images: Google Images URL only.`;

const brain = rawBrain as BrainRaw;
const pathways: Pathway[] = Array.isArray(brain.pathways) ? brain.pathways : [];

const V1_BASE = (
  process.env.DEEPSEEK_BASE_URL ||
  process.env.FREEMODEL_BASE_URL ||
  "https://api.freemodel.dev/v1"
).replace(/\/$/, "");

const V1_MODELS = [
  "deepseek-v4.1-flash",
  "deepseek-v4-flash-0731",
  "deepseek-flash",
  "auto",
];

/** V3 — FreeModel OpenAI path. Claude + model yang sering tersedia di akun */
const V3_BASE = (process.env.CLAUDE_BASE_URL || "https://api.freemodel.dev/v1").replace(
  /\/$/,
  "",
);
const V3_MODELS = [
  "claude-mythos-preview",
  "claude-sonnet-4",
  "claude-sonnet-4-20250514",
  "claude-3-5-sonnet-latest",
  "claude-opus-4",
  "gpt-6-luna",
  "gpt-6-sol",
  "gpt-6-astra",
  "auto",
];

const GROQ_MODELS = ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "gemma2-9b-it"];

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

type StreamResult =
  | { ok: true; response: Response }
  | { ok: false; status: number; body: string };

async function openaiChatStream(
  base: string,
  key: string,
  model: string,
  system: string,
  messages: { role: string; content: string }[],
  signal: AbortSignal,
  providerTag: string,
): Promise<StreamResult> {
  const root = base.replace(/\/$/, "");
  const urls = root.endsWith("/v1")
    ? [`${root}/chat/completions`]
    : [`${root}/v1/chat/completions`, `${root}/chat/completions`];

  let lastStatus = 0;
  let lastBody = "";

  for (const url of urls) {
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
        return {
          ok: true,
          response: new Response(upstream.body, {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache, no-transform",
              "X-Samudra-Provider": providerTag,
              "X-Samudra-Model": model,
              "X-Samudra-Version": "1.6.9",
            },
          }),
        };
      }

      lastStatus = upstream.status;
      lastBody = await upstream.text().catch(() => "");
    } catch (e) {
      lastStatus = 0;
      lastBody = e instanceof Error ? e.message : "network";
    }
  }

  return { ok: false, status: lastStatus, body: lastBody.slice(0, 320) };
}

function explainUpstream(tag: string, status: number, body: string): string {
  const b = body.toLowerCase();

  if (
    b.includes("insufficient balance") ||
    b.includes("insufficient_quota") ||
    b.includes("quota") ||
    b.includes("no credit") ||
    b.includes("balance")
  ) {
    return `${tag}: kredit FreeModel habis (Insufficient balance). Isi saldo di freemodel.dev → Billing/Usage, lalu coba lagi. Key-nya valid, yang kurang kredit.`;
  }

  if (status === 401 || status === 403 || b.includes("unauthorized") || b.includes("invalid token")) {
    return `${tag}: key ditolak (${status}). Cek FREEMODELV3 = fe_oa_… lengkap, tanpa spasi.`;
  }

  if (b.includes("restricted") || b.includes("claude code")) {
    return `${tag}: endpoint khusus Claude Code. Samudra memakai api.freemodel.dev.`;
  }

  if (status === 404 || b.includes("model_not_found") || b.includes("does not exist")) {
    return `${tag}: model tidak tersedia di akunmu. Cek model di freemodel.dev.`;
  }

  if (status === 429 || b.includes("rate")) {
    return `${tag}: terlalu banyak request. Tunggu sebentar.`;
  }

  return `${tag} gagal (${status}): ${body || "tanpa detail"}`;
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
              { error: "V1: set FREEMODEL_API_KEY di Cloudflare (Secret)." },
              { status: 503 },
            );
          }
          const preferred = (process.env.DEEPSEEK_MODEL || "").trim();
          const list = preferred
            ? [preferred, ...V1_MODELS.filter((m) => m !== preferred)]
            : V1_MODELS;
          let last: StreamResult | null = null;
          for (const base of [V1_BASE, "https://api.freemodel.dev/v1", "https://freemodel.in/v1"]) {
            for (const model of list) {
              const res = await openaiChatStream(
                base,
                k1,
                model,
                system,
                messages,
                request.signal,
                "deepseek",
              );
              if (res.ok) return res.response;
              last = res;
              // kredit habis → stop early
              if (!res.ok && /insufficient|balance|quota/i.test(res.body)) {
                return Response.json(
                  { error: explainUpstream("V1", res.status, res.body) },
                  { status: 402 },
                );
              }
            }
          }
          return Response.json(
            {
              error: explainUpstream(
                "V1",
                last && !last.ok ? last.status : 502,
                last && !last.ok ? last.body : "",
              ),
            },
            { status: 502 },
          );
        }

        if (want === "claude") {
          if (!k3) {
            return Response.json(
              {
                error:
                  "V3: secret FREEMODELV3 kosong. Add di Cloudflare → FREEMODELV3 = fe_oa_… → Deploy.",
              },
              { status: 503 },
            );
          }

          const preferred = (process.env.CLAUDE_MODEL || "").trim();
          const list = preferred
            ? [preferred, ...V3_MODELS.filter((m) => m !== preferred)]
            : V3_MODELS;

          let last: StreamResult | null = null;

          for (const base of [V3_BASE, "https://api.freemodel.dev/v1"]) {
            for (const model of list) {
              const res = await openaiChatStream(
                base,
                k3,
                model,
                system,
                messages,
                request.signal,
                "claude",
              );
              if (res.ok) return res.response;
              last = res;
              if (!res.ok && /insufficient|balance|quota/i.test(res.body)) {
                return Response.json(
                  { error: explainUpstream("V3", res.status, res.body) },
                  { status: 402 },
                );
              }
            }
          }

          // Coba key V1 jika beda (sering 1 key untuk semua)
          if (k1 && k1 !== k3) {
            for (const model of list) {
              const res = await openaiChatStream(
                "https://api.freemodel.dev/v1",
                k1,
                model,
                system,
                messages,
                request.signal,
                "claude",
              );
              if (res.ok) return res.response;
              last = res;
              if (!res.ok && /insufficient|balance|quota/i.test(res.body)) {
                return Response.json(
                  { error: explainUpstream("V3", res.status, res.body) },
                  { status: 402 },
                );
              }
            }
          }

          return Response.json(
            {
              error: explainUpstream(
                "V3",
                last && !last.ok ? last.status : 502,
                last && !last.ok ? last.body : "",
              ),
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
                    "X-Samudra-Version": "1.6.9",
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
          const res = await openaiChatStream(
            V1_BASE,
            k1,
            V1_MODELS[0],
            system,
            messages,
            request.signal,
            "deepseek",
          );
          if (res.ok) return res.response;
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
