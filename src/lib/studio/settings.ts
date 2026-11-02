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
  defaultVersion: "1" | "2" | "3";
  compactMode: boolean;
  showPathway: boolean;
  autoDownloadLong: boolean;
  soundSend: boolean;
};

export const APP_VERSION = "1.6.4";

const KEY = "samudra-settings-v1";

export const DEFAULT_SETTINGS: UserSettings = {
  systemPrompt: `Kamu adalah ZUZUXF_AI / Otak Samudra v1.6.4.
Bantu coding, website, debug, menulis, bisnis, belajar — legal & aman.
Bahasa Indonesia kecuali diminta lain. Kode web: HTML satu file.
Gambar: hanya tautan Google Images, jangan generate image.`,
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
  defaultVersion: "1",
  compactMode: false,
  showPathway: false,
  autoDownloadLong: true,
  soundSend: false,
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
export const ADMIN_USER = "ZUZUXF";
export const ADMIN_KEY = "DEV=ZUZUXF_AI=™X10WDEV";
export const ADMIN_KEY_ALIASES = [
  ADMIN_KEY,
  "DEV=SAMUDRA=™X10WDEV",
  "DEV=ZUZUXF_AI=X10WDEV",
];

/** ~30 tools total — beranda hanya menampilkan 5 pertama */
export const QUICK_ACTIONS = [
  { id: "coding", title: "Coding", blurb: "Kode siap jalan", prompt: "Bantu coding lengkap, rapi, bisa dijalankan. Topik:" },
  { id: "website", title: "Website", blurb: "HTML satu file", prompt: "Buat website HTML satu file lengkap, responsif, modern." },
  { id: "debug", title: "Debug", blurb: "Perbaiki error", prompt: "Debug kode ini: temukan error, perbaiki. Kode:\n" },
  { id: "toko", title: "Toko online", blurb: "Produk + WA", prompt: "Buat halaman toko online HTML: produk, harga, tombol WhatsApp." },
  { id: "belajar", title: "Belajar", blurb: "Langkah + soal", prompt: "Jelaskan untuk pemula, langkah demi langkah + 3 soal:" },
  { id: "menulis", title: "Menulis", blurb: "Teks siap pakai", prompt: "Tulis teks siap pakai. Kebutuhan:" },
  { id: "bisnis", title: "Bisnis", blurb: "Strategi", prompt: "Strategi bisnis praktis. Konteks:" },
  { id: "analisis", title: "Analisis", blurb: "Pro-kontra", prompt: "Analisis terstruktur: pro-kontra, risiko, rekomendasi:" },
  { id: "terjemah", title: "Terjemah", blurb: "ID ↔ EN", prompt: "Terjemahkan teks berikut dengan natural:" },
  { id: "seo", title: "SEO", blurb: "Judul + meta", prompt: "Buatkan judul SEO, meta description, dan 5 keyword untuk:" },
  { id: "caption", title: "Caption", blurb: "IG + hashtag", prompt: "Buat 5 caption Instagram + hashtag untuk:" },
  { id: "email", title: "Email", blurb: "Formal", prompt: "Tulis email profesional untuk:" },
  { id: "wa", title: "Pesan WA", blurb: "Template", prompt: "Buat template WhatsApp sopan untuk:" },
  { id: "landing", title: "Landing", blurb: "Hero + CTA", prompt: "Buat landing page HTML elegan." },
  { id: "python", title: "Python", blurb: "Script", prompt: "Tulis script Python lengkap + cara jalankan:" },
  { id: "js", title: "JavaScript", blurb: "Fungsi", prompt: "Tulis fungsi JavaScript + contoh:" },
  { id: "ide", title: "Brainstorm", blurb: "10 ide", prompt: "Berikan 10 ide praktis untuk:" },
  { id: "ringkas", title: "Ringkas", blurb: "Inti teks", prompt: "Ringkas teks ini jadi poin penting:" },
  { id: "faq", title: "FAQ", blurb: "8 tanya-jawab", prompt: "Buat 8 FAQ dan jawaban untuk:" },
  { id: "checklist", title: "Checklist", blurb: "Daftar cek", prompt: "Buat checklist lengkap untuk:" },
  { id: "harga", title: "Harga jual", blurb: "Margin", prompt: "Bantu tentukan harga jual + margin untuk:" },
  { id: "promo", title: "Promo", blurb: "5 ide", prompt: "Buat 5 ide promo toko untuk:" },
  { id: "portfolio", title: "Portfolio", blurb: "Halaman profil", prompt: "Buat halaman portfolio HTML satu file." },
  { id: "game", title: "Mini game", blurb: "HTML game", prompt: "Buat mini game HTML satu file bertema:" },
  { id: "error", title: "Jelaskan error", blurb: "Arti + fix", prompt: "Jelaskan error ini dan cara perbaiki:\n" },
  { id: "readme", title: "README", blurb: "Docs", prompt: "Tulis README markdown untuk proyek:" },
  { id: "slogan", title: "Slogan", blurb: "Tagline", prompt: "Buat 10 slogan untuk:" },
  { id: "rencana", title: "Rencana", blurb: "Langkah", prompt: "Buatkan rencana langkah praktis untuk:" },
  { id: "math", title: "Matematika", blurb: "Hitung", prompt: "Selesaikan soal ini langkah demi langkah:" },
  { id: "apaaja", title: "Apa saja", blurb: "Bebas", prompt: "Saya butuh bantuan untuk:" },
] as const;

/** Hanya 5 yang tampil di beranda (bukan popup penuh) */
export const HOME_TOOLS = QUICK_ACTIONS.slice(0, 5);
