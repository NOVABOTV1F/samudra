/** Pengaturan user — key AI hanya di Cloudflare secrets. Chat bebas, tanpa sewa key. */

export type ThemeMode = "light" | "dark" | "system";
export type PreferProvider = "brain" | "deepseek" | "groq" | "claude";

export type UserSettings = {
  systemPrompt: string;
  personality: string;
  preferProvider: PreferProvider;
  musicEnabled: boolean;
  musicAutoPlay: boolean;
  theme: ThemeMode;
  textScale: number;
  defaultVersion: "1" | "2" | "3";
  showPathway: boolean;
  autoDownloadLong: boolean;
  enterToSend: boolean;
  showStatusLine: boolean;
};

export const APP_VERSION = "1.9.0";

const KEY = "samudra-settings-v1";

export const DEFAULT_SETTINGS: UserSettings = {
  systemPrompt: `Kamu adalah Samudra AI, asisten pintar.
Bantu coding, website, debug, menulis, bisnis, belajar.
Bahasa Indonesia kecuali diminta lain. Kode web: HTML satu file bila memungkinkan.
Gambar: tautan Google Images bila diminta.`,
  personality: "ramah, jelas, membantu",
  preferProvider: "deepseek",
  musicEnabled: true,
  musicAutoPlay: false,
  theme: "system",
  textScale: 1,
  defaultVersion: "1",
  showPathway: false,
  autoDownloadLong: true,
  enterToSend: true,
  showStatusLine: true,
};

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<UserSettings> & Record<string, unknown>;
    // buang field sewa key lama jika ada
    const {
      accessTier: _a,
      accessUntil: _u,
      licenseCode: _l,
      accessUser: _x,
      geminiKey: _g,
      groqKey: _q,
      gmailEmail: _e,
      gmailLoggedIn: _gl,
      ...rest
    } = parsed as UserSettings & Record<string, unknown>;
    return { ...DEFAULT_SETTINGS, ...(rest as Partial<UserSettings>) };
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
  try {
    const scale = loadSettings().textScale || 1;
    root.style.fontSize = `${16 * scale}px`;
  } catch {
    /* */
  }
}

/** Chat selalu bebas — sistem sewa key dihapus */
export function hasActiveAccess(_s?: UserSettings): boolean {
  return true;
}

export function accessRemainingLabel(_s?: UserSettings): string {
  return "Bebas";
}

export const ADMIN_TRIGGER = "/SAMUDRA.PANEL";
export const ADMIN_USER = "ZUZUXF";
export const ADMIN_KEY = "DEV=ZUZUXF_AI=™X10WDEV";
export const ADMIN_KEY_ALIASES = [
  ADMIN_KEY,
  "DEV=SAMUDRA=™X10WDEV",
  "DEV=ZUZUXF_AI=X10WDEV",
];

export const QUICK_ACTIONS = [
  { id: "coding", title: "Coding", blurb: "Kode siap jalan", prompt: "Bantu coding lengkap, rapi, bisa dijalankan. Topik:" },
  { id: "website", title: "Website", blurb: "HTML satu file", prompt: "Buat website HTML satu file lengkap, responsif, modern." },
  { id: "debug", title: "Debug", blurb: "Perbaiki error", prompt: "Debug kode ini: temukan error, perbaiki. Kode:\n" },
  { id: "toko", title: "Toko online", blurb: "Produk + WA", prompt: "Buat halaman toko online HTML: produk, harga, tombol WhatsApp." },
  { id: "belajar", title: "Belajar", blurb: "Langkah + soal", prompt: "Jelaskan untuk pemula, langkah demi langkah + 3 soal:" },
] as const;

export const HOME_TOOLS = QUICK_ACTIONS;
