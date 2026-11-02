import { Send, Square } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Hint } from "@/components/ui/tooltip";
import type { ImageVersion } from "@/lib/studio/types";
import { cn } from "@/lib/utils";

const MAX = 24000;

export function Composer({
  value,
  onChange,
  aiVersion,
  onAiVersion,
  busy,
  onSend,
  onStop,
  statusLine,
}: {
  value: string;
  onChange: (value: string) => void;
  aiVersion: ImageVersion;
  onAiVersion: (v: ImageVersion) => void;
  busy: boolean;
  onSend: () => void;
  onStop: () => void;
  statusLine?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!busy) onSend();
    }
  }

  const canSend = value.trim().length > 0 && !busy;
  const left = MAX - value.length;

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:px-4">
      <p className="mb-1.5 px-1 text-[11px] leading-snug text-mist">
        {statusLine ||
          "V1 = DeepSeek Pro · V2 = Groq · AI bisa coding, website, analisis, apa saja"}
      </p>
      <div className="rounded-2xl bg-tide/90 p-2 shadow-[var(--shadow-border)] ring-1 ring-border/60">
        <Textarea
          ref={ref}
          rows={1}
          value={value}
          maxLength={MAX}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Tanya apa saja… coding, bisnis, belajar, website…"
          aria-label="Pesan"
          className="min-h-12 max-h-52 px-3 py-2.5"
        />
        <div className="flex flex-wrap items-center gap-1 px-1 pb-0.5">
          <div className="flex rounded-xl bg-depth p-1">
            <button
              type="button"
              onClick={() => onAiVersion("1")}
              className={cn(
                "inline-flex h-9 items-center rounded-lg px-3 text-xs font-medium transition-colors",
                aiVersion === "1" ? "bg-accent/25 text-foam ring-1 ring-accent/40" : "text-mist",
              )}
              aria-pressed={aiVersion === "1"}
              title="DeepSeek via FreeModel"
            >
              V1
            </button>
            <button
              type="button"
              onClick={() => onAiVersion("2")}
              className={cn(
                "inline-flex h-9 items-center rounded-lg px-3 text-xs font-medium transition-colors",
                aiVersion === "2" ? "bg-accent/25 text-foam ring-1 ring-accent/40" : "text-mist",
              )}
              aria-pressed={aiVersion === "2"}
              title="Groq cepat"
            >
              V2
            </button>
          </div>

          <span
            className={cn(
              "ml-1 font-mono text-[10px] tabular-nums",
              left < 500 ? "text-amber-600" : "text-mist/70",
            )}
            title="Sisa karakter"
          >
            {left.toLocaleString("id-ID")}
          </span>

          <span className="ml-auto" />

          {busy ? (
            <Hint label="Hentikan">
              <Button variant="quiet" size="icon" aria-label="Hentikan" onClick={onStop}>
                <Square className="fill-current" />
              </Button>
            </Hint>
          ) : (
            <Hint label="Kirim">
              <Button variant="primary" size="icon" aria-label="Kirim" disabled={!canSend} onClick={onSend}>
                <Send />
              </Button>
            </Hint>
          )}
        </div>
      </div>
    </div>
  );
}
