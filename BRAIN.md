# Otak Samudra (ZUZUXF_AI)

Brankas pengetahuan di GitHub — **tanpa wajib API key**.

## Alur

```
pathways/*.json  →  npm run brain  →  raw.json  →  /api/chat (engine)
```

1. **Jalur** (`src/lib/brain/pathways/`) — satu file JSON per kemampuan
2. **Compile** — `npm run brain` menggabungkan ke `src/lib/brain/raw.json`
3. **Engine** — `src/lib/brain/engine.ts` mencocokkan pesan user ke keywords/patterns
4. **Chat** — kalau cocok → jawab lokal; kalau ada GEMINI/GROQ/XAI key → boleh cloud; else fallback otak

## Format jalur

```json
{
  "id": "unik",
  "title": "Judul",
  "keywords": ["kata", "kunci"],
  "patterns": ["regex opsional"],
  "priority": 0,
  "answer": "Markdown / kode. {{query}} = pesan user."
}
```

## Perintah uji (setelah deploy)

- halo
- bantuan
- format rupiah
- jelaskan ai
- buat html
- game

## Catatan jujur

Otak lokal **bukan** LLM penuh. Ia hebat di FAQ + template yang sudah ditulis di jalur. Makin banyak jalur yang kamu tambah, makin "bisa apa saja".
