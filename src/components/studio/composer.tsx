import { ImageIcon, Send, Square, Type } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Hint } from "@/components/ui/tooltip";
import type { StudioMode } from "@/lib/studio/types";
import { cn } from "@/lib/utils";

const MAX = 24000;

export function Composer({
  value,
  onChange,
  mode,
  onMode,
  busy,
  onSend,
  onStop,
}: {
  value: string;
  onChange: (value: string) => void;
  mode: StudioMode;
  onMode: (mode: StudioMode) => void;
  busy: boolean;
  onSend: () => void;
  onStop: () => void;
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

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:px-4">
      <div className="rounded-2xl bg-tide/90 p-2 shadow-[var(--shadow-border)]">
        <Textarea
          ref={ref}
          rows={1}
          value={value}
          maxLength={MAX}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            mode === "image"
              ? "Deskripsikan gambar yang ingin dibuat…"
              : "Tanya otak lokal, tempel HTML, atau minta halaman…"
          }
          aria-label={mode === "image" ? "Deskripsi gambar" : "Pesan"}
          className="min-h-12 max-h-52 px-3 py-2.5"
        />
        <div className="flex items-center gap-1 px-1 pb-0.5">
          <div className="flex rounded-xl bg-depth p-1">
            <ModeChip active={mode === "chat"} onClick={() => onMode("chat")} icon={<Type className="size-3.5" />} label="Teks" />
            <ModeChip
              active={mode === "image"}
              onClick={() => onMode("image")}
              icon={<ImageIcon className="size-3.5" />}
              label="Gambar"
            />
          </div>
          <span className="ml-auto pr-2 font-mono text-[11px] tabular-nums text-mist">
            {value.length}/{MAX}
          </span>
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

function ModeChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors duration-150",
        active ? "bg-tide text-foam" : "text-mist hover:text-ink",
      )}
      aria-pressed={active}
    >
      {icon}
      {label}
    </button>
  );
}
