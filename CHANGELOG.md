# Changelog — Samudra AI

## v1.5 — Deploy Premium (2026-10-17)

### Baru
- Tab **Deploy** emas di Pengaturan (Premium)
- Gate key format: `ZUZUKX😶_103942974V1.5-(random)` — input **password** (tertutup)
- **Confirm** → video full layar **16 detik** → form deploy
- Video bulat loop di atas form
- Pilihan **V1 / V2 / V3** (tanpa label kegunaan di UI)
  - V1 = GitHub Pages
  - V2 = Vercel
  - V3 = Cloudflare
- Name website + 3 sumber file (GitHub paste / storage / paste index.html)
- Tombol **Deploy** → video full **10 detik** → hasil tersimpan
- **Chat owner** → WhatsApp 085194654911
- API `/api/deploy` pakai token server (Cloudflare secrets)

### Secrets Cloudflare (Runtime)
- `GEMINI_API_KEY`, `GROQ_API_KEY`
- `GITHUB_TOKEN`, `GITHUB_OWNER` (V1)
- `VERCEL_TOKEN` (V2, opsional)
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (V3, opsional)
- `DEPLOY_PREMIUM_KEYS` (daftar key, opsional)

### Dipertahankan
- Chat V1/V2, otak lokal, coding studio, musik, tema, riwayat

## v1.4 — Ocean Intelligence
- Tema terang/gelap, Quick Actions, cari/rename riwayat, retry
