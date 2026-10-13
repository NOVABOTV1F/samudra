import * as Dialog from "@radix-ui/react-dialog";
import { Menu, PanelRight, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Toaster } from "sonner";
import { AdminPanel } from "@/components/studio/admin-panel";
import { ArtifactDock } from "@/components/studio/artifact-dock";
import { Composer } from "@/components/studio/composer";
import { MessageCard } from "@/components/studio/message-card";
import { OceanBackdrop } from "@/components/studio/ocean-backdrop";
import { SettingsButton } from "@/components/studio/settings-panel";
import { Sidebar } from "@/components/studio/sidebar";
import { WaveMark } from "@/components/studio/wave-mark";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { think, spillToFile } from "@/lib/brain/think";
import { streamChat } from "@/lib/studio/client";
import { downloadText } from "@/lib/studio/files";
import { extractArtifacts } from "@/lib/studio/parse";
import { ADMIN_TRIGGER, loadSettings } from "@/lib/studio/settings";
import { selectActiveChat, useStudioStore } from "@/lib/studio/store";
import {
  STARTERS,
  BLANK_HTML,
  type ActiveArtifact,
  type ImageVersion,
} from "@/lib/studio/types";
import { cn } from "@/lib/utils";

function wantsImage(text: string) {
  return /\b(gambar|image|foto|lukis|draw|buatkan\s+gambar|generate\s+image)\b/i.test(text);
}

