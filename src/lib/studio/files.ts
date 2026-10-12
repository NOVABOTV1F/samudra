import type { Conversation } from "./types";

export function downloadText(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadDataUrl(filename: string, dataUrl: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}

export function conversationToMarkdown(conversation: Conversation) {
  const body = conversation.messages
    .map((message) => {
      const who = message.role === "user" ? "Kamu" : "ZUZUXF_AI";
      const image = message.imageUrl ? `![gambar](${message.imageUrl})\n\n` : "";
      const file = message.fileName ? `*(file: ${message.fileName})*\n\n` : "";
      return `## ${who}\n\n${image}${file}${message.content}`.trim();
    })
    .join("\n\n---\n\n");
  return `# ${conversation.title}\n\n${body}\n`;
}

export function mimeForFilename(filename: string) {
  if (filename.endsWith(".html")) return "text/html;charset=utf-8";
  if (filename.endsWith(".css")) return "text/css;charset=utf-8";
  if (filename.endsWith(".js")) return "text/javascript;charset=utf-8";
  if (filename.endsWith(".json")) return "application/json;charset=utf-8";
  if (filename.endsWith(".svg")) return "image/svg+xml;charset=utf-8";
  if (filename.endsWith(".md")) return "text/markdown;charset=utf-8";
  return "text/plain;charset=utf-8";
}
