import type { Artifact } from "./types";

const RUNNABLE = new Set(["html", "htm", "svg", "css", "js", "javascript"]);

export type MessagePart =
  | { type: "text"; text: string }
  | { type: "code"; lang: string; code: string; closed: boolean };

export function normalizeLang(raw: string) {
  const lang = raw.trim().toLowerCase().split(/[\s{]/)[0] ?? "";
  if (lang === "htm") return "html";
  if (lang === "javascript") return "js";
  return lang;
}

export function isRunnable(lang: string) {
  return RUNNABLE.has(normalizeLang(lang));
}

export function guessFilename(lang: string, index: number) {
  const map: Record<string, string> = {
    html: "index.html",
    htm: "index.html",
    svg: "mark.svg",
    css: "styles.css",
    js: "script.js",
    javascript: "script.js",
    ts: "script.ts",
    tsx: "component.tsx",
    jsx: "component.jsx",
    json: "data.json",
    py: "main.py",
    python: "main.py",
    md: "note.md",
    markdown: "note.md",
    txt: "note.txt",
    sh: "run.sh",
    bash: "run.sh",
  };
  const key = normalizeLang(lang);
  if (map[key]) {
    if (index === 0) return map[key];
    const [name, ext] = map[key].split(".");
    return `${name}-${index + 1}.${ext}`;
  }
  return `file-${index + 1}${key ? `.${key}` : ".txt"}`;
}

export function splitFences(input: string): MessagePart[] {
  const parts: MessagePart[] = [];
  const src = input;
  let cursor = 0;

  while (cursor < src.length) {
    const open = src.indexOf("```", cursor);
    if (open === -1) {
      const rest = src.slice(cursor);
      if (rest) parts.push({ type: "text", text: rest });
      break;
    }
    if (open > cursor) {
      parts.push({ type: "text", text: src.slice(cursor, open) });
    }
    const afterOpen = open + 3;
    const nl = src.indexOf("\n", afterOpen);
    if (nl === -1) {
      const lang = normalizeLang(src.slice(afterOpen));
      parts.push({ type: "code", lang, code: "", closed: false });
      break;
    }
    const lang = normalizeLang(src.slice(afterOpen, nl));
    const close = src.indexOf("```", nl + 1);
    if (close === -1) {
      parts.push({
        type: "code",
        lang,
        code: src.slice(nl + 1),
        closed: false,
      });
      break;
    }
    parts.push({
      type: "code",
      lang,
      code: src.slice(nl + 1, close).replace(/\n$/, ""),
      closed: true,
    });
    cursor = close + 3;
    if (src[cursor] === "\n") cursor += 1;
  }

  return parts.filter((part) =>
    part.type === "text" ? part.text.trim().length > 0 : true,
  );
}

export function extractArtifacts(content: string, messageId: string): Artifact[] {
  return splitFences(content)
    .filter((part): part is Extract<MessagePart, { type: "code" }> => part.type === "code")
    .map((part, index) => ({
      id: `${messageId}:${index}`,
      lang: part.lang || "txt",
      code: part.code,
      filename: guessFilename(part.lang, index),
      runnable: isRunnable(part.lang) && part.code.trim().length > 0,
      closed: part.closed,
    }));
}

export function titleFromPrompt(prompt: string) {
  const clean = prompt.replace(/\s+/g, " ").trim();
  if (!clean) return "Percakapan baru";
  return clean.length > 42 ? `${clean.slice(0, 42).trim()}…` : clean;
}
