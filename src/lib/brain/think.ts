import raw from "./raw.json" with { type: "json" };

export type BrainReply = {
  text: string;
  pathway: string;
  imageUrl?: string;
};

type Pathway = {
  id: string;
  lane: string;
  title: string;
  keywords: string[];
  answer: string;
};

const pathways = (raw as { pathways: Pathway[] }).pathways;

const FILE_AT = 8000;

export function think(text: string, mode: "chat" | "image" = "chat"): BrainReply {
  const clean = text.trim();
  if (!clean) return { text: "Tulis sesuatu dulu.", pathway: "inti.kosong" };
  if (mode === "image") return paint(clean);

  if (/\b(peta otak|jalur otak|daftar jalur)\b/i.test(clean)) {
    return { text: mapText(), pathway: "inti.peta" };
  }

  if (shouldAnalyze(clean)) {
    return { text: analyzeSource(clean), pathway: "jalur.komponen" };
  }

  if (asksToBuild(clean)) {
    const game = /\b(game|permainan|mutiara)\b/i.test(clean);
    return {
      text: game ? buildGame(clean) : buildPage(clean),
      pathway: game ? "jalur.game" : "jalur.halaman",
    };
  }

  if (/\bhttps?:\/\//i.test(clean) && /\b(ambil|baca|isi web|analisa|analisis)\b/i.test(clean)) {
    return { text: urlHint(), pathway: "jalur.sumber" };
  }

  const math = tryMath(clean);
  if (math) return { text: math, pathway: "jalur.hitung" };

  const hit = bestPathway(clean);
  if (hit) return { text: hit.answer, pathway: hit.id };

  return { text: fallback(clean), pathway: "inti.bebas" };
}

export function spillToFile(text: string) {
  if (text.length <= FILE_AT) return null;
  const preview = text.slice(0, 1800).trimEnd();
  return {
    preview: `${preview}\n\n---\n\nJawaban ini ${text.length.toLocaleString("id-ID")} karakter, lebih dari ${FILE_AT.toLocaleString("id-ID")}. Berkas utuhnya diunduh otomatis. Isi yang sama tetap ada di percakapan ini.`,
    filename: "otak-samudra.md",
    full: text,
  };
}

function shouldAnalyze(text: string) {
  if (!looksLikeSource(text)) return false;
  if (/\b(buat|bikin|buatkan)\b/i.test(text) && !/\b(analisa|analisis|jelaskan|komponen|isi)\b/i.test(text)) {
    return false;
  }
  return true;
}

