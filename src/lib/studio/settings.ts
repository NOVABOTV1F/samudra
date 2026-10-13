/** Pengaturan user + lisensi akses (localStorage) */

export type AccessTier = "none" | "free" | "paid" | "permanent";

export type UserSettings = {
  systemPrompt: string;
  personality: string;
  geminiKey: string;
  groqKey: string;
  preferProvider: "brain" | "gemini" | "groq";
  accessTier: AccessTier;
  accessUntil: number; // epoch ms
  licenseCode: string;
};

const KEY = "samudra-settings-v1";

export const DEFAULT_SETTINGS: UserSettings = {
  systemPrompt:
    "Kamu adalah ZUZUXF_AI / Otak Samudra. Bantu user dengan bahasa ramah, jelas, dan praktis. Utamakan bahasa Indonesia kecuali diminta lain.",
  personality: "ramah, ringkas, sedikit formal",
  geminiKey: "",
  groqKey: "",
  preferProvider: "brain",
  accessTier: "none",
  accessUntil: 0,
  licenseCode: "",
};

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
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

/** Kode lisensi sederhana (bukan payment gateway) */
export function redeemLicense(code: string): {
  ok: boolean;
  message: string;
  patch?: Partial<UserSettings>;
} {
  const c = code.trim().toUpperCase();
  const now = Date.now();

  // FREE-1D-XXXX → 24 jam
  if (c.startsWith("FREE-1D") || c === "SAMUDRA-FREE") {
    return {
      ok: true,
      message: "Akses gratis 24 jam aktif.",
      patch: {
        accessTier: "free",
        accessUntil: now + 24 * 60 * 60 * 1000,
        licenseCode: c,
      },
    };
  }

  // PAID-3W-XXXX atau SAMUDRA-20K → 3 minggu
  if (c.startsWith("PAID-3W") || c === "SAMUDRA-20K") {
    return {
      ok: true,
      message: "Akses berbayar 3 minggu aktif.",
      patch: {
        accessTier: "paid",
        accessUntil: now + 21 * 24 * 60 * 60 * 1000,
        licenseCode: c,
      },
    };
  }

  // PERM-XXXX atau SAMUDRA-PERM → permanen
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
