export type ChatRole = "user" | "assistant";

export type StudioMode = "chat" | "image";

/** V1 = Gemini, V2 = Groq */
export type ImageVersion = "1" | "2";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  imageUrl?: string;
  error?: string;
  pathway?: string;
};

export type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
};

export type Artifact = {
  id: string;
  lang: string;
  code: string;
  filename: string;
  runnable: boolean;
  closed: boolean;
};

export type ActiveArtifact = {
  conversationId: string;
  messageId: string;
  artifactId: string;
  lang: string;
  code: string;
  filename: string;
};

export const STARTERS = [
  {
    title: "Restoran laut",
    blurb: "Halaman HTML lengkap, siap dijalankan.",
    prompt:
      "Buatkan halaman HTML lengkap, elegan, bertema restoran seafood pesisir. Sertakan hero, menu singkat, dan tombol reservasi. CSS di dalam file yang sama, tanpa dependensi.",
  },
  {
    title: "Format rupiah",
    blurb: "Fungsi JavaScript plus contoh di konsol.",
    prompt:
      "Tulis fungsi JavaScript formatRupiah(angka) yang rapi, plus 4 contoh console.log. Kode harus bisa dijalankan langsung.",
  },
  {
    title: "Pasang surut",
    blurb: "Penjelasan singkat dengan analogi yang jelas.",
    prompt:
      "Jelaskan cara kerja pasang surut laut dengan analogi yang mudah dipahami, lalu beri 3 fakta yang sering disalahpahami.",
  },
  {
    title: "Game mutiara",
    blurb: "Mini game HTML satu file, keyboard dan sentuh.",
    prompt:
      "Buat mini game HTML satu file: pemain mengumpulkan mutiara dan menghindari arus. Keyboard dan sentuh. Tampilkan skor. Tanpa library eksternal.",
  },
] as const;

export const BLANK_HTML = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Samudra</title>
  <style>
    :root { color-scheme: light; }
    html, body {
      margin: 0;
      min-height: 100%;
      font: 16px/1.5 Figtree, system-ui, sans-serif;
      background: #f4f9ff;
      color: #0f2744;
    }
    main {
      min-height: 100dvh;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    h1 { font-weight: 500; letter-spacing: -0.03em; }
    p { color: #5a7a9a; max-width: 28ch; }
  </style>
</head>
<body>
  <main>
    <div>
      <h1>Ruang kerja</h1>
      <p>Sunting kode di panel, lalu tekan jalankan.</p>
    </div>
  </main>
</body>
</html>
`;