function looksLikeSource(text: string) {
  if (/```(?:html|css|js|javascript|tsx|jsx)/i.test(text)) return true;
  const tags = text.match(/<\/?[a-z][^>]*>/gi);
  return (tags?.length ?? 0) >= 2;
}

function asksToBuild(text: string) {
  return /\b(buat|bikin|buatkan|rancang)\b/i.test(text) && /\b(halaman|web|html|game|permainan|kartu|widget|situs)\b/i.test(text);
}

function bestPathway(text: string) {
  const hay = text.toLowerCase();
  let best: Pathway | null = null;
  let score = 0;
  for (const pathway of pathways) {
    let next = 0;
    for (const word of pathway.keywords) {
      const needle = word.toLowerCase();
      const exact = new RegExp(`(?:^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`, "i").test(hay);
      if (exact) next += 2;
      else if (hay.includes(needle)) next += 1;
    }
    if (next > score) {
      score = next;
      best = pathway;
    }
  }
  return score >= 2 ? best : null;
}

function mapText() {
  const lines = pathways.map((pathway) => `- \`${pathway.id}\` — ${pathway.title}`);
  return [
    "Peta otak Samudra. Semua jalur ini ada di perangkatmu, tanpa API key lain.",
    "",
    ...lines,
    "",
    "Inti eksekusi menambah tiga kemampuan yang bukan teks jadi: bedah HTML/JS/CSS, susun halaman atau game, dan hitung ekspresi.",
  ].join("\n");
}

function urlHint() {
  return [
    "Otak ini tidak mengambil situs orang lain. Peramban memblokir itu, dan mengambil URL sembarangan dari server juga tidak aman.",
    "",
    "Yang bisa dibedah: tempel sumbernya ke sini. Boleh HTML, CSS, atau JavaScript, mentah atau di dalam pagar kode.",
    "",
    "Contoh permintaan: `Tolong ambil isi komponen dari HTML ini` lalu tempel kodenya.",
  ].join("\n");
}

function analyzeSource(text: string) {
  const source = unwrapFence(text);
  const tags = [...source.matchAll(/<([a-zA-Z][\w:-]*)\b([^>]*)>/g)];
  const counts = new Map<string, number>();
  const ids: string[] = [];
  const classes = new Map<string, number>();
  for (const match of tags) {
    const name = match[1].toLowerCase();
    counts.set(name, (counts.get(name) ?? 0) + 1);
    const attrs = match[2] ?? "";
    const id = attrs.match(/\sid=["']([^"']+)["']/i)?.[1];
    if (id) ids.push(id);
    const className = attrs.match(/\sclass=["']([^"']+)["']/i)?.[1];
    if (className) {
      for (const token of className.split(/\s+/)) {
        if (!token) continue;
        classes.set(token, (classes.get(token) ?? 0) + 1);
      }
    }
  }

  const scripts = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
  const styles = [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]);
  const fnNames = unique(
    scripts.flatMap((body) =>
      [...body.matchAll(/function\s+([A-Za-z_$][\w$]*)|const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/g)].map(
        (match) => match[1] || match[2],
      ),
    ),
  );
  const selectors = unique(
    styles.flatMap((body) =>
      [...body.matchAll(/(^|})\s*([^@}{][^{]*)\{/g)].map((match) => match[2].trim()).filter((item) => item.length < 80),
    ),
  ).slice(0, 12);
  const buttons = unique(
    [...source.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)].map((match) => stripTags(match[1]).slice(0, 60)),
  );
  const links = unique(
    [...source.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]),
  ).slice(0, 12);
  const inputs = [...source.matchAll(/<input\b([^>]*)>/gi)].map((match) => {
    const type = match[1].match(/\stype=["']([^"']+)["']/i)?.[1] ?? "text";
    const name = match[1].match(/\s(?:name|id)=["']([^"']+)["']/i)?.[1] ?? "(tanpa nama)";
    return `${name} · ${type}`;
  });

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const lines = [
    "Bedah sumber. Ini baca struktur, bukan menjalankan skripnya.",
    "",
    `Ada ${tags.length} tag buka, ${scripts.length} blok script, ${styles.length} blok style.`,
    "",
    "Komponen yang paling sering:",
    ...ranked.slice(0, 12).map(([name, count]) => `- \`<${name}>\` × ${count} — ${roleOf(name)}`),
  ];
  if (ids.length) lines.push("", "Id: " + unique(ids).slice(0, 16).map((id) => `\`${id}\``).join(", "));
  if (classes.size) {
    const top = [...classes.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => `\`${name}\` (${count})`);
    lines.push("", "Kelas yang menonjol: " + top.join(", "));
  }
  if (selectors.length) lines.push("", "Pemilih CSS:", ...selectors.map((item) => `- \`${item}\``));
  if (fnNames.length) lines.push("", "Fungsi di script: " + fnNames.slice(0, 16).map((name) => `\`${name}\``).join(", "));
  if (buttons.length) lines.push("", "Tombol: " + buttons.map((item) => `“${item}”`).join(", "));
  if (links.length) lines.push("", "Tautan:", ...links.map((href) => `- \`${href}\``));
  if (inputs.length) lines.push("", "Input:", ...inputs.map((item) => `- ${item}`));
  lines.push(
    "",
    "Cara membacanya: tag adalah kotak, kelas adalah pakaian yang sama untuk banyak kotak, id menandai satu kotak, script mengubah kotak setelah halaman hidup.",
  );
  return lines.join("\n");
}

