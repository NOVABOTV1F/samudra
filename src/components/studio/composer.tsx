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
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
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
    <div className="mx-auto w-full max-w-2xl px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      {statusLine ? (
        <p className="mb-1.5 px-1 text-[11px] text-mist">{statusLine}</p>
      ) : null}
      <div className="rounded-2xl border border-border bg-tide p-2 shadow-sm">
        <Textarea
          ref={ref}
          rows={1}
          value={value}
          maxLength={MAX}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Tulis pesan…"
          aria-label="Pesan"
          className="min-h-11 max-h-44 border-0 bg-transparent px-3 py-2.5 shadow-none"
        />
        <div className="flex items-center gap-1 px-1">
          <div className="flex rounded-lg bg-depth p-0.5">
            {(
              [
                ["1", "V1"],
                ["2", "V2"],
                ["3", "V3"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => onAiVersion(id)}
                className={cn(
                  "h-8 rounded-md px-2.5 text-xs font-medium",
                  aiVersion === id ? "bg-accent text-white" : "text-mist",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="ml-1 font-mono text-[10px] text-mist/60">{left.toLocaleString("id-ID")}</span>
          <span className="ml-auto" />
          {busy ? (
            <Hint label="Stop">
              <Button variant="quiet" size="icon" aria-label="Stop" onClick={onStop}>
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
