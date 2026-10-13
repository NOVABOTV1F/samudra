/** Pengaturan user (tanpa API key — key hanya di Cloudflare Runtime secrets) */

export type AccessTier = "none" | "free" | "paid" | "permanent";

export type UserSettings = {
  systemPrompt: string;
  personality: string;
  /** V1 gemini | V2 groq | brain lokal */
  preferProvider: "brain" | "gemini" | "groq";
  accessTier: AccessTier;
  accessUntil: number;
  licenseCode: string;
};

const KEY = "samudra-settings-v1";

export const DEFAULT_SETTINGS: UserSettings = {
  systemPrompt:
    "Kamu adalah ZUZUXF_AI / Otak Samudra. Bantu user dengan bahasa ramah, jelas, dan praktis. Utamakan bahasa Indonesia kecuali diminta lain.",
  personality: "ramah, ringkas, sedikit formal",
  preferProvider: "groq",
  accessTier: "none",
  accessUntil: 0,
  licenseCode: "",
};

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    // buang field key lama jika ada di storage
    const { geminiKey: _g, groqKey: _q, ...rest } = parsed as Partial<UserSettings> &
      { geminiKey?: string; groqKey?: string };
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