function roleOf(tag: string) {
  const roles: Record<string, string> = {
    html: "bungkus seluruh dokumen",
    head: "data yang tidak terlihat, seperti judul dan gaya",
    body: "yang benar-benar tampil",
    header: "kepala halaman",
    nav: "menu pindah bagian",
    main: "isi utama",
    section: "satu bab",
    article: "satu tulisan utuh",
    aside: "catatan di samping",
    footer: "kaki halaman",
    h1: "judul terbesar",
    h2: "judul bagian",
    p: "paragraf",
    a: "tautan",
    button: "tombol yang melakukan sesuatu",
    form: "wadah isian",
    input: "kotak isian",
    img: "gambar",
    div: "kotak netral untuk mengatur letak",
    span: "potongan teks di dalam baris",
    script: "perilaku, JavaScript",
    style: "tampilan, CSS",
    link: "sambungan ke berkas lain di kepala",
    ul: "daftar",
    li: "butir daftar",
    canvas: "permukaan gambar untuk game atau grafik",
  };
  return roles[tag] ?? "elemen khusus";
}

function buildPage(prompt: string) {
  const title = titleFrom(prompt, "Pantai kecil");
  const html = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; font: 17px/1.5 Figtree, system-ui, sans-serif; background: #061018; color: #e6f2f4; }
    header, main, footer { width: min(720px, calc(100% - 32px)); margin-inline: auto; }
    header { padding: 48px 0 12px; }
    h1 { font-weight: 500; letter-spacing: -0.04em; font-size: clamp(2rem, 6vw, 3.4rem); margin: 0; }
    p.lead { color: #8aa8b3; max-width: 38ch; }
    .cards { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); padding-bottom: 48px; }
    article { border: 1px solid rgba(230,242,244,0.12); border-radius: 18px; padding: 16px; background: rgba(255,255,255,0.03); }
    button { height: 44px; border: 0; border-radius: 12px; padding: 0 16px; background: #6fb8b0; color: #061018; font-weight: 600; }
  </style>
</head>
<body>
  <header>
    <p class="lead">Dibuat otak lokal Samudra</p>
    <h1>${escapeHtml(title)}</h1>
    <p class="lead">${escapeHtml(prompt.slice(0, 180))}</p>
  </header>
  <main>
    <div class="cards">
      <article><h2>Arus</h2><p>Bagian pertama. Ganti teks ini sesuai keperluanmu.</p></article>
      <article><h2>Terumbu</h2><p>Bagian kedua. Kartu ini memakai kelas yang sama.</p></article>
      <article><h2>Pesisir</h2><p>Bagian ketiga, untuk ajakan atau catatan.</p></article>
    </div>
    <button type="button" onclick="this.textContent='Sudah dicatat'">Catat minat</button>
  </main>
  <footer><p class="lead">Satu berkas. Tidak ada API.</p></footer>
</body>
</html>`;
  return ["Halaman satu berkas, siap dijalankan.", "", "```html", html, "```"].join("\n");
}

function buildGame(prompt: string) {
  const title = titleFrom(prompt, "Mutiara");
  const html = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; min-height: 100dvh; display: grid; place-items: center; background: #061018; color: #e6f2f4; font-family: system-ui, sans-serif; }
    canvas { width: min(92vw, 480px); height: auto; border-radius: 16px; touch-action: none; background: #0b2230; }
  </style>
</head>
<body>
  <canvas id="sea" width="480" height="640"></canvas>
  <script>
    const canvas = document.querySelector("#sea");
    const ctx = canvas.getContext("2d");
    const pearls = Array.from({ length: 6 }, () => spawn());
    let score = 0;
    function spawn() {
      return { x: 40 + Math.random() * 400, y: -20 - Math.random() * 200, r: 12, v: 1.4 + Math.random() * 1.6 };
    }
    canvas.addEventListener("pointerdown", (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * (canvas.width / rect.width);
      const y = (event.clientY - rect.top) * (canvas.height / rect.height);
      for (const pearl of pearls) {
        const hit = Math.hypot(pearl.x - x, pearl.y - y) < pearl.r + 10;
        if (hit) { score += 1; Object.assign(pearl, spawn()); pearl.y = -10; }
      }
    });
    function frame() {
      ctx.clearRect(0, 0, 480, 640);
      ctx.fillStyle = "#d7ecea";
      ctx.font = "20px system-ui";
      ctx.fillText("Skor " + score, 20, 32);
      for (const pearl of pearls) {
        pearl.y += pearl.v;
        if (pearl.y > 660) Object.assign(pearl, spawn());
        ctx.beginPath();
        ctx.fillStyle = "#6fb8b0";
        ctx.arc(pearl.x, pearl.y, pearl.r, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(frame);
    }
    frame();
  </script>
</body>
</html>`;
  return ["Game satu berkas. Sentuh mutiara yang jatuh.", "", "```html", html, "```"].join("\n");
}

function paint(prompt: string): BrainReply {
  const title = escapeHtml(prompt.slice(0, 80) || "Laut");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 640">
  <defs>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#123246"/><stop offset="1" stop-color="#061018"/>
    </linearGradient>
  </defs>
  <rect width="960" height="640" fill="url(#sea)"/>
  <circle cx="760" cy="120" r="54" fill="#d7ecea" opacity="0.85"/>
  <path d="M0 390 C 160 340 240 450 400 400 C 560 350 680 470 960 390 L 960 640 L 0 640 Z" fill="#0e3a46"/>
  <path d="M0 460 C 180 420 300 520 480 470 C 660 420 760 530 960 460 L 960 640 L 0 640 Z" fill="#6fb8b0" opacity="0.35"/>
  <text x="48" y="560" fill="#e6f2f4" font-family="system-ui,sans-serif" font-size="28">${title}</text>
</svg>`;
  const imageUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return {
    pathway: "jalur.gambar",
    imageUrl,
    text: "Gambar ini digambar otak lokal sebagai SVG, bukan foto dari model berbayar. Ubah kata-katanya untuk mengganti judul di langit.",
  };
}

function tryMath(text: string) {
  const hit = text.match(/(?:hitung|berapa)?\s*([0-9+\-*/%().\s]{3,})/i);
  if (!hit) return null;
  const expr = hit[1].trim();
  if (!/^[\d+\-*/%().\s]+$/.test(expr) || !/\d/.test(expr) || !/[+\-*/%]/.test(expr)) return null;
  if ((expr.match(/\(/g) ?? []).length !== (expr.match(/\)/g) ?? []).length) return null;
  try {
    const value = Function(`"use strict"; return (${expr})`)();
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    return `Hasil \`${expr}\` = **${value}**.`;
  } catch {
    return null;
  }
}

