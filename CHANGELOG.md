# Changelog — Samudra AI

## v1.6 — Full Power (2026-11-02)

### AI
- **V1 = DeepSeek Pro** via FreeModel (`https://freemodel.in/v1`, key `fm_…`)
- **V2 = Groq** (cadangan cepat)
- System prompt v1.6: coding, website, debug, bisnis, analisis, belajar — serba bisa
- Default provider: DeepSeek

### Status real-time
- Endpoint **`GET /api/status`** — cek key terpasang (deepseek / groq / gemini), model, waktu
- Badge status di header + baris status di composer
- Sisa karakter input real-time

### UI / tools
- Quick Actions diperluas: Coding, Website, Debug, Belajar, Menulis, Bisnis, Analisis, Apa saja
- Label V1/V2 diperjelas (bukan Gemini)
- Composer ring + counter karakter

### Secrets Cloudflare
- **`FREEMODEL_API_KEY`** (wajib untuk V1) — token `fm_…`
- Opsional: `DEEPSEEK_MODEL`, `FREEMODEL_BASE_URL`, `GROQ_API_KEY`, `GEMINI_API_KEY`

### Catatan limit
- Status “key ON” = secret terpasang di server
- Sisa kuota token FreeModel / Groq lihat di dashboard penyedia (tidak diekspos ke user)

## v1.5 — Deploy Premium (2026-10-17)
- Tab Deploy emas, gate key ZUZUKX, V1 GitHub / V2 Vercel / V3 Cloudflare

## v1.4 — Ocean Intelligence
- Tema, Quick Actions, riwayat, retry
