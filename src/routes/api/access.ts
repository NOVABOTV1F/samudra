import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Sewa akses Samudra — key format TODA_…
 * Telegram bot (Approve) memanggil POST /api/access/register dengan ACCESS_ADMIN_TOKEN.
 * Login user: POST /api/access/login { apiKey } atau { username, password }.
 *
 * Secrets Cloudflare:
 * - ACCESS_ADMIN_TOKEN  (token rahasia bot/owner)
 * - ACCESS_HMAC_SECRET  (min 16 karakter, untuk tanda tangan key)
 * - ACCESS_SITE_URL     (opsional, link yang dikirim ke buyer)
 */

type AccessRecord = {
  username: string;
  password: string;
  apiKey: string;
  until: number;
  days: number;
  orderId?: string;
};

function env(name: string): string {
  try {
    return ((process.env as Record<string, string | undefined>)[name] || "").trim();
  } catch {
    return "";
  }
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlJson(obj: unknown): string {
  const s = JSON.stringify(obj);
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64urlJson<T>(s: string): T | null {
  try {
    const pad = "=".repeat((4 - (s.length % 4)) % 4);
    const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64url(sig).slice(0, 22);
}

async function issueRecord(
  username: string,
  password: string,
  days: number,
  orderId?: string,
): Promise<AccessRecord> {
  const secret = env("ACCESS_HMAC_SECRET") || env("ACCESS_ADMIN_TOKEN");
  if (!secret || secret.length < 8) {
    throw new Error("Set ACCESS_HMAC_SECRET (atau ACCESS_ADMIN_TOKEN) di Cloudflare.");
  }
  const until = Date.now() + Math.max(1, days) * 24 * 60 * 60 * 1000;
  const payload = b64urlJson({
    u: username,
    p: password,
    e: until,
    d: days,
    o: orderId || "",
  });
  const sig = await hmacHex(secret, payload);
  const apiKey = `TODA_${payload}.${sig}`;
  return { username, password, apiKey, until, days, orderId };
}

async function verifyApiKey(apiKey: string): Promise<AccessRecord | null> {
  const raw = apiKey.trim();
  if (!raw.startsWith("TODA_")) return null;
  const body = raw.slice(5);
  const dot = body.lastIndexOf(".");
  if (dot < 8) return null;
  const payload = body.slice(0, dot);
  const sig = body.slice(dot + 1);
  const secret = env("ACCESS_HMAC_SECRET") || env("ACCESS_ADMIN_TOKEN");
  if (!secret) return null;
  const expect = await hmacHex(secret, payload);
  if (expect !== sig) return null;
  const data = fromB64urlJson<{ u: string; p: string; e: number; d?: number; o?: string }>(payload);
  if (!data?.u || !data?.e) return null;
  if (data.e < Date.now()) return null;
  return {
    username: data.u,
    password: data.p,
    apiKey: raw,
    until: data.e,
    days: data.d || 1,
    orderId: data.o,
  };
}

function randPart(n: number) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const arr = new Uint8Array(n);
  crypto.getRandomValues(arr);
  for (let i = 0; i < n; i++) out += chars[arr[i]! % chars.length];
  return out;
}

const RegisterBody = z.object({
  days: z.number().min(1).max(365).default(3),
  orderId: z.string().max(64).optional(),
  username: z.string().min(3).max(40).optional(),
  password: z.string().min(4).max(40).optional(),
});

const LoginBody = z.object({
  apiKey: z.string().max(2000).optional(),
  username: z.string().max(40).optional(),
  password: z.string().max(40).optional(),
});

export const Route = createFileRoute("/api/access")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json({
          ok: true,
          version: "1.8.0",
          loginRequired: true,
          site: env("ACCESS_SITE_URL") || "https://samudra.aminaputra6.workers.dev",
          hint: "POST /api/access/login atau register (admin)",
        });
      },

      POST: async ({ request }) => {
        const url = new URL(request.url);
        const action = url.searchParams.get("action") || "login";

        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return Response.json({ error: "Body JSON tidak valid." }, { status: 400 });
        }

        // —— REGISTER (bot Telegram / owner) ——
        if (action === "register") {
          const admin =
            request.headers.get("x-admin-token") ||
            request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
            "";
          const need = env("ACCESS_ADMIN_TOKEN");
          if (!need || admin !== need) {
            return Response.json({ error: "Admin token salah." }, { status: 401 });
          }

          const parsed = RegisterBody.safeParse(json);
          if (!parsed.success) {
            return Response.json({ error: "Data register tidak valid." }, { status: 400 });
          }

          const days = parsed.data.days;
          const username = parsed.data.username || `user_${randPart(5)}`;
          const password = parsed.data.password || `pass_${randPart(5)}`;

          try {
            const rec = await issueRecord(username, password, days, parsed.data.orderId);
            const site = env("ACCESS_SITE_URL") || "https://samudra.aminaputra6.workers.dev";
            return Response.json({
              ok: true,
              link: site,
              username: rec.username,
              password: rec.password,
              apiKey: rec.apiKey,
              until: rec.until,
              untilLabel: new Date(rec.until).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
              days: rec.days,
              orderId: rec.orderId || null,
            });
          } catch (e) {
            return Response.json(
              { error: e instanceof Error ? e.message : "Gagal buat key" },
              { status: 500 },
            );
          }
        }

        // —— LOGIN (user di web) ——
        const parsed = LoginBody.safeParse(json);
        if (!parsed.success) {
          return Response.json({ error: "Data login tidak valid." }, { status: 400 });
        }

        const { apiKey, username, password } = parsed.data;

        if (apiKey?.trim()) {
          const rec = await verifyApiKey(apiKey.trim());
          if (!rec) {
            return Response.json(
              {
                error:
                  "Key tidak valid atau sudah expired. Beli key di bot Telegram, lalu login lagi.",
              },
              { status: 401 },
            );
          }
          return Response.json({
            ok: true,
            username: rec.username,
            until: rec.until,
            untilLabel: new Date(rec.until).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
            tier: "paid",
          });
        }

        if (username?.trim() && password?.trim()) {
          // Username/password saja tidak bisa diverifikasi tanpa KV
          // kecuali user juga punya apiKey. Minta pakai API key.
          return Response.json(
            {
              error:
                "Login pakai API Key (TODA_…) dari bot. Username/password hanya info; kunci utamanya API Key.",
            },
            { status: 400 },
          );
        }

        return Response.json(
          { error: "Isi API Key dari bot Telegram (format TODA_…)." },
          { status: 400 },
        );
      },
    },
  },
});
