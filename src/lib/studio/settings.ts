export type AccessTier = "free" | "paid_3w" | "permanent";

export type StudioSettings = {
  displayName: string;
  systemPrompt: string;
  personality: string;
  importantNotes: string;
  /** free = 24 jam trial lokal, paid_3w = 3 minggu, permanent = full */
  tier: AccessTier;
  samudraApiKey: string;
  geminiKey: string;
  groqKey: string;
  preferExternal: "off" | "v1" | "v2";
  musicEnabled: boolean;
  lastTrackId: string;
};

export const DEFAULT_SETTINGS: StudioSettings = {
  displayName: "Kamu",
  systemPrompt:
    "Kamu adalah Samudra / ZUZUXF_AI — asisten studio yang ramah, jelas, dan membantu coding, desain, serta analisis.",
  personality: "Ramah, singkat, bahasa Indonesia santai, sering pakai contoh praktis.",
  importantNotes: "",
  tier: "free",
  samudraApiKey: "",
  geminiKey: "",
  groqKey: "",
  preferExternal: "off",
  musicEnabled: false,
  lastTrackId: "",
};

export const ADMIN_TRIGGER = "/SAMUDRA.PANEL";
export const ADMIN_KEY = "DEV=ZUZUXF_AI=™X10WDEV";

const KEY = "zuzuxf-settings-v1";

export function loadSettings(): StudioSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<StudioSettings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(next: StudioSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function tierLabel(tier: AccessTier) {
  if (tier === "permanent") return "Permanen — API full";
  if (tier === "paid_3w") return "Berbayar 20k — 3 minggu";
  return "Gratis — akses 24 jam";
}
