/** Pengaturan user — key AI hanya di Cloudflare Runtime secrets */

export type AccessTier = "none" | "free" | "paid" | "permanent";
export type ThemeMode = "light" | "dark" | "system";
export type PreferProvider = "brain" | "deepseek" | "groq" | "claude" | "gemini";

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

export const APP_VERSION = "1.6.2";

const KEY = "samudra-settings-v1";

export const DEFAULT_SETTINGS: UserSettings = {
  systemPrompt: `Kamu adalah ZUZUXF_AI / Otak Samudra v1.6.2 — asisten serba bisa.
Bisa: coding, website, debug, menulis, belajar, analisis, bisnis, terjemah, math, rencana — legal & aman.
Gaya: jelas, praktis. Bahasa Indonesia kecuali diminta lain.
Kode web: HTML satu file siap jalan.
Gambar: JANGAN generate — tautan Google Images https://www.google.com/search?tbm=isch&q=KATA_KUNCI`,
  personality: "ramah, cerdas, ringkas tapi lengkap",
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
    /* */
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

/** Buka panel: ketik /SAMUDRA.PANEL di chat */
export const ADMIN_TRIGGER = "/SAMUDRA.PANEL";
/** Username admin */
export const ADMIN_USER = "ZUZUXF";
/** Password / key admin */
export const ADMIN_KEY = "DEV=ZUZUXF_AI=™X10WDEV";
/** Alias key lama (masih diterima) */
export const ADMIN_KEY_ALIASES = [
  ADMIN_KEY,
  "DEV=SAMUDRA=™X10WDEV",
  "DEV=ZUZUXF_AI=X10WDEV",
];

export const QUICK_ACTIONS = [
  {
    id: "coding",
    title: "Coding",
    blurb: "HTML/CSS/JS/Python",
    prompt: "Bantu coding lengkap, rapi, bisa dijalankan. Topik:",
  },
  {
    id: "website",
    title: "Website",
    blurb: "Landing siap deploy",
    prompt: "Buat website HTML satu file lengkap, responsif, modern.",
  },
  {
    id: "debug",
    title: "Debug",
    blurb: "Perbaiki error",
    prompt: "Debug kode ini: temukan error, perbaiki. Kode:\n",
  },
  {
    id: "toko",
    title: "Toko online",
    blurb: "Halaman jualan + WA",
    prompt: "Buat halaman toko online HTML satu file: produk, harga, tombol WhatsApp.",
  },
  {
    id: "belajar",
    title: "Belajar",
    blurb: "Langkah + latihan",
    prompt: "Jelaskan untuk pemula, langkah demi langkah + 3 soal:",
  },
  {
    id: "menulis",
    title: "Menulis",
    blurb: "Caption / email",
    prompt: "Tulis teks siap pakai. Kebutuhan:",
  },
  {
    id: "bisnis",
    title: "Bisnis",
    blurb: "Harga & strategi",
    prompt: "Strategi bisnis praktis. Konteks:",
  },
  {
    id: "analisis",
    title: "Analisis",
    blurb: "Pro-kontra",
    prompt: "Analisis terstruktur: pro-kontra, risiko, rekomendasi:",
  },
  {
    id: "terjemah",
    title: "Terjemah",
    blurb: "ID ↔ EN / lain",
    prompt: "Terjemahkan teks berikut dengan natural:",
  },
  {
    id: "seo",
    title: "SEO teks",
    blurb: "Judul & deskripsi",
    prompt: "Buatkan judul SEO, meta description, dan 5 keyword untuk:",
  },
  {
    id: "ide",
    title: "Brainstorm",
    blurb: "10 ide cepat",
    prompt: "Berikan 10 ide kreatif dan praktis untuk:",
  },
  {
    id: "apaaja",
    title: "Apa saja",
    blurb: "Full power",
    prompt: "Saya butuh bantuan untuk:",
  },
] as const;
