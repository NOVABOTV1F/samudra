import { Download, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/tooltip";
import { WaveMark } from "@/components/studio/wave-mark";
import { conversationToMarkdown, downloadText } from "@/lib/studio/files";
import type { Conversation } from "@/lib/studio/types";
import { cn } from "@/lib/utils";

export function Sidebar({
  conversations,
  activeId,
  onNew,
  onSelect,
  onDelete,
  className,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex h-full flex-col bg-depth/80", className)}>
      <div className="flex items-center gap-2 px-4 pt-5 pb-4">
        <WaveMark className="size-8" />
        <div className="min-w-0">
          <p className="font-display text-lg leading-tight tracking-tight text-foam">Samudra</p>
          <p className="text-[11px] text-mist">Studio AI</p>
        </div>
      </div>

      <div className="px-3">
        <Button variant="primary" className="w-full" onClick={onNew}>
          <Plus />
          Percakapan baru
        </Button>
      </div>

      <nav className="mt-4 min-h-0 flex-1 overflow-y-auto px-2 pb-3" aria-label="Riwayat percakapan">
        {conversations.length === 0 ? (
          <p className="px-3 py-6 text-sm text-mist">Belum ada riwayat. Mulai dari ombak pertama.</p>
        ) : (
          <ul className="space-y-1">
            {conversations.map((chat) => {
              const active = chat.id === activeId;
              return (
                <li key={chat.id}>
                  <div
                    className={cn(
                      "group flex items-center gap-1 rounded-xl px-1",
                      active ? "bg-tide" : "hover:bg-tide/60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(chat.id)}
                      className="min-w-0 flex-1 rounded-xl px-3 py-2.5 text-left text-sm text-ink"
                    >
                      <span className="block truncate">{chat.title}</span>
                    </button>
                    <Hint label="Unduh markdown">
                      <Button
                        size="iconSm"
                        className="opacity-100 md:opacity-0 md:group-hover:opacity-100"
                        aria-label="Unduh percakapan"
                        onClick={() => {
                          downloadText(
                            `${slug(chat.title)}.md`,
                            conversationToMarkdown(chat),
                            "text/markdown;charset=utf-8",
                          );
                          toast.success("Percakapan diunduh");
                        }}
                      >
                        <Download />
                      </Button>
                    </Hint>
                    <Hint label="Hapus">
                      <Button
                        size="iconSm"
                        variant="danger"
                        className="opacity-100 md:opacity-0 md:group-hover:opacity-100"
                        aria-label="Hapus percakapan"
                        onClick={() => onDelete(chat.id)}
                      >
                        <Trash2 />
                      </Button>
                    </Hint>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <p className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-[11px] leading-relaxed text-mist">
        Model Grok. Riwayat tersimpan di perangkat ini.
      </p>
    </div>
  );
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "samudra";
}
