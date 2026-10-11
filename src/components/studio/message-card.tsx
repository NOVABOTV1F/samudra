import { useMemo } from "react";
import { WaveMark } from "@/components/studio/wave-mark";
import { MarkdownView } from "@/components/studio/markdown-view";
import { CopyButton, DownloadButton, RunButton } from "@/components/studio/icon-actions";
import { downloadDataUrl } from "@/lib/studio/files";
import { extractArtifacts, splitFences } from "@/lib/studio/parse";
import type { ActiveArtifact, ChatMessage } from "@/lib/studio/types";
import { cn } from "@/lib/utils";

export function MessageCard({
  message,
  conversationId,
  streaming,
  onRun,
}: {
  message: ChatMessage;
  conversationId: string;
  streaming?: boolean;
  onRun: (artifact: ActiveArtifact) => void;
}) {
  const parts = useMemo(() => splitFences(message.content), [message.content]);
  const artifacts = useMemo(
    () => extractArtifacts(message.content, message.id),
    [message.content, message.id],
  );
  const isUser = message.role === "user";
  let codeCursor = 0;

  return (
    <article className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg",
          isUser ? "bg-tide text-foam" : "bg-lagoon text-accent",
        )}
        aria-hidden="true"
      >
        {isUser ? (
          <span className="text-xs font-medium">K</span>
        ) : (
          <WaveMark className="size-5" />
        )}
      </div>

      <div className={cn("min-w-0 max-w-[min(100%,44rem)] flex-1", isUser && "flex flex-col items-end")}>
        {isUser ? (
          <div className="rounded-2xl rounded-tr-md bg-tide px-4 py-3 text-[0.9375rem] leading-relaxed text-ink">
            {message.content}
          </div>
        ) : (
          <div className="space-y-3">
            {message.error ? (
              <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{message.error}</p>
            ) : null}

            {message.imageUrl ? (
              <figure className="overflow-hidden rounded-2xl bg-tide shadow-[var(--shadow-border)]">
                <img
                  src={message.imageUrl}
                  alt={message.content || "Gambar dari Samudra"}
                  className="max-h-[28rem] w-full object-cover"
                />
                <figcaption className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="truncate text-xs text-mist">{message.content}</span>
                  <button
                    type="button"
                    className="h-9 rounded-lg px-3 text-xs text-mist hover:text-ink"
                    onClick={() => downloadDataUrl("samudra.png", message.imageUrl!)}
                  >
                    Unduh
                  </button>
                </figcaption>
              </figure>
            ) : null}

            {parts.map((part, index) => {
              if (part.type === "text") {
                return <MarkdownView key={`${message.id}-t-${index}`} text={part.text} />;
              }
              const artifact = artifacts[codeCursor];
              codeCursor += 1;
              return (
                <div
                  key={`${message.id}-c-${index}`}
                  className="overflow-hidden rounded-2xl bg-depth shadow-[var(--shadow-border)]"
                >
                  <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
                    <span className="font-mono text-[11px] uppercase tracking-wide text-mist">
                      {part.lang || "teks"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-mist/80">
                      {artifact?.filename}
                    </span>
                    {artifact?.runnable ? (
                      <RunButton
                        onClick={() =>
                          onRun({
                            conversationId,
                            messageId: message.id,
                            artifactId: artifact.id,
                            lang: artifact.lang,
                            code: artifact.code,
                            filename: artifact.filename,
                          })
                        }
                      />
                    ) : null}
                    <CopyButton text={part.code} />
                    {artifact ? (
                      <DownloadButton filename={artifact.filename} content={part.code} />
                    ) : null}
                  </div>
                  <pre className="max-h-[22rem] overflow-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed text-foam">
                    <code>{part.code}</code>
                  </pre>
                </div>
              );
            })}

            {streaming && !message.content && !message.imageUrl ? (
              <p className="tide-shimmer text-sm">Menyelam ke jawaban…</p>
            ) : null}
          </div>
        )}

        {!isUser && !streaming && message.content && !message.error ? (
          <div className="mt-2 flex justify-end">
            <CopyButton text={message.content} label="Salin jawaban" />
          </div>
        ) : null}
      </div>
    </article>
  );
}
