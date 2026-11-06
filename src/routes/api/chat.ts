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

const DEFAULT_SYSTEM = `You are ZUZUXF_AI / Otak Samudra v1.7.1.
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

/** V3 — Codex Relay */
const V3_BASE = (
  process.env.CLAUDE_BASE_URL ||
  process.env.CODEX_RELAY_BASE_URL ||
  "https://codex-relay.codes/v1"
).replace(/\/$/, "");

const V3_MODELS = [
  "claude-opus-5",
  "claude-opus-4-5",
  "claude-opus-4",
  "claude-sonnet-4-5",
  "claude-sonnet-4",
  "claude-3-5-sonnet-latest",
  "gpt-4o",
  "gpt-4.1",
  "auto",
];

const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "llama-3.1-70b-versatile",
  "gemma2-9b-it",
  "mixtral-8x7b-32768",
];

function envKey(names: string[]): string {
  for (const n of names) {
    try {
      let v = (process.env as Record<string, string | undefined>)[n];
      if (!v) continue;
      v = v.trim().replace(/^["']|["']$/g, "");
      if (v) return v;
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
  return envKey([
    "FREEMODELV3",
    "CODEX_RELAY_KEY",
    "CODEX_RELAY_API_KEY",
    "FREEMODELCLAUDE",
  ]);
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
              "X-Samudra-Version": "1.7.1",
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

  return { ok: false, status: lastStatus, body: lastBody.slice(0, 400) };
}

function isInvalidKey(status: number, body: string): boolean {
  const b = body.toLowerCase();
  return (
    status === 401 ||
    status === 403 ||
    b.includes("invalid_api_key") ||
    b.includes("invalid api key") ||
    b.includes("authentication_error") ||
    (b.includes("does not exist") && b.includes("api key"))
  );
}

function isQuota(body: string): boolean {
  const b = body.toLowerCase();
  // Codex-relay often says "used up its limit" on INVALID key too — jangan anggap kuota
  // kecuali jelas insufficient balance / quota tanpa invalid key.
  if (b.includes("invalid_api_key") || b.includes("invalid api key")) return false;
  return (
    b.includes("insufficient balance") ||
    b.includes("insufficient_quota") ||
    b.includes("insufficient_balance") ||
    (b.includes("quota") && !b.includes("invalid")) ||
    (b.includes("balance") && b.includes("insufficient"))
  );
}

function explainUpstream(tag: string, status: number, body: string): string {
  if (isInvalidKey(status, body)) {
    return `${tag}: API key ditolak provider. Pastikan FREEMODELV3 = key sk-… dari codex-relay (Create key), lengkap, tanpa spasi/tanda kutip, lalu Deploy ulang.`;
  }
  if (isQuota(body)) {
    return `${tag}: kuota/saldo provider habis. Cek balance di dashboard.`;
  }
  if (status === 404 || /model_not_found|does not exist|not found/i.test(body)) {
    return `${tag}: model tidak tersedia. Cek nama model di dashboard Relay.`;
  }
  if (status === 429 || /rate.?limit/i.test(body)) {
    return `${tag}: rate limit. Tunggu sebentar.`;
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
              if (!res.ok && isInvalidKey(res.status, res.body)) {
                return Response.json(
                  { error: explainUpstream("V1", res.status, res.body) },
                  { status: 502 },
                );
              }
              if (!res.ok && isQuota(res.body)) {
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
                  "V3: set secret FREEMODELV3 = key sk-… dari codex-relay.codes (Create key) → Deploy.",
              },
              { status: 503 },
            );
          }

          if (k3.startsWith("fe_oa_") || k3.startsWith("fm_")) {
            return Response.json(
              {
                error:
                  "V3 sekarang pakai Codex Relay. Ganti FREEMODELV3 ke key sk-… (bukan fe_oa_/fm_).",
              },
              { status: 502 },
            );
          }

          if (!k3.startsWith("sk-") && !k3.startsWith("sk_")) {
            return Response.json(
              {
                error:
                  "FREEMODELV3 harus key sk-… dari codex-relay.codes. Edit secret, tempel key lengkap, Deploy.",
              },
              { status: 502 },
            );
          }

          const preferred = (
            process.env.CLAUDE_MODEL ||
            process.env.V3_MODEL ||
            "claude-opus-5"
          ).trim();
          const list = preferred
            ? [preferred, ...V3_MODELS.filter((m) => m !== preferred)]
            : V3_MODELS;

          let last: StreamResult | null = null;

          for (const base of [V3_BASE, "https://codex-relay.codes/v1"]) {
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
              // Key salah → stop, jangan loop semua model
              if (!res.ok && isInvalidKey(res.status, res.body)) {
                return Response.json(
                  { error: explainUpstream("V3", res.status, res.body) },
                  { status: 502 },
                );
              }
              if (!res.ok && isQuota(res.body)) {
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
                    "X-Samudra-Version": "1.7.1",
                  },
                });
              }
              const t = await upstream.text().catch(() => "");
              last = `${upstream.status} ${t.slice(0, 120)}`;
              if (upstream.status === 401 || upstream.status === 403) {
                return Response.json(
                  { error: "V2: GROQ_API_KEY ditolak. Cek key di console.groq.com." },
                  { status: 502 },
                );
              }
            } catch (e) {
              last = e instanceof Error ? e.message : "err";
            }
          }
          return Response.json({ error: `Groq gagal. ${last}` }, { status: 502 });
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
