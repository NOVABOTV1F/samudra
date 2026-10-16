# Changelog — Samudra AI

## v1.4 — Ocean Intelligence (2026-10-16)

### Baru
- Tema **ocean** (biru laut / cyan) + **mode terang & gelap**
- **Quick Actions**: Coding, Belajar, Menulis, Analisis
- **Cari riwayat** chat di sidebar
- **Ganti nama** percakapan
- **Coba ulang** jawaban terakhir (retry)
- Badge versi **v1.4** di UI
- Catatan penyimpanan: riwayat di **localStorage perangkat** (bukan cloud sync)

### Dipertahankan
- Chat V1 Gemini / V2 Groq (key di Cloudflare Runtime secrets)
- Otak lokal + brain pathways
- Coding Studio (artifact dock + preview sandbox)
- Playlist musik MP3
- Admin panel `/SAMUDRA.PANEL`
- Ekspor markdown percakapan

### Keamanan
- API key **tidak** di frontend / localStorage
- Preview kode tetap di iframe terisolasi (komponen lama)

### Belum / butuh integrasi
- Upload PDF/gambar ke model vision — **belum** (butuh endpoint + model vision)
- Sync cloud riwayat — **belum**
- OAuth Gmail penuh — hanya penanda lokal opsional
- Rate limit global terdistribusi — Worker stateless; batasi di provider/Cloudflare jika perlu

### Deploy
```bash
npm run build:cf
npx wrangler deploy
```
Secrets: `GEMINI_API_KEY`, `GROQ_API_KEY`
