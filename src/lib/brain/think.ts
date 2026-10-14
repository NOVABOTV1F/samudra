import raw from "./raw.json" with { type: "json" };

export type BrainReply = {
  text: string;
  pathway: string;
  imageUrl?: string;
};

type Pathway = {
  id: string;
  lane?: string;
  title: string;
  keywords: string[];
  answer: string;
};

const pathways = (raw as { pathways: Pathway[] }).pathways;

const FILE_AT = 8000;

export function think(text: string, mode: "chat" | "image" = "chat"): BrainReply {
  const clean = text.trim();
  if (!clean) return { text: "Tulis sesuatu dulu.", pathway: "inti.kosong" };
  if (mode === "image") return googleImageLink(clean);

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
    preview: `${preview}\n\n---\n\nJawaban ini ${text.length.toLocaleString("id-ID")} karakter, lebih dari ${FILE_AT.toLocaleString("id-ID")}. Berkas utuhnya diunduh otomatis.`,
    filename: "otak-samudra.md",
    full: text,
  };
}

/** v1.3: tidak generate gambar — hanya URL Google Images */
function googleImageLink(prompt: string): BrainReply {
  const q = prompt
    .replace(/\b(buat|bikin|buatkan|tolong|gambar|image|foto|lukis|generate)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim() || "laut biru";
  const url = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(q)}`;
  return {
    pathway: "jalur.gambar.google",
    text: [
      `Pencarian gambar Google untuk **${q}**:`,
      "",
      url,
      "",
      "Buka tautan itu di browser untuk melihat gambar. Aku tidak men-generate gambar sendiri.",
    ].join("\n"),
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
    for (const word of pathway.keywords ?? []) {
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
  return ["Peta otak Samudra (lokal).", "", ...lines].join("\n");
}

function urlHint() {
  return [
    "Otak lokal tidak mengambil situs orang lain.",
    "Tempel HTML/CSS/JS ke sini untuk dibedah.",
  ].join("\n");
}

function analyzeSource(text: string) {
  const source = unwrapFence(text);
  const tags = [...source.matchAll(/<([a-zA-Z][\w:-]*)\b([^>]*)>/g)];
  const counts = new Map<string, number>();
  for (const match of tags) {
    const name = match[1].toLowerCase();
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return [
    "Bedah sumber (struktur saja).",
    "",
    `Tag buka: ${tags.length}`,
    ...ranked.slice(0, 12).map(([name, count]) => `- \`<${name}>\` × ${count}`),
  ].join("\n");
}

function buildPage(prompt: string) {
  const title = titleFrom(prompt, "Pantai kecil");
  const html = `<!doctype html>
<html lang="id"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>body{margin:0;font:17px/1.5 system-ui;background:#f4f9ff;color:#0f2744}header,main{width:min(720px,calc(100% - 32px));margin:auto}h1{letter-spacing:-.03em}</style>
</head><body><header><h1>${escapeHtml(title)}</h1><p>${escapeHtml(prompt.slice(0, 160))}</p></header>
<main><p>Halaman satu berkas dari Otak Samudra v1.3</p></main></body></html>`;
  return ["Halaman satu berkas:", "", "```html", html, "```"].join("\n");
}

function buildGame(prompt: string) {
  const title = titleFrom(prompt, "Mutiara");
  const html = `<!doctype html>
<html lang="id"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(title)}</title>
<style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#0b1220;color:#e8f1ff;font-family:system-ui}canvas{width:min(92vw,480px);border-radius:16px;touch-action:none;background:#132033}</style>
</head><body><canvas id="c" width="480" height="640"></canvas>
<script>
const c=document.getElementById('c'),x=c.getContext('2d');
let score=0;const items=Array.from({length:6},()=>({x:40+Math.random()*400,y:-Math.random()*200,v:1.5+Math.random()*2}));
c.onpointerdown=e=>{const r=c.getBoundingClientRect();const px=(e.clientX-r.left)*(c.width/r.width),py=(e.clientY-r.top)*(c.height/r.height);
for(const it of items){if(Math.hypot(it.x-px,it.y-py)<24){score++;it.y=-10;it.x=40+Math.random()*400;}}};
(function loop(){x.clearRect(0,0,480,640);x.fillStyle='#e8f1ff';x.font='20px system-ui';x.fillText('Skor '+score,20,32);
for(const it of items){it.y+=it.v;if(it.y>660){it.y=-10;it.x=40+Math.random()*400;}x.beginPath();x.fillStyle='#5eb0ff';x.arc(it.x,it.y,12,0,6.28);x.fill();}
requestAnimationFrame(loop);})();
</script></body></html>`;
  return ["Game satu berkas:", "", "```html", html, "```"].join("\n");
}

function tryMath(text: string) {
  const hit = text.match(/(?:hitung|berapa)?\s*([0-9+\-*/%().\s]{3,})/i);
  if (!hit) return null;
  const expr = hit[1].trim();
  if (!/^[\d+\-*/%().\s]+$/.test(expr) || !/\d/.test(expr) || !/[+\-*/%]/.test(expr)) return null;
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
    "Otak lokal: bedah HTML, buat halaman/game, hitung, jalur pengetahuan.",
    "Untuk gambar: ketik “buat gambar …” → aku kirim tautan Google Images.",
    "V1/V2 (key di Cloudflare) untuk jawaban cloud lebih luas.",
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&" + "amp;")
    .replaceAll("<", "&" + "lt;")
    .replaceAll(">", "&" + "gt;")
    .replaceAll('"', "&" + "quot;");
}
