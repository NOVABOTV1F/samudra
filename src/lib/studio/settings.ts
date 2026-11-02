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

export const APP_VERSION = "1.6.3";

const KEY = "samudra-settings-v1";

export const DEFAULT_SETTINGS: UserSettings = {
  systemPrompt: `Kamu adalah ZUZUXF_AI / Otak Samudra v1.6.3 — asisten serba bisa.
Bisa: coding, website, debug, menulis, belajar, analisis, bisnis, terjemah, math, SEO, toko, Roblox info umum — legal & aman.
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

export const ADMIN_TRIGGER = "/SAMUDRA.PANEL";
export const ADMIN_USER = "ZUZUXF";
export const ADMIN_KEY = "DEV=ZUZUXF_AI=™X10WDEV";
export const ADMIN_KEY_ALIASES = [
  ADMIN_KEY,
  "DEV=SAMUDRA=™X10WDEV",
  "DEV=ZUZUXF_AI=X10WDEV",
];

/** 60+ quick tools — tiap item = prompt siap kirim ke AI */
export const QUICK_ACTIONS = [
  { id: "coding", title: "Coding", blurb: "Kode siap jalan", prompt: "Bantu coding lengkap, rapi, bisa dijalankan. Topik:" },
  { id: "website", title: "Website", blurb: "HTML satu file", prompt: "Buat website HTML satu file lengkap, responsif, modern." },
  { id: "debug", title: "Debug", blurb: "Perbaiki error", prompt: "Debug kode ini: temukan error, perbaiki. Kode:\n" },
  { id: "toko", title: "Toko online", blurb: "Produk + WA", prompt: "Buat halaman toko online HTML: produk, harga, tombol WhatsApp." },
  { id: "landing", title: "Landing page", blurb: "Hero + CTA", prompt: "Buat landing page HTML elegan: hero, fitur, CTA, footer." },
  { id: "form", title: "Form HTML", blurb: "Form kontak", prompt: "Buat form HTML + CSS validasi sederhana, siap pakai." },
  { id: "css", title: "CSS rapi", blurb: "Layout modern", prompt: "Tulis CSS modern (flex/grid) untuk layout:" },
  { id: "js", title: "JavaScript", blurb: "Fungsi & contoh", prompt: "Tulis fungsi JavaScript + contoh pemakaian:" },
  { id: "python", title: "Python", blurb: "Script praktis", prompt: "Tulis script Python lengkap + cara jalankan:" },
  { id: "api", title: "API fetch", blurb: "Contoh fetch", prompt: "Buat contoh fetch API JavaScript + error handling untuk:" },
  { id: "regex", title: "Regex", blurb: "Pola teks", prompt: "Buatkan regex + penjelasan untuk:" },
  { id: "sql", title: "SQL", blurb: "Query contoh", prompt: "Tulis query SQL praktis untuk:" },
  { id: "json", title: "JSON", blurb: "Struktur data", prompt: "Buat contoh JSON rapi untuk:" },
  { id: "belajar", title: "Belajar", blurb: "Langkah + soal", prompt: "Jelaskan untuk pemula, langkah demi langkah + 3 soal:" },
  { id: "menulis", title: "Menulis", blurb: "Teks siap pakai", prompt: "Tulis teks siap pakai. Kebutuhan:" },
  { id: "caption", title: "Caption IG", blurb: "+ hashtag", prompt: "Buat 5 caption Instagram menarik + hashtag untuk:" },
  { id: "email", title: "Email", blurb: "Formal/santai", prompt: "Tulis email profesional untuk:" },
  { id: "wa", title: "Pesan WA", blurb: "Template chat", prompt: "Buat template pesan WhatsApp sopan untuk:" },
  { id: "proposal", title: "Proposal", blurb: "Ringkas", prompt: "Tulis proposal singkat struktur lengkap untuk:" },
  { id: "cv", title: "CV / biodata", blurb: "Poin kuat", prompt: "Bantu susun poin CV / biodata untuk:" },
  { id: "bisnis", title: "Bisnis", blurb: "Strategi", prompt: "Strategi bisnis praktis. Konteks:" },
  { id: "harga", title: "Harga jual", blurb: "Hitung margin", prompt: "Bantu tentukan harga jual + margin untuk produk:" },
  { id: "promo", title: "Promo", blurb: "Ide diskon", prompt: "Buat 5 ide promo toko untuk:" },
  { id: "nama-usaha", title: "Nama usaha", blurb: "10 ide", prompt: "Berikan 10 ide nama usaha untuk:" },
  { id: "analisis", title: "Analisis", blurb: "Pro-kontra", prompt: "Analisis terstruktur: pro-kontra, risiko, rekomendasi:" },
  { id: "banding", title: "Bandingkan", blurb: "A vs B", prompt: "Bandingkan opsi berikut secara adil:" },
  { id: "rencana", title: "Rencana", blurb: "To-do harian", prompt: "Buatkan rencana langkah praktis untuk:" },
  { id: "ide", title: "Brainstorm", blurb: "10 ide", prompt: "Berikan 10 ide kreatif dan praktis untuk:" },
  { id: "terjemah", title: "Terjemah", blurb: "ID ↔ EN", prompt: "Terjemahkan teks berikut dengan natural:" },
  { id: "ringkas", title: "Ringkas", blurb: "Inti teks", prompt: "Ringkas teks ini jadi poin penting:" },
  { id: "perbaiki-tulisan", title: "Perbaiki tulisan", blurb: "Ejaan & gaya", prompt: "Perbaiki ejaan, tata bahasa, dan gaya teks ini:" },
  { id: "seo", title: "SEO teks", blurb: "Judul + meta", prompt: "Buatkan judul SEO, meta description, dan 5 keyword untuk:" },
  { id: "blog", title: "Artikel blog", blurb: "Outline + draf", prompt: "Buat outline + draf artikel blog tentang:" },
  { id: "faq", title: "FAQ", blurb: "Tanya jawab", prompt: "Buat 8 FAQ dan jawaban untuk:" },
  { id: "math", title: "Matematika", blurb: "Hitung + langkah", prompt: "Selesaikan soal matematika ini langkah demi langkah:" },
  { id: "konversi", title: "Konversi", blurb: "Satuan / format", prompt: "Bantu konversi / hitung:" },
  { id: "tanggal", title: "Jadwal", blurb: "Timeline", prompt: "Buatkan timeline / jadwal realistis untuk:" },
  { id: "checklist", title: "Checklist", blurb: "Daftar cek", prompt: "Buat checklist lengkap untuk:" },
  { id: "sop", title: "SOP singkat", blurb: "Prosedur kerja", prompt: "Tulis SOP singkat langkah demi langkah untuk:" },
  { id: "interview", title: "Latihan interview", blurb: "Q&A", prompt: "Buat 8 pertanyaan interview + jawaban contoh untuk posisi:" },
  { id: "presentasi", title: "Presentasi", blurb: "Outline slide", prompt: "Buat outline slide presentasi untuk:" },
  { id: "skrip-video", title: "Skrip video", blurb: "30–60 dtk", prompt: "Tulis skrip video pendek (30–60 detik) tentang:" },
  { id: "game-html", title: "Mini game", blurb: "HTML game", prompt: "Buat mini game HTML satu file (keyboard/sentuh) bertema:" },
  { id: "quiz", title: "Kuis HTML", blurb: "Soal interaktif", prompt: "Buat kuis HTML interaktif satu file tentang:" },
  { id: "portfolio", title: "Portfolio", blurb: "Halaman profil", prompt: "Buat halaman portfolio HTML satu file untuk:" },
  { id: "dashboard", title: "Dashboard UI", blurb: "Mock UI", prompt: "Buat mock dashboard HTML/CSS rapi untuk:" },
  { id: "login-ui", title: "UI Login", blurb: "Form cantik", prompt: "Buat halaman login HTML/CSS modern (UI saja)." },
  { id: "kartu", title: "Kartu produk", blurb: "Card UI", prompt: "Buat card produk HTML/CSS menarik untuk:" },
  { id: "tabel", title: "Tabel data", blurb: "HTML table", prompt: "Buat tabel HTML rapi + CSS untuk data:" },
  { id: "chart-text", title: "Bagan teks", blurb: "ASCII/markdown", prompt: "Buat ringkasan data dalam tabel markdown untuk:" },
  { id: "roblox", title: "Roblox tips", blurb: "Info umum", prompt: "Berikan tips umum (non-cheat) seputar Roblox untuk:" },
  { id: "nama-produk", title: "Nama produk", blurb: "10 ide", prompt: "Berikan 10 ide nama produk untuk:" },
  { id: "slogan", title: "Slogan", blurb: "Tagline", prompt: "Buat 10 slogan / tagline untuk:" },
  { id: "review", title: "Review produk", blurb: "Jujur & rapi", prompt: "Tulis review produk yang seimbang untuk:" },
  { id: "komplain", title: "Surat komplain", blurb: "Sopan tegas", prompt: "Tulis pesan komplain sopan tapi tegas tentang:" },
  { id: "ucapan", title: "Ucapan", blurb: "Selamat / terima kasih", prompt: "Tulis ucapan yang hangat untuk:" },
  { id: "cerita", title: "Cerita pendek", blurb: "Fiksi singkat", prompt: "Tulis cerita pendek menarik tentang:" },
  { id: "puisi", title: "Puisi", blurb: "Pendek", prompt: "Tulis puisi singkat tentang:" },
  { id: "ide-konten", title: "Ide konten", blurb: "30 hari", prompt: "Buat kalender 30 ide konten untuk:" },
  { id: "hashtag", title: "Hashtag", blurb: "Set lengkap", prompt: "Buatkan set hashtag (grup) untuk:" },
  { id: "password-tips", title: "Keamanan", blurb: "Tips aman", prompt: "Berikan tips keamanan praktis (bukan hacking) untuk:" },
  { id: "error-explain", title: "Jelaskan error", blurb: "Arti pesan", prompt: "Jelaskan arti error ini dan cara perbaiki:\n" },
  { id: "refactor", title: "Refactor", blurb: "Kode lebih rapi", prompt: "Refactor kode ini agar lebih bersih tanpa ubah perilaku:\n" },
  { id: "test-case", title: "Test case", blurb: "Daftar uji", prompt: "Buat daftar test case untuk fitur:" },
  { id: "readme", title: "README", blurb: "Dokumentasi", prompt: "Tulis README markdown untuk proyek:" },
  { id: "apaaja", title: "Apa saja", blurb: "Full power", prompt: "Saya butuh bantuan untuk:" },
] as const;
