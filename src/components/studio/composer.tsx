import { ImageIcon, Mic, Paperclip, Send, Square, Type } from "lucide-react";
import { useEffect, useRef, type ChangeEvent, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Hint } from "@/components/ui/tooltip";
import type { ImageVersion, StudioMode } from "@/lib/studio/types";
import { cn } from "@/lib/utils";

const MAX = 8000;

export function Composer({
  value,
  onChange,
  mode,
  onMode,
  aiVersion,
  onAiVersion,
  busy,
  onSend,
  onStop,
  onFile,
}: {
  value: string;
  onChange: (value: string) => void;
  mode: StudioMode;
  onMode: (mode: StudioMode) => void;
  aiVersion: ImageVersion;
  onAiVersion: (v: ImageVersion) => void;
  busy: boolean;
  onSend: () => void;
  onStop: () => void;
  onFile?: (file: File) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

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

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && onFile) onFile(file);
    e.target.value = "";
  }

  function startVoice() {
    const SR =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognition; webkitSpeechRecognition?: new () => SpeechRecognition })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "id-ID";
    rec.interimResults = false;
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      const text = ev.results[0]?.[0]?.transcript ?? "";
      if (text) onChange(value ? `${value} ${text}` : text);
    };
    rec.onerror = () => {
      recognitionRef.current = null;
    };
    rec.onend = () => {
      recognitionRef.current = null;
    };
    recognitionRef.current = rec;
    rec.start();
  }

  const canSend = value.trim().length > 0 && !busy && value.length <= MAX;

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:px-4">
      <p className="mb-1.5 px-1 text-[11px] text-mist">
        V1 = Lebih lengkap &amp; teliti · V2 = Lebih cepat menjawab
      </p>
      <div className="rounded-2xl bg-tide/90 p-2 shadow-[var(--shadow-border)]">
        <Textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            mode === "image"
              ? "Deskripsikan gambar… atau ketik: buat gambar: kucing"
              : "Tanya apa saja…"
          }
          aria-label={mode === "image" ? "Deskripsi gambar" : "Pesan"}
          className="min-h-12 max-h-52 px-3 py-2.5"
        />
        <div className="flex flex-wrap items-center gap-1 px-1 pb-0.5">
          <div className="flex rounded-xl bg-depth p-1">
            <ModeChip active={mode === "chat"} onClick={() => onMode("chat")} icon={<Type className="size-3.5" />} label="Teks" />
            <ModeChip
              active={mode === "image"}
              onClick={() => onMode("image")}
              icon={<ImageIcon className="size-3.5" />}
              label="Gambar"
            />
          </div>

          <div className="flex rounded-xl bg-depth p-1">
            <ModeChip active={aiVersion === "1"} onClick={() => onAiVersion("1")} icon={null} label="V1" />
            <ModeChip active={aiVersion === "2"} onClick={() => onAiVersion("2")} icon={null} label="V2" />
          </div>

          {onFile ? (
            <>
              <input ref={fileRef} type="file" accept="image/*,.txt,.md,.html,.js,.css,.json" className="hidden" onChange={handleFile} />
              <Hint label="Kirim foto / file">
                <Button variant="quiet" size="icon" aria-label="Lampirkan file" onClick={() => fileRef.current?.click()}>
                  <Paperclip className="size-4" />
                </Button>
              </Hint>
            </>
          ) : null}

          <Hint label="Ketik pakai suara">
            <Button variant="quiet" size="icon" aria-label="Mikrofon" onClick={startVoice}>
              <Mic className="size-4" />
            </Button>
          </Hint>

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
        active ? "bg-accent/25 text-foam ring-1 ring-accent/40" : "text-mist hover:text-ink",
      )}
      aria-pressed={active}
    >
      {icon}
      {label}
    </button>
  );
}

// Minimal SpeechRecognition types for browsers that support it
type SpeechRecognition = {
  lang: string;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionEvent = {
  results: { [index: number]: { [index: number]: { transcript: string } } };
};
