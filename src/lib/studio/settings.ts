/** Pengaturan user — key AI hanya di Cloudflare Runtime secrets */

export type AccessTier = "none" | "free" | "paid" | "permanent";
export type ThemeMode = "light" | "dark" | "system";

export type UserSettings = {
  systemPrompt: string;
  personality: string;
  preferProvider: "brain" | "gemini" | "groq";
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

export const APP_VERSION = "1.5";

const KEY = "samudra-settings-v1";

export const DEFAULT_SETTINGS: UserSettings = {
  systemPrompt:
    "Kamu adalah ZUZUXF_AI / Otak Samudra v1.5. Bantu user ramah, jelas, praktis. Bahasa Indonesia kecuali diminta lain. Jika user minta gambar/foto, JANGAN generate image — kirim tautan Google Images: https://www.google.com/search?tbm=isch&q=KATA_KUNCI. Untuk kode web, utamakan HTML satu file siap dijalankan dan bisa di-deploy.",
  personality: "ramah, ringkas, profesional ringan",
  preferProvider: "groq",
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

export const ADMIN_TRIGGER = "/SAMUDRA.PANEL";
export const ADMIN_KEY = "DEV=ZUZUXF_AI=™X10WDEV";

export const QUICK_ACTIONS = [
  {
    id: "coding",
    title: "Coding",
    blurb: "HTML/CSS/JS siap jalan",
    prompt:
      "Bantu saya coding: buat halaman HTML satu file yang rapi, responsif, dan siap dijalankan di browser. Jelaskan singkat cara kerjanya.",
  },
  {
    id: "website",
    title: "Website",
    blurb: "Siap deploy V1/V2/V3",
    prompt:
      "Buatkan website HTML satu file (index.html) lengkap, responsif, siap di-deploy. Sertakan struktur hero, konten, dan footer.",
  },
  {
    id: "belajar",
    title: "Belajar",
    blurb: "Penjelasan langkah demi langkah",
    prompt:
      "Jelaskan topik ini langkah demi langkah untuk pemula, dengan analogi sederhana dan 3 soal latihan singkat:",
  },
  {
    id: "menulis",
    title: "Menulis",
    blurb: "Draf teks profesional",
    prompt:
      "Bantu saya menulis draf yang jelas dan profesional. Minta detail singkat dulu jika kurang lengkap, lalu berikan hasil siap pakai.",
  },
] as const;