export function StudioApp() {
  const hydrate = useStudioStore((state) => state.hydrate);
  const conversations = useStudioStore((state) => state.conversations);
  const activeId = useStudioStore((state) => state.activeId);
  const streamingId = useStudioStore((state) => state.streamingId);
  const artifact = useStudioStore((state) => state.artifact);
  const newChat = useStudioStore((state) => state.newChat);
  const setActive = useStudioStore((state) => state.setActive);
  const deleteChat = useStudioStore((state) => state.deleteChat);
  const addMessage = useStudioStore((state) => state.addMessage);
  const patchMessage = useStudioStore((state) => state.patchMessage);
  const setStreaming = useStudioStore((state) => state.setStreaming);
  const openArtifact = useStudioStore((state) => state.openArtifact);
  const closeArtifact = useStudioStore((state) => state.closeArtifact);
  const updateArtifactCode = useStudioStore((state) => state.updateArtifactCode);
  const chat = useStudioStore(selectActiveChat);

  const [draft, setDraft] = useState("");
  const [aiVersion, setAiVersion] = useState<ImageVersion>("2");
  const [navOpen, setNavOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [announce, setAnnounce] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hydrate();
    try {
      setAnnounce(localStorage.getItem("samudra-announce") ?? "");
      const s = loadSettings();
      if (s.preferProvider === "gemini") setAiVersion("1");
      if (s.preferProvider === "groq") setAiVersion("2");
    } catch {
      /* */
    }
  }, [hydrate]);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [chat?.messages, streamingId]);

  const busy = Boolean(streamingId);
  const empty = !chat || chat.messages.length === 0;

  function ensureChat() {
    if (activeId && chat) return activeId;
    return newChat();
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(null);
  }

  async function send(text = draft) {
    const prompt = text.trim();
    if (!prompt || busy) return;

    if (prompt === ADMIN_TRIGGER || prompt.toUpperCase() === "/SAMUDRA.PANEL") {
      setDraft("");
      setAdminOpen(true);
      return;
    }

    const conversationId = ensureChat();
    setDraft("");
    setNavOpen(false);

    addMessage(conversationId, { role: "user", content: prompt });
    const assistantId = addMessage(conversationId, { role: "assistant", content: "" });
    setStreaming(assistantId);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Gambar: deteksi otomatis → otak lokal SVG
      if (wantsImage(prompt)) {
        const drawn = think(prompt, "image");
        patchMessage(conversationId, assistantId, {
          content: drawn.text,
          pathway: drawn.pathway,
          imageUrl: drawn.imageUrl,
        });
        return;
      }

      const settings = loadSettings();
      const geminiKey = settings.geminiKey.trim();
      const groqKey = settings.groqKey.trim();
      const provider = aiVersion === "1" ? "gemini" : "groq";
      const hasCloudKey = provider === "gemini" ? Boolean(geminiKey) : Boolean(groqKey);

      // V1/V2 + key → API cloud
      if (hasCloudKey) {
        const history =
          useStudioStore
            .getState()
            .conversations.find((c) => c.id === conversationId)
            ?.messages.filter((m) => m.id !== assistantId && !m.error)
            .map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })) ?? [];

        const systemPrompt = [
          settings.systemPrompt,
          settings.personality ? `Gaya bahasa: ${settings.personality}.` : "",
        ]
          .filter(Boolean)
          .join("\n");

        let assembled = "";
        await streamChat({
          messages: history,
          signal: controller.signal,
          provider,
          geminiKey: geminiKey || undefined,
          groqKey: groqKey || undefined,
          systemPrompt,
          onDelta: (chunk) => {
            assembled += chunk;
            patchMessage(conversationId, assistantId, { content: assembled });
          },
        });

        const found = extractArtifacts(assembled, assistantId).filter((item) => item.runnable);
        const last = found.at(-1);
        if (last) {
          openArtifact({
            conversationId,
            messageId: assistantId,
            artifactId: last.id,
            lang: last.lang,
            code: last.code,
            filename: last.filename,
          });
          if (window.matchMedia("(min-width: 1024px)").matches) setDockOpen(true);
        }
        return;
      }

      // Tanpa key → otak lokal
      const reply = think(prompt, "chat");
      const spilled = spillToFile(reply.text);
      if (spilled) downloadText(spilled.filename, spilled.full, "text/markdown;charset=utf-8");
      const shown = spilled?.preview ?? reply.text;
      let assembled = "";
      const size = 180;
      for (let index = 0; index < shown.length; index += size) {
        if (controller.signal.aborted) return;
        assembled += shown.slice(index, index + size);
        patchMessage(conversationId, assistantId, { content: assembled, pathway: reply.pathway });
        await new Promise((resolve) => setTimeout(resolve, 12));
      }

      const found = extractArtifacts(assembled, assistantId).filter((item) => item.runnable);
      const last = found.at(-1);
      if (last) {
        openArtifact({
          conversationId,
          messageId: assistantId,
          artifactId: last.id,
          lang: last.lang,
          code: last.code,
          filename: last.filename,
        });
        if (window.matchMedia("(min-width: 1024px)").matches) setDockOpen(true);
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : "Terjadi kesalahan.";
      patchMessage(conversationId, assistantId, { error: message });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setStreaming(null);
    }
  }

  function handleRun(next: ActiveArtifact) {
    openArtifact(next);
    setDockOpen(true);
  }

  const mobileArtifact = useMemo(() => artifact, [artifact]);

  return (
    <TooltipProvider>
      <div className="relative flex h-dvh overflow-hidden bg-abyss text-ink">
        <OceanBackdrop />

        <aside className="relative z-10 hidden w-72 shrink-0 border-r border-border md:flex">
          <Sidebar
            conversations={conversations}
            activeId={activeId}
            onNew={() => {
              stop();
              newChat();
            }}
            onSelect={(id) => {
              stop();
              setActive(id);
            }}
            onDelete={deleteChat}
            className="w-full"
          />
        </aside>

        <div className="relative z-10 flex min-w-0 flex-1">
          <main className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-14 items-center gap-2 px-2 md:px-4">
              <Button
                size="icon"
                className="md:hidden"
                aria-label="Buka percakapan"
                onClick={() => setNavOpen(true)}
              >
                <Menu />
              </Button>
              <div className="flex min-w-0 items-center gap-2 md:hidden">
                <WaveMark className="size-6" />
                <span className="font-display text-base tracking-tight">Samudra</span>
              </div>
              <p className="hidden truncate text-sm text-mist md:block">
                {chat?.title ?? "Studio lautan"}
              </p>
              <span className="hidden rounded-full bg-tide px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-mist md:inline">
                {aiVersion === "1" ? "V1 Gemini" : "V2 Groq"}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <SettingsButton open={settingsOpen} onOpenChange={setSettingsOpen} />
                {artifact ? (
                  <Button
                    size="icon"
                    className="md:hidden"
                    aria-label="Buka ruang kerja"
                    onClick={() => setDockOpen(true)}
                  >
                    <PanelRight />
                  </Button>
                ) : null}
              </div>
            </header>

            {announce ? (
              <div className="mx-3 mb-1 rounded-xl bg-lagoon px-3 py-2 text-xs text-foam md:mx-4">
                {announce}
              </div>
            ) : null}

            <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto">
              {empty ? (
                <EmptyState
                  onPick={(prompt) => {
                    void send(prompt);
                  }}
                  onScratch={() => {
                    openArtifact({
                      conversationId: activeId ?? "scratch",
                      messageId: "scratch",
                      artifactId: "scratch",
                      lang: "html",
                      code: BLANK_HTML,
                      filename: "index.html",
                    });
                    setDockOpen(true);
                  }}
                />
              ) : (
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-4 pb-8">
                  {chat.messages.map((message) => (
                    <MessageCard
                      key={message.id}
                      message={message}
                      conversationId={chat.id}
                      streaming={streamingId === message.id}
                      onRun={handleRun}
                    />
                  ))}
                </div>
              )}
            </div>

            <Composer
              value={draft}
              onChange={setDraft}
              aiVersion={aiVersion}
              onAiVersion={setAiVersion}
              busy={busy}
              onSend={() => void send()}
              onStop={stop}
            />
          </main>

          {artifact ? (
            <div className="hidden w-[min(28rem,42vw)] shrink-0 border-l border-border lg:block">
              <ArtifactDock
                artifact={artifact}
                onClose={closeArtifact}
                onCode={updateArtifactCode}
                className="h-full"
              />
            </div>
          ) : null}
        </div>

        <Dialog.Root open={navOpen} onOpenChange={setNavOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-abyss/70 md:hidden" />
            <Dialog.Content
              className="fixed inset-y-0 left-0 z-50 w-[min(18.5rem,88vw)] outline-none md:hidden"
              aria-describedby={undefined}
            >
              <Dialog.Title className="sr-only">Percakapan</Dialog.Title>
              <Sidebar
                conversations={conversations}
                activeId={activeId}
                onNew={() => {
                  stop();
                  newChat();
                  setNavOpen(false);
                }}
                onSelect={(id) => {
                  stop();
                  setActive(id);
                  setNavOpen(false);
                }}
                onDelete={deleteChat}
                className="h-full border-r border-border"
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Dialog.Root open={Boolean(mobileArtifact) && dockOpen} onOpenChange={setDockOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-abyss/70 lg:hidden" />
            <Dialog.Content
              className="fixed inset-x-0 bottom-0 z-50 h-[min(88dvh,40rem)] outline-none lg:hidden"
              aria-describedby={undefined}
            >
              <Dialog.Title className="sr-only">Ruang kerja</Dialog.Title>
              {mobileArtifact ? (
                <div className="relative h-full rounded-t-2xl border-t border-border bg-depth">
                  <Dialog.Close asChild>
                    <Button size="iconSm" className="absolute top-2.5 right-2 z-10" aria-label="Tutup">
                      <X />
                    </Button>
                  </Dialog.Close>
                  <ArtifactDock
                    artifact={mobileArtifact}
                    onClose={() => {
                      setDockOpen(false);
                      closeArtifact();
                    }}
                    onCode={updateArtifactCode}
                    className="h-full rounded-t-2xl"
                  />
                </div>
              ) : null}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <AdminPanel open={adminOpen} onOpenChange={setAdminOpen} />

        <Toaster
          theme="light"
          position="top-center"
          toastOptions={{
            classNames: {
              toast: "bg-tide text-ink border-border shadow-[var(--shadow-border)]",
            },
          }}
        />
      </div>
    </TooltipProvider>
  );
}

function EmptyState({
  onPick,
  onScratch,
}: {
  onPick: (prompt: string) => void;
  onScratch: () => void;
}) {
  let welcome = "Tempat kerja lautan. Isi key V1/V2 di pengaturan, atau pakai otak lokal tanpa key.";
  try {
    welcome = localStorage.getItem("samudra-welcome") || welcome;
  } catch {
    /* */
  }
  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-4 py-10">
      <p className="font-display text-4xl leading-none tracking-tight text-foam md:text-5xl">Samudra</p>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-mist md:text-base">{welcome}</p>
      <ul className="mt-8 grid gap-2 sm:grid-cols-2">
        {STARTERS.map((item) => (
          <li key={item.title}>
            <button
              type="button"
              onClick={() => onPick(item.prompt)}
              className="h-full w-full rounded-2xl bg-tide/70 px-4 py-3.5 text-left shadow-[var(--shadow-border)] transition-[transform,box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)] active:scale-[0.98]"
            >
              <span className="block text-sm font-medium text-foam">{item.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-mist">{item.blurb}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onScratch}
        className="mt-4 self-start rounded-xl px-3 py-2 text-sm text-mist transition-colors hover:text-foam"
      >
        Atau buka ruang kerja kosong
      </button>
    </div>
  );
}
