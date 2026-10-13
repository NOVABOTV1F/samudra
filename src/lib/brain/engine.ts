/** Otak Samudra — pencocokan jalur tanpa API key eksternal */

export type Pathway = {
  id: string;
  title?: string;
  tags?: string[];
  keywords?: string[];
  patterns?: string[];
  answer: string;
  priority?: number;
};

export type BrainRaw = {
  name: string;
  note?: string;
  pathways: Pathway[];
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s\u00c0-\u024f]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): string[] {
  return normalize(text).split(" ").filter((t) => t.length > 1);
}

function scorePathway(query: string, pathway: Pathway): number {
  const q = normalize(query);
  const qTokens = new Set(tokens(query));
  let score = pathway.priority ?? 0;

  for (const kw of pathway.keywords ?? []) {
    const k = normalize(kw);
    if (!k) continue;
    if (q === k) score += 12;
    else if (q.includes(k)) score += 6;
    else if (k.length > 3 && qTokens.has(k)) score += 4;
  }

  for (const pat of pathway.patterns ?? []) {
    try {
      if (new RegExp(pat, "i").test(query)) score += 10;
    } catch {
      /* ignore bad regex */
    }
  }

  const title = normalize(pathway.title ?? "");
  if (title && q.includes(title)) score += 3;

  return score;
}

export function fillAnswer(answer: string, query: string): string {
  return answer
    .replaceAll("{{query}}", query.trim())
    .replaceAll("{{QUERY}}", query.trim().toUpperCase());
}

export function matchBrain(
  query: string,
  pathways: Pathway[],
  minScore = 4,
): { pathway: Pathway; score: number; answer: string } | null {
  if (!query.trim() || pathways.length === 0) return null;

  let best: Pathway | null = null;
  let bestScore = 0;

  for (const p of pathways) {
    if (!p.answer) continue;
    const s = scorePathway(query, p);
    if (s > bestScore) {
      bestScore = s;
      best = p;
    }
  }

  if (!best || bestScore < minScore) return null;
  return {
    pathway: best,
    score: bestScore,
    answer: fillAnswer(best.answer, query),
  };
}

export function fallbackAnswer(query: string): string {
  const q = query.trim();
  return [
    "Aku **Otak Samudra** — mode lokal tanpa API key eksternal.",
    "",
    `Kamu bilang: *"${q.slice(0, 280)}${q.length > 280 ? "…" : ""}"*`,
    "",
    "Aku belum punya jalur khusus untuk ini di brankas. Coba:",
    "- **halo** / **bantuan** — kenalan & daftar kemampuan",
    "- **buat html** / **landing page** — template halaman",
    "- **format rupiah** / **kode js** — cuplikan kode",
    "- **jelaskan ai** / **pasang surut** — penjelasan singkat",
    "- **game** — mini game HTML",
    "",
    "Tambah jalur baru di `src/lib/brain/pathways/`, lalu `npm run brain`.",
  ].join("\n");
}

/** SSE OpenAI-style dari teks penuh (otak lokal) */
export function textToSseStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      const chunkSize = 48;
      for (let i = 0; i < text.length; i += chunkSize) {
        const slice = text.slice(i, i + chunkSize);
        const payload = JSON.stringify({
          choices: [{ delta: { content: slice } }],
        });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}
