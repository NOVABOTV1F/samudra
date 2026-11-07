/** Pengaturan user — key AI hanya di Cloudflare secrets */

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
  accessUser: string;
  musicEnabled: boolean;
  musicAutoPlay: boolean;
  gmailEmail: string;
  gmailLoggedIn: boolean;
  theme: ThemeMode;
  textScale: number;
  defaultVersion: "1" | "2" | "3";
  compactMode: boolean;
  showPathway: boolean;
  autoDownloadLong: boolean;
  soundSend: boolean;
  enterToSend: boolean;
  showStatusLine: boolean;
};

export const APP_VERSION = "1.8.2";

const KEY = "samudra-settings-v1";

export const DEFAULT_SETTINGS: UserSettings = {
  systemPrompt: `Kamu adalah Samudra, asisten AI.
Bantu coding, website, debug, menulis, bisnis, belajar.
Bahasa Indonesia kecuali diminta lain.`,
  personality: "jelas dan ringkas",
  preferProvider: "deepseek",
  accessTier: "none",
  accessUntil: 0,
  licenseCode: "",
  accessUser: "",
  musicEnabled: true,
  musicAutoPlay: false,
  gmailEmail: "",
  gmailLoggedIn: false,
  theme: "system",
  textScale: 1,
  defaultVersion: "1",
  compactMode: false,
  showPathway: false,
  autoDownloadLong: true,
  soundSend: false,
  enterToSend: true,
  showStatusLine: true,
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
  try {
    const scale = loadSettings().textScale || 1;
    root.style.fontSize = `${16 * scale}px`;
  } catch {
    /* */
  }
}

export function redeemLicense(code: string): {
  ok: boolean;
  message: string;
  patch?: Partial<UserSettings>;
  needServer?: boolean;
} {
  const c = code.trim();
  const up = c.toUpperCase();
  const now = Date.now();

  if (c.startsWith("TODA_") || c.startsWith("toda_")) {
    return { ok: false, needServer: true, message: "Verifikasi key ke server…" };
  }

  if (up.startsWith("FREE-1D") || up === "SAMUDRA-FREE") {
    return {
      ok: true,
      message: "Akses gratis 24 jam aktif.",
      patch: { accessTier: "free", accessUntil: now + 24 * 60 * 60 * 1000, licenseCode: up },
    };
  }
  if (up.startsWith("PAID-3W") || up === "SAMUDRA-20K") {
    return {
      ok: true,
      message: "Akses berbayar 3 minggu aktif.",
      patch: { accessTier: "paid", accessUntil: now + 21 * 24 * 60 * 60 * 1000, licenseCode: up },
    };
  }
  if (up.startsWith("PERM") || up === "SAMUDRA-PERM") {
    return {
      ok: true,
      message: "Akses permanen aktif.",
      patch: {
        accessTier: "permanent",
        accessUntil: now + 100 * 365 * 24 * 60 * 60 * 1000,
        licenseCode: up,
      },
    };
  }
  return {
    ok: false,
    message: "Key tidak valid. Beli di bot Telegram, dapat key TODA_… lalu login di sini.",
  };
}

export async function loginWithAccessKey(apiKey: string): Promise<{
  ok: boolean;
  message: string;
  patch?: Partial<UserSettings>;
}> {
  const key = apiKey.trim();
  if (!key) return { ok: false, message: "Isi API Key dulu." };

  const local = redeemLicense(key);
  if (local.ok && local.patch) return { ok: true, message: local.message, patch: local.patch };

  try {
    const res = await fetch("/api/access?action=login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: key }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      username?: string;
      until?: number;
      untilLabel?: string;
      tier?: string;
    };
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        message:
          data.error ||
          "Key ditolak. Pastikan key dari bot (Approve sewa) yang sudah terhubung Samudra.",
      };
    }
    return {
      ok: true,
      message: `Login berhasil · aktif sampai ${data.untilLabel || "-"}`,
      patch: {
        accessTier: (data.tier as AccessTier) || "paid",
        accessUntil: data.until || Date.now() + 86400000,
        licenseCode: key,
        accessUser: data.username || "",
      },
    };
  } catch {
    return { ok: false, message: "Gagal hubungi server. Cek koneksi." };
  }
}

export function hasActiveAccess(s: UserSettings): boolean {
  if (s.accessTier === "permanent") return true;
  if (s.accessTier === "none") return false;
  return s.accessUntil > Date.now();
}

export function accessRemainingLabel(s: UserSettings): string {
  if (s.accessTier === "permanent") return "Permanent";
  if (s.accessTier === "none" || s.accessUntil <= Date.now()) return "Belum login";
  const ms = s.accessUntil - Date.now();
  const h = Math.floor(ms / 3600000);
  const d = Math.floor(h / 24);
  if (d >= 1) return `${d}h ${h % 24}j`;
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}j ${m}m`;
}

export const LOGIN_REQUIRED_MSG =
  "Login dulu di Pengaturan → Akses (key dari bot Telegram).";

export const ADMIN_TRIGGER = "/SAMUDRA.PANEL";
export const ADMIN_USER = "ZUZUXF";
export const ADMIN_KEY = "DEV=ZUZUXF_AI=™X10WDEV";
export const ADMIN_KEY_ALIASES = [
  ADMIN_KEY,
  "DEV=SAMUDRA=™X10WDEV",
  "DEV=ZUZUXF_AI=X10WDEV",
];

export const QUICK_ACTIONS = [
  { id: "coding", title: "Coding", blurb: "Kode", prompt: "Bantu coding lengkap:" },
  { id: "website", title: "Website", blurb: "HTML", prompt: "Buat website HTML satu file." },
  { id: "debug", title: "Debug", blurb: "Error", prompt: "Debug kode ini:\n" },
  { id: "toko", title: "Toko", blurb: "Online", prompt: "Buat halaman toko online HTML + WA." },
  { id: "belajar", title: "Belajar", blurb: "Materi", prompt: "Jelaskan untuk pemula:" },
] as const;

export const HOME_TOOLS = QUICK_ACTIONS;
