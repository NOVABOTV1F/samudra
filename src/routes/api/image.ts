import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  prompt: z.string().trim().min(1).max(2000),
  version: z.enum(["1", "2"]).optional().default("1"),
});

export const Route = createFileRoute("/api/image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.XAI_API_KEY;
        if (!apiKey) {
          return Response.json(
            { ok: false, error: "AI belum tersedia di lingkungan ini." },
            { status: 503 },
          );
        }

        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Isi permintaan tidak valid." }, { status: 400 });
        }

        const parsed = Body.safeParse(json);
        if (!parsed.success) {
          return Response.json({ ok: false, error: "Deskripsi gambar terlalu panjang atau kosong." }, { status: 400 });
        }

        // Version 1 = standard, Version 2 = higher detail prompt tweak
        const prompt =
          parsed.data.version === "2"
            ? `${parsed.data.prompt}. Highly detailed, sharp, premium quality, soft lighting.`
            : parsed.data.prompt;

        const upstream = await fetch("https://api.x.ai/v1/images/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "grok-imagine-image",
            prompt,
            n: 1,
            resolution: parsed.data.version === "2" ? "2k" : "1k",
            response_format: "b64_json",
          }),
          signal: request.signal,
        });

        if (!upstream.ok) {
          let message = `Gambar gagal dibuat (${upstream.status}).`;
          try {
            const payload = (await upstream.json()) as { code?: string; error?: string };
            const blob = `${payload.code ?? ""} ${payload.error ?? ""}`.toLowerCase();
            if (blob.includes("spending") || blob.includes("credit")) {
              message = "Kuota AI sedang habis. Coba lagi nanti.";
            }
          } catch {
            /* keep default */
          }
          return Response.json(
            { ok: false, error: message },
            { status: upstream.status === 429 ? 429 : 502 },
          );
        }

        const payload = (await upstream.json()) as {
          data?: { b64_json?: string; url?: string }[];
        };
        const b64 = payload.data?.[0]?.b64_json;
        const url = payload.data?.[0]?.url;
        const image = b64 ? `data:image/png;base64,${b64}` : url;
        if (!image) {
          return Response.json({ ok: false, error: "Model tidak mengembalikan gambar." }, { status: 502 });
        }

        return Response.json({ ok: true, image });
      },
    },
  },
});
