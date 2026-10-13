# Deploy Samudra ke Cloudflare

## A. Cloudflare Pages (disarankan jika menu = Pages)

| Field | Value |
|-------|--------|
| Build command | `npm run build:pages` |
| Build output directory | `dist` atau sesuai output Nitro Pages |
| Root | `/` |

Build variable:

| Name | Value |
|------|--------|
| `NITRO_PRESET` | `cloudflare_pages` |

## B. Cloudflare Workers

| Field | Value |
|-------|--------|
| Build command | `npm run build:cf` |
| Deploy command | `npx wrangler deploy` |

Build variable (opsional, script sudah force):

| Name | Value |
|------|--------|
| `NITRO_PRESET` | `cloudflare_module` |

## Runtime secrets (AI cloud opsional)

- `GEMINI_API_KEY`
- `GROQ_API_KEY`

Chat **otak lokal** tetap jalan di browser tanpa secrets.

## Yang terbatas di Cloudflare

- Ambil isi situs orang lain (CORS / keamanan)
- Database server penuh (app ini pakai storage browser + otak lokal)

## Cek log build

Harus muncul `Nitro preset = cloudflare_pages` atau `cloudflare_module`, **bukan** `vercel`.
