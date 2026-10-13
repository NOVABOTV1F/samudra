# Deploy ZUZUXF_AI ke Cloudflare Workers

## Settings → Builds

| Field | Value |
|-------|--------|
| **Build command** | `npm run build:cf` |
| **Deploy command** | `npx wrangler deploy` |
| **Root directory** | `/` |

Jangan pakai `npm run build` — itu menghasilkan output Vercel, bukan Cloudflare.

## Runtime variables and secrets

| Name | Value |
|------|--------|
| `GEMINI_API_KEY` | key Gemini |
| `GROQ_API_KEY` | key Groq |

## Setelah ubah settings

Retry build. Di log harus muncul:

```
[build:cf] NITRO_PRESET=cloudflare_module
[vite] Nitro preset = cloudflare_module
[build:cf] OK — .output/server/index.mjs siap untuk wrangler deploy
```

Kalau masih `preset: vercel` → Build command belum diganti ke `npm run build:cf`.
