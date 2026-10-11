import { marked } from "marked";
import DOMPurify from "dompurify";
import { useMemo } from "react";

marked.setOptions({ gfm: true, breaks: true });

export function MarkdownView({ text }: { text: string }) {
  const html = useMemo(() => {
    if (!text.trim()) return "";
    const dirty = marked.parse(text, { async: false }) as string;
    if (typeof window === "undefined") return dirty;
    return DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } });
  }, [text]);

  if (!html) return null;
  return <div className="md-body" dangerouslySetInnerHTML={{ __html: html }} />;
}
