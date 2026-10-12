import * as Dialog from "@radix-ui/react-dialog";
import { Menu, PanelRight, Settings, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { ArtifactDock } from "@/components/studio/artifact-dock";
import { Composer } from "@/components/studio/composer";
import { MessageCard } from "@/components/studio/message-card";
import { OceanBackdrop } from "@/components/studio/ocean-backdrop";
import { Sidebar } from "@/components/studio/sidebar";
import { WaveMark } from "@/components/studio/wave-mark";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { generateImage, streamChat } from "@/lib/studio/client";
import { downloadText } from "@/lib/studio/files";
import { extractArtifacts } from "@/lib/studio/parse";
import { selectActiveChat, useStudioStore } from "@/lib/studio/store";
import {
  ADMIN_KEY,
  ADMIN_TRIGGER,
  BLANK_HTML,
  STARTERS,
  type ActiveArtifact,
  type ImageVersion,
  type StudioMode,
} from "@/lib/studio/types";
import { cn } from "@/lib/utils";

const LONG_TEXT_LIMIT = 8000;

export function StudioApp() {
  const hydrate = useStudioStore((state) => state.hydrate);
  const conversations = useStudioStore((state) => state.conversations);
  const activeId = useStudioStore((state) => state.activeId);
  const streamingId = useStudioStore((state) => state.streamingId);
  const artifact = useStudioStore((state) => state.artifact);
  const settings = useStudioStore((state) => state.settings);
  const isAdmin = useStudioStore((state) => state.isAdmin);
  const newChat = useStudioStore((state) => state.newChat);
  const setActive = useStudioStore((state) => state.setActive);
  const deleteChat = useStudioStore((state) => state.deleteChat);
  const addMessage = useStudioStore((state) => state.addMessage);
  const patchMessage = useStudioStore((state) => state.patchMessage);
  const setStreaming = useStudioStore((state) => state.setStreaming);
  const openArtifact = useStudioStore((state) => state.openArtifact);
  const closeArtifact = useStudioStore((state) => state.closeArtifact);
  const updateArtifactCode = useStudioStore((state) => state.updateArtifactCode);
  const updateSettings = useStudioStore((state) => state.updateSettings);
  const setAdmin = useStudioStore((state) => state.setAdmin);
  const chat = useStudioStore(selectActiveChat);

  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<StudioMode>("chat");
  const [imageVersion, setImageVersion] = useState<ImageVersion>(settings.imageVersion);
  const [navOpen, setNavOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [awaitingAdminKey, setAwaitingAdminKey] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    setImageVersion(settings.imageVersion);
  }, [settings.imageVersion]);

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

  async function handleWebExtract(url: string, conversationId: string, assistantId: string) {
    try {
      // Client-side fetch often blocked by CORS — try anyway, then explain
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      const text = await res.text();
      const snippet = text.slice(0, 15000);
      const summary = `### Analisis isi web\n\n**URL:** ${url}\n\n**Panjang konten:** ${text.length} karakter\n\n#### Cuplikan HTML / teks\n\n\`\`\`html\n${snippet}${text.length > 15000 ? "\n... (dipotong)" : ""}\n\`\`\`\n\nSaya sudah ambil isi mentahnya. Kamu bisa minta saya breakdown komponen, CSS, JS, atau buat ulang versi yang lebih rapi.`;
      patchMessage(conversationId, assistantId, { content: summary });
    } catch {
      patchMessage(conversationId, assistantId, {
        content: `Gagal ambil isi web dari **${url}** karena pembatasan CORS browser.\n\nCara alternatif:\n1. Buka situs di tab baru → View Source / Inspect\n2. Salin HTML yang dibutuhkan\n3. Paste di sini, bilang "analisis komponen ini"\n\nAtau deploy app ini ke server yang punya proxy scrape (mis. Vercel function + cheerio).`,
      });
    }
  }

  async function send(text = draft, sendMode = mode) {
    let prompt = text.trim();
    if (!prompt || busy) return;

    // Admin trigger
    if (prompt === ADMIN_TRIGGER) {
      setDraft("");
      setAwaitingAdminKey(true);
      setAdminOpen(true);
      toast.message("Masukkan key admin formalitas");
      return;
    }

    // Long text → auto file
    let fileName: string | undefined;
    if (prompt.length > LONG_TEXT_LIMIT) {
      fileName = `zuzuxf-long-text-${Date.now()}.txt`;
      downloadText(fileName, prompt);
      toast.success(`Teks > ${LONG_TEXT_LIMIT} karakter → diunduh sebagai ${fileName}`);
      prompt = `[File panjang: ${fileName}]\n\nCuplikan awal:\n${prompt.slice(0, 1500)}…\n\n(Full text sudah diunduh sebagai file)`;
    }

    const conversationId = ensureChat();
    setDraft("");
    setNavOpen(false);

    addMessage(conversationId, { role: "user", content: prompt, fileName });
    const assistantId = addMessage(conversationId, { role: "assistant", content: "" });
    setStreaming(assistantId);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Web extract command
      const webMatch = prompt.match(/tolong\s+ambilin\s+isi\s+web\s+ini\s+(https?:\/\/\S+)/i);
      if (webMatch && sendMode === "chat") {
        await handleWebExtract(webMatch[1], conversationId, assistantId);
        return;
      }

      if (sendMode === "image") {
        const image = await generateImage(prompt, controller.signal, imageVersion);
        patchMessage(conversationId, assistantId, { imageUrl: image, content: prompt });
        return;
      }

      const snapshot = useStudioStore.getState().conversations.find((item) => item.id === conversationId);
      const history = (snapshot?.messages ?? [])
        .filter((message) => message.id !== assistantId && message.content.trim())
        .slice(-20)
        .map((message) => ({ role: message.role, content: message.content }));

      let assembled = "";
      await streamChat({
        messages: history,
        signal: controller.signal,
        provider: settings.provider,
        geminiKey: settings.geminiKey,
        groqKey: settings.groqKey,
        systemPrompt: settings.systemPrompt,
        model: settings.model,
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
        if (window.matchMedia("(min-width: 1024px)").matches) {
          setDockOpen(true);
        }
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

  function handleFile(file: File) {
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const conversationId = ensureChat();
        addMessage(conversationId, {
          role: "user",
          content: `[Foto dilampirkan: ${file.name}]`,
          imageUrl: dataUrl,
          fileName: file.name,
        });
        toast.success(`Foto ${file.name} ditambahkan ke chat`);
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        setDraft((prev) => (prev ? `${prev}\n\n` : "") + `--- File: ${file.name} ---\n${text.slice(0, 6000)}`);
        toast.success(`Isi file ${file.name} dimasukkan ke kotak chat`);
      };
      reader.readAsText(file);
    }
  }

  function tryAdminKey() {
    if (adminKeyInput.trim() === ADMIN_KEY) {
      setAdmin(true);
      setAwaitingAdminKey(false);
      setAdminKeyInput("");
      toast.success("Admin panel terbuka");
    } else {
      toast.error("Key salah");
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
            onSettings={() => setSettingsOpen(true)}
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
                <span className="font-display text-base tracking-tight">ZUZUXF_AI</span>
              </div>
              <p className="hidden truncate text-sm text-mist md:block">
                {chat?.title ?? "Studio soft pink"}
              </p>
              <div className="ml-auto flex items-center gap-1">
                <Button size="icon" className="md:hidden" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
                  <Settings className="size-4" />
                </Button>
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

            <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto">
              {empty ? (
                <EmptyState
                  onPick={(prompt) => {
                    setMode("chat");
                    void send(prompt, "chat");
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
              mode={mode}
              onMode={setMode}
              imageVersion={imageVersion}
              onImageVersion={(v) => {
                setImageVersion(v);
                updateSettings({ imageVersion: v });
              }}
              busy={busy}
              onSend={() => void send()}
              onStop={stop}
              onFile={handleFile}
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

        {/* Mobile nav */}
        <Dialog.Root open={navOpen} onOpenChange={setNavOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-abyss/70 md:hidden" />
            <Dialog.Content
              className={cn(
                "fixed inset-y-0 left-0 z-50 w-[min(18.5rem,88vw)] outline-none md:hidden",
                "data-[state=open]:animate-in data-[state=closed]:animate-out",
              )}
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
                onSettings={() => {
                  setNavOpen(false);
                  setSettingsOpen(true);
                }}
                className="h-full border-r border-border"
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {/* Mobile artifact dock */}
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

        {/* Settings modal */}
        <Dialog.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-abyss/80" />
            <Dialog.Content className="fixed inset-x-4 top-[10%] z-50 mx-auto max-h-[80dvh] max-w-md overflow-y-auto rounded-2xl border border-border bg-depth p-5 outline-none">
              <Dialog.Title className="font-display text-xl text-foam">Settings & API Keys</Dialog.Title>
              <p className="mt-1 text-sm text-mist">Key disimpan di perangkatmu (localStorage).</p>

              <div className="mt-4 space-y-3">
                <label className="block text-xs text-mist">Provider AI</label>
                <select
                  className="w-full rounded-xl bg-tide px-3 py-2 text-sm text-ink"
                  value={settings.provider}
                  onChange={(e) => updateSettings({ provider: e.target.value as "xai" | "gemini" | "groq" })}
                >
                  <option value="xai">xAI / Grok (default host)</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="groq">Groq</option>
                </select>

                <label className="block text-xs text-mist">Gemini API Key</label>
                <input
                  type="password"
                  className="w-full rounded-xl bg-tide px-3 py-2 text-sm text-ink"
                  placeholder="AIza..."
                  value={settings.geminiKey}
                  onChange={(e) => updateSettings({ geminiKey: e.target.value })}
                />

                <label className="block text-xs text-mist">Groq API Key</label>
                <input
                  type="password"
                  className="w-full rounded-xl bg-tide px-3 py-2 text-sm text-ink"
                  placeholder="gsk_..."
                  value={settings.groqKey}
                  onChange={(e) => updateSettings({ groqKey: e.target.value })}
                />

                <label className="block text-xs text-mist">Model (opsional)</label>
                <input
                  className="w-full rounded-xl bg-tide px-3 py-2 text-sm text-ink"
                  placeholder="grok-4.5 / gemini-2.0-flash / llama-3.3-70b-versatile"
                  value={settings.model}
                  onChange={(e) => updateSettings({ model: e.target.value })}
                />

                <label className="block text-xs text-mist">Image Version default</label>
                <select
                  className="w-full rounded-xl bg-tide px-3 py-2 text-sm text-ink"
                  value={settings.imageVersion}
                  onChange={(e) => updateSettings({ imageVersion: e.target.value as ImageVersion })}
                >
                  <option value="1">Versi 1 (1k)</option>
                  <option value="2">Versi 2 (2k + detail)</option>
                </select>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <Button variant="quiet" onClick={() => setSettingsOpen(false)}>Tutup</Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {/* Admin panel */}
        <Dialog.Root open={adminOpen || isAdmin} onOpenChange={(o) => { if (!o) { setAdminOpen(false); if (!isAdmin) setAwaitingAdminKey(false); } }}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-abyss/80" />
            <Dialog.Content className="fixed inset-x-4 top-[8%] z-50 mx-auto max-h-[85dvh] max-w-lg overflow-y-auto rounded-2xl border border-border bg-depth p-5 outline-none">
              <Dialog.Title className="font-display text-xl text-foam">Admin Panel · ZUZUXF_AI</Dialog.Title>

              {awaitingAdminKey && !isAdmin ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-mist">Masukkan key formalitas admin:</p>
                  <input
                    type="password"
                    className="w-full rounded-xl bg-tide px-3 py-2 text-sm text-ink"
                    value={adminKeyInput}
                    onChange={(e) => setAdminKeyInput(e.target.value)}
                    placeholder="DEV=ZUZUXF_AI=™X10WDEV"
                    onKeyDown={(e) => e.key === "Enter" && tryAdminKey()}
                  />
                  <Button variant="primary" onClick={tryAdminKey}>Verifikasi</Button>
                </div>
              ) : isAdmin ? (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-ok">✓ Admin aktif</p>
                  <label className="block text-xs text-mist">System Prompt</label>
                  <textarea
                    className="min-h-32 w-full rounded-xl bg-tide px-3 py-2 text-sm text-ink"
                    value={settings.systemPrompt}
                    onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
                  />
                  <label className="block text-xs text-mist">Model</label>
                  <input
                    className="w-full rounded-xl bg-tide px-3 py-2 text-sm text-ink"
                    value={settings.model}
                    onChange={(e) => updateSettings({ model: e.target.value })}
                  />
                  <label className="block text-xs text-mist">Provider</label>
                  <select
                    className="w-full rounded-xl bg-tide px-3 py-2 text-sm text-ink"
                    value={settings.provider}
                    onChange={(e) => updateSettings({ provider: e.target.value as "xai" | "gemini" | "groq" })}
                  >
                    <option value="xai">xAI</option>
                    <option value="gemini">Gemini</option>
                    <option value="groq">Groq</option>
                  </select>
                  <Button variant="danger" onClick={() => { setAdmin(false); setAdminOpen(false); }}>
                    Logout Admin
                  </Button>
                </div>
              ) : null}

              <div className="mt-4 flex justify-end">
                <Button variant="quiet" onClick={() => { setAdminOpen(false); setAwaitingAdminKey(false); }}>Tutup</Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            classNames: {
              toast: "bg-lagoon text-ink border-border shadow-[var(--shadow-border)]",
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
  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-4 py-10">
      <p className="font-display text-4xl leading-none tracking-tight text-foam md:text-5xl">ZUZUXF_AI</p>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-mist md:text-base">
        Studio AI soft pink. Chat apa saja, buat gambar, jalankan kode, ambil isi web, kirim foto.
      </p>
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