function fallback(text: string) {
  const sample = text.replace(/\s+/g, " ").slice(0, 160);
  return [
    `Aku membaca: “${sample}”.`,
    "",
    "Otak lokal ini tidak mengarang fakta di luar jalur yang tertanam. Ia bisa:",
    "- membedah HTML, CSS, dan JavaScript yang kamu tempel",
    "- menyusun halaman atau game satu berkas",
    "- menghitung ekspresi",
    "- menjawab dari jalur pengetahuan (ketik `peta otak`)",
    "",
    "Perjelas permintaanmu, atau tempel sumbernya.",
  ].join("\n");
}

function titleFrom(prompt: string, fallbackTitle: string) {
  const cut = prompt
    .replace(/\b(buat|bikin|buatkan|tolong|halaman|web|html|game|permainan|satu file|lengkap)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cut.slice(0, 48) || fallbackTitle;
}

function unwrapFence(text: string) {
  const fence = text.match(/```(?:html|css|js|javascript|tsx|jsx)?\s*([\s\S]*?)```/i);
  return fence ? fence[1] : text;
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function unique(values: Array<string | undefined>) {
  return [...new Set(values.filter((item): item is string => Boolean(item)))];
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&" + "amp;")
    .replaceAll("<", "&" + "lt;")
    .replaceAll(">", "&" + "gt;")
    .replaceAll('"', "&" + "quot;");
}
