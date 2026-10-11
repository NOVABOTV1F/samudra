import { Check, Copy, Download, Play } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { copyText, downloadText, mimeForFilename } from "@/lib/studio/files";
import { cn } from "@/lib/utils";

export function CopyButton({
  text,
  label = "Salin",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);

  return (
    <Hint label={done ? "Tersalin" : label}>
      <Button
        size="iconSm"
        className={cn("text-mist", className)}
        aria-label={label}
        onClick={async () => {
          await copyText(text);
          setDone(true);
          toast.success("Disalin");
          window.setTimeout(() => setDone(false), 1400);
        }}
      >
        <span className="relative grid size-4 place-items-center">
          <Copy
            className={cn(
              "absolute transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
              done ? "scale-[0.25] opacity-0 blur-[4px]" : "scale-100 opacity-100 blur-none",
            )}
          />
          <Check
            className={cn(
              "absolute text-ok transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
              done ? "scale-100 opacity-100 blur-none" : "scale-[0.25] opacity-0 blur-[4px]",
            )}
          />
        </span>
      </Button>
    </Hint>
  );
}

export function DownloadButton({
  filename,
  content,
  className,
}: {
  filename: string;
  content: string;
  className?: string;
}) {
  return (
    <Hint label="Unduh">
      <Button
        size="iconSm"
        className={cn("text-mist", className)}
        aria-label="Unduh"
        onClick={() => {
          downloadText(filename, content, mimeForFilename(filename));
          toast.success(`Mengunduh ${filename}`);
        }}
      >
        <Download />
      </Button>
    </Hint>
  );
}

export function RunButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <Hint label="Jalankan">
      <Button
        size="iconSm"
        variant="quiet"
        className={cn("text-accent", className)}
        aria-label="Jalankan"
        onClick={onClick}
      >
        <Play className="ml-px" />
      </Button>
    </Hint>
  );
}
