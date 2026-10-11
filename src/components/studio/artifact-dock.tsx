import { Download, Play, RefreshCw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/studio/icon-actions";
import { downloadText, mimeForFilename } from "@/lib/studio/files";
import { toRunnableDocument } from "@/lib/studio/run";
import { isRunnable } from "@/lib/studio/parse";
import type { ActiveArtifact } from "@/lib/studio/types";
import { cn } from "@/lib/utils";

export function ArtifactDock({
  artifact,
  onClose,
  onCode,
  className,
}: {
  artifact: ActiveArtifact;
  onClose: () => void;
  onCode: (code: string) => void;
  className?: string;
}) {
  const [tab, setTab] = useState<"run" | "code">(artifact.lang ? "run" : "code");
  const [frameKey, setFrameKey] = useState(0);
  const runnable = isRunnable(artifact.lang);

  const srcDoc = useMemo(
    () => (runnable ? toRunnableDocument(artifact.lang, artifact.code) : ""),
    [artifact.code, artifact.lang, runnable],
  );

  return (
    <section
      className={cn("flex h-full min-h-0 flex-col bg-depth/90", className)}
      aria-label="Ruang kerja"
    >
      <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-foam">{artifact.filename}</p>
          <p className="font-mono text-[11px] uppercase tracking-wide text-mist">{artifact.lang || "teks"}</p>
        </div>
        {runnable ? (
          <Button
            size="iconSm"
            aria-label="Jalankan ulang"
            onClick={() => {
              setTab("run");
              setFrameKey((value) => value + 1);
            }}
          >
            {tab === "run" ? <RefreshCw /> : <Play className="ml-px" />}
          </Button>
        ) : null}
        <CopyButton text={artifact.code} />
        <Button
          size="iconSm"
          aria-label="Unduh berkas"
          onClick={() => {
            downloadText(artifact.filename, artifact.code, mimeForFilename(artifact.filename));
            toast.success(`Mengunduh ${artifact.filename}`);
          }}
        >
          <Download />
        </Button>
        <Button size="iconSm" aria-label="Tutup ruang kerja" onClick={onClose}>
          <X />
        </Button>
      </header>

      <div className="flex gap-1 px-3 pt-2">
        {runnable ? (
          <TabChip active={tab === "run"} onClick={() => setTab("run")} label="Jalankan" />
        ) : null}
        <TabChip active={tab === "code" || !runnable} onClick={() => setTab("code")} label="Kode" />
      </div>

      <div className="min-h-0 flex-1 p-3 pt-2">
        {tab === "run" && runnable ? (
          <iframe
            key={frameKey}
            title={`Pratinjau ${artifact.filename}`}
            className="h-full w-full rounded-xl bg-abyss shadow-[var(--shadow-border)]"
            sandbox="allow-scripts allow-modals allow-forms"
            srcDoc={srcDoc}
          />
        ) : (
          <textarea
            value={artifact.code}
            onChange={(event) => onCode(event.target.value)}
            spellCheck={false}
            className="h-full w-full resize-none rounded-xl bg-abyss p-3 font-mono text-[12.5px] leading-relaxed text-foam shadow-[var(--shadow-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
            aria-label="Sunting kode"
          />
        )}
      </div>
    </section>
  );
}

function TabChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-lg px-3 text-xs font-medium transition-colors duration-150",
        active ? "bg-tide text-foam" : "text-mist hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}
