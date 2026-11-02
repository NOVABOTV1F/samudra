/** Pengaturan user — key AI hanya di Cloudflare Runtime secrets */

export type AccessTier = "none" | "free" | "paid" | "permanent";
export type ThemeMode = "light" | "dark" | "system";
export type PreferProvider = "brain" | "deepseek" | "gemini" | "groq";

export type UserSettings = {
  systemPrompt: string;
  personality: string;
  preferProvider: PreferProvider;
  accessTier: AccessTier;
  accessUntil: number;
  licenseCode: string;
  musicEnabled: boolean;
  musicAutoPlay: boolean;
  gmailEmail: string;
  gmailLoggedIn: boolean;
  theme: ThemeMode;
  textScale: number;
};

export const APP_VERSION = "1.6";

const KEY = "samudra-settings-v1";

export const DEFAULT_SETTINGS: UserSettings = {
  systemPrompt: `Kamu adalah ZUZUXF_AI / Otak Samudra v1.6 — asisten serba bisa.
Bisa: coding (HTML/CSS/JS/Python/dll), website siap deploy, debugging, menulis, belajar, analisis, rencana, bisnis, Roblox/joki info umum, terjemah, math, dan apapun yang diminta user selama legal & aman.
Gaya: jelas, praktis, langsung pakai. Bahasa Indonesia kecuali diminta lain.
Kode web: utamakan HTML satu file siap jalan + penjelasan singkat.
Gambar/foto: JANGAN generate image/SVG. Kirim tautan Google Images:
https://www.google.com/search?tbm=isch&q=KATA_KUNCI
Jawab lengkap; kalau kurang data, tanya 1–2 poin saja lalu lanjut.`,
  personality: "ramah, cerdas, ringkas tapi lengkap, profesional ringan",
  preferProvider: "deepseek",
  accessTier: "none",
  accessUntil: 0,
  licenseCode: "",
  musicEnabled: true,
  musicAutoPlay: false,
  gmailEmail: "",
  gmailLoggedIn: false,
  theme: "system",
  textScale: 1,
};

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<UserSettings> & {
      geminiKey?: string;
      groqKey?: string;
    };
    const { geminiKey: _g, groqKey: _q, ...rest } = parsed;
    // migrasi preferProvider lama
    if ((rest as { preferProvider?: string }).preferProvider === "gemini") {
      (rest as UserSettings).preferProvider = "deepseek";
    }
    return { ...DEFAULT_SETTINGS, ...rest };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: UserSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  let mode = theme;
  if (theme === "system") {
    mode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  root.setAttribute("data-theme", mode === "dark" ? "dark" : "light");
  root.style.colorScheme = mode === "dark" ? "dark" : "light";
}

export function redeemLicense(code: string): {
  ok: boolean;
  message: string;
  patch?: Partial<UserSettings>;
} {
  const c = code.trim().toUpperCase();
  const now = Date.now();
  if (c.startsWith("FREE-1D") || c === "SAMUDRA-FREE") {
    return {
      ok: true,
      message: "Akses gratis 24 jam aktif.",
      patch: { accessTier: "free", accessUntil: now + 24 * 60 * 60 * 1000, licenseCode: c },
    };
  }
  if (c.startsWith("PAID-3W") || c === "SAMUDRA-20K") {
    return {
      ok: true,
      message: "Akses berbayar 3 minggu aktif.",
      patch: { accessTier: "paid", accessUntil: now + 21 * 24 * 60 * 60 * 1000, licenseCode: c },
    };
  }
  if (c.startsWith("PERM") || c === "SAMUDRA-PERM") {
    return {
      ok: true,
      message: "Akses permanen aktif.",
      patch: {
        accessTier: "permanent",
        accessUntil: now + 100 * 365 * 24 * 60 * 60 * 1000,
        licenseCode: c,
      },
    };
  }
  return { ok: false, message: "Kode tidak valid." };
}

export function hasActiveAccess(s: UserSettings): boolean {
  if (s.accessTier === "permanent") return true;
  if (s.accessTier === "none") return false;
  return s.accessUntil > Date.now();
}

export function accessRemainingLabel(s: UserSettings): string {
  if (s.accessTier === "permanent") return "Permanent ∞";
  if (s.accessTier === "none" || s.accessUntil <= Date.now()) return "Belum aktif";
  const ms = s.accessUntil - Date.now();
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d} hari ${h % 24} jam tersisa`;
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h} jam ${m} mnt tersisa`;
}

export const ADMIN_TRIGGER = "/SAMUDRA.PANEL";
export const ADMIN_KEY = "DEV=ZUZUXF_AI=™X10WDEV";

export const QUICK_ACTIONS = [
  {
    id: "coding",
    title: "Coding",
    blurb: "HTML/CSS/JS/Python siap pakai",
    prompt:
      "Bantu coding serius: buat solusi lengkap, rapi, bisa dijalankan. Jelaskan singkat cara pakai. Topik:",
  },
  {
    id: "website",
    title: "Website",
    blurb: "Landing + toko + form siap deploy",
    prompt:
      "Buatkan website HTML satu file lengkap, responsif, modern (hero, konten, CTA, footer). Siap buka di browser / deploy.",
  },
  {
    id: "debug",
    title: "Debug",
    blurb: "Cari bug & perbaiki kode",
    prompt:
      "Debug kode ini: temukan error, jelaskan penyebab, beri versi yang sudah diperbaiki. Kode:\n",
  },
  {
    id: "belajar",
    title: "Belajar",
    blurb: "Langkah demi langkah + latihan",
    prompt:
      "Jelaskan untuk pemula, langkah demi langkah, analogi sederhana, lalu 3 soal latihan singkat:",
  },
  {
    id: "menulis",
    title: "Menulis",
    blurb: "Caption, email, proposal",
    prompt:
      "Tulis teks siap pakai (jelas & profesional). Kalau kurang detail tanya singkat dulu. Kebutuhan:",
  },
  {
    id: "bisnis",
    title: "Bisnis",
    blurb: "Ide, harga, strategi toko",
    prompt:
      "Bantu strategi bisnis praktis (harga, promo, copywriting, operasional). Konteks:",
  },
  {
    id: "analisis",
    title: "Analisis",
    blurb: "Ringkas data / bandingkan opsi",
    prompt:
      "Analisis topik ini secara terstruktur: pro-kontra, risiko, rekomendasi akhir:",
  },
  {
    id: "apaaja",
    title: "Apa saja",
    blurb: "Tanya bebas — AI full power",
    prompt: "Saya butuh bantuan untuk:",
  },
] as const;
