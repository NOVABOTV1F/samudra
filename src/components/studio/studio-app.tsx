import * as Dialog from "@radix-ui/react-dialog";
import { Menu, PanelRight, Settings, X, Shield, Trash2, Download, RotateCcw, Sparkles } from "lucide-react";
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
  providerFromVersion,
  type ActiveArtifact,
  type ImageVersion,
  type StudioMode,
} from "@/lib/studio/types";
import { cn } from "@/lib/utils";

const LONG_TEXT_LIMIT = 8000;

export function StudioApp() {
  const hydrate = useStudioStore((s) => s.hydrate);
  const conversations = useStudioStore((s) => s.conversations);
  const activeId = useStudioStore((s) => s.activeId);
  const streamingId = useStudioStore((s) => s.streamingId);
  const artifact = useStudioStore((s) => s.artifact);
  const settings = useStudioStore((s) => s.settings);
  const isAdmin = useStudioStore((s) => s.isAdmin);
  const newChat = useStudioStore((s) => s.newChat);
  const setActive = useStudioStore((s) => s.setActive);
  const deleteChat = useStudioStore((s) => s.deleteChat);
  const clearAllChats = useStudioStore((s) => s.clearAllChats);
  const addMessage = useStudioStore((s) => s.addMessage);
  const patchMessage = useStudioStore((s) => s.patchMessage);
  const setStreaming = useStudioStore((s) => s.setStreaming);
  const openArtifact = useStudioStore((s) => s.openArtifact);
  const closeArtifact = useStudioStore((s) => s.closeArtifact);
  const updateArtifactCode = useStudioStore((s) => s.updateArtifactCode);
  const updateSettings = useStudioStore((s) => s.updateSettings);
  const resetSettings = useStudioStore((s) => s.resetSettings);
  const setAdmin = useStudioStore((s) => s.setAdmin);
  const chat = useStudioStore(selectActiveChat);

  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<StudioMode>("chat");
  const [aiVersion, setAiVersion] = useState<ImageVersion>(settings.imageVersion || "1");
  const [navOpen, setNavOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [awaitingAdminKey, setAwaitingAdminKey] = useState(false);
  const [adminTab, setAdminTab] = useState<"ai" | "fitur" | "data" | "info">("ai");
  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => { setAiVersion(settings.imageVersion || "1"); }, [settings.imageVersion]);
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

  function filterBanned(text: string): string | null {
    const words = settings.bannedWords.split(/[,\n]/).map((w) => w.trim().toLowerCase()).filter(Boolean);
    if (!words.length) return null;
    const hit = words.find((w) => text.toLowerCase().includes(w));
    return hit ? `Pesan diblokir (kata terlarang: "${hit}")` : null;
  }

  async function handleWebExtract(url: string, conversationId: string, assistantId: string) {
    if (!settings.enableWebExtract) {
      patchMessage(conversationId, assistantId, { content: "Fitur ambil isi web dimatikan di Admin." });
      return;
    }
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      const text = await res.text();
      const snippet = text.slice(0, 15000);
      patchMessage(conversationId, assistantId, {
        content: `### Analisis web\n\n**URL:** ${url}\n\n**Panjang:** ${text.length}\n\n\`\`\`html\n${snippet}${text.length > 15000 ? "\n..." : ""}\n\`\`\``,
      });
    } catch {
      patchMessage(conversationId, assistantId, {
        content: `Gagal ambil **${url}** (CORS). Salin HTML manual lalu paste di sini.`,
      });
    }
  }

  async function send(text = draft, sendMode = mode) {
    let prompt = text.trim();
    if (!prompt || busy) return;

    if (prompt === ADMIN_TRIGGER) {
      setDraft("");
      setAwaitingAdminKey(true);
      setAdminOpen(true);
      toast.message("Masukkan key admin");
      return;
    }

    const banned = filterBanned(prompt);
    if (banned) { toast.error(banned); return; }

    let fileName: string | undefined;
    if (settings.enableLongTextFile && prompt.length > LONG_TEXT_LIMIT) {
      fileName = `zuzuxf-long-${Date.now()}.txt`;
      downloadText(fileName, prompt);
      toast.success(`Teks panjang → ${fileName}`);
      prompt = `[File: ${fileName}]\n\n${prompt.slice(0, 1500)}…`;
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
      const webMatch = prompt.match(/tolong\s+ambilin\s+isi\s+web\s+ini\s+(https?:\/\/\S+)/i);
      if (webMatch && sendMode === "chat") {
        await handleWebExtract(webMatch[1], conversationId, assistantId);
        return;
      }

      if (sendMode === "image") {
        if (!settings.enableImageGen) {
          patchMessage(conversationId, assistantId, { error: "Gambar dimatikan di Admin." });
          return;
        }
        const image = await generateImage(prompt, controller.signal, aiVersion);
        patchMessage(conversationId, assistantId, { imageUrl: image, content: prompt });
        return;
      }

      const snapshot = useStudioStore.getState().conversations.find((i) => i.id === conversationId);
      const history = (snapshot?.messages ?? [])
        .filter((m) => m.id !== assistantId && m.content.trim())
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      let assembled = "";
      const activeProvider = providerFromVersion(aiVersion);
      await streamChat({
        messages: history,
        signal: controller.signal,
        provider: activeProvider,
        systemPrompt: settings.systemPrompt,
        model: settings.model,
        onDelta: (chunk) => {
          assembled += chunk;
          patchMessage(conversationId, assistantId, { content: assembled });
        },
      });

      const found = extractArtifacts(assembled, assistantId).filter((i) => i.runnable);
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
      patchMessage(conversationId, assistantId, {
        error: error instanceof Error ? error.message : "Terjadi kesalahan.",
      });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setStreaming(null);
    }
  }

  function handleFile(file: File) {
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        const conversationId = ensureChat();
        addMessage(conversationId, {
          role: "user",
          content: `[Foto: ${file.name}]`,
          imageUrl: reader.result as string,
          fileName: file.name,
        });
        toast.success(`Foto ${file.name} ditambahkan`);
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        setDraft((prev) => (prev ? `${prev}\n\n` : "") + `--- ${file.name} ---\n${String(reader.result).slice(0, 6000)}`);
        toast.success(`File ${file.name} dimasukkan`);
      };
      reader.readAsText(file);
    }
  }

  function tryAdminKey() {
    if (adminKeyInput.trim() === ADMIN_KEY) {
      setAdmin(true);
      setAwaitingAdminKey(false);
      setAdminKeyInput("");
      toast.success("Admin aktif");
    } else toast.error("Key salah");
  }

  const mobileArtifact = useMemo(() => artifact, [artifact]);

  return (
    <TooltipProvider>
      <div className="relative flex h-dvh overflow-hidden bg-abyss text-ink" style={{ fontSize: `${(settings.fontScale || 1) * 100}%` }}>
        <OceanBackdrop />
        <aside className="relative z-10 hidden w-72 shrink-0 border-r border-border md:flex">
          <Sidebar
            conversations={conversations}
            activeId={activeId}
            onNew={() => { stop(); newChat(); }}
            onSelect={(id) => { stop(); setActive(id); }}
            onDelete={deleteChat}
            onSettings={() => setSettingsOpen(true)}
            className="w-full"
          />
        </aside>

        <div className="relative z-10 flex min-w-0 flex-1">
          <main className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-14 items-center gap-2 px-2 md:px-4">
              <Button size="icon" className="md:hidden" aria-label="Menu" onClick={() => setNavOpen(true)}><Menu /></Button>
              <div className="flex min-w-0 items-center gap-2 md:hidden">
                <WaveMark className="size-6" />
                <span className="font-display text-base tracking-tight">ZUZUXF_AI</span>
              </div>
              <p className="hidden truncate text-sm text-mist md:block">{chat?.title ?? settings.welcomeMessage}</p>
              <div className="ml-auto flex items-center gap-1">
                {isAdmin ? (
                  <Button size="icon" variant="quiet" aria-label="Admin" onClick={() => setAdminOpen(true)}>
                    <Shield className="size-4 text-accent" />
                  </Button>
                ) : null}
                <Button size="icon" className="md:hidden" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
                  <Settings className="size-4" />
                </Button>
                {artifact ? (
                  <Button size="icon" className="md:hidden" aria-label="Workspace" onClick={() => setDockOpen(true)}>
                    <PanelRight />
                  </Button>
                ) : null}
              </div>
            </header>

            <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto">
              {empty ? (
                <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-4 py-10">
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="size-6 text-accent" />
                    <p className="font-display text-4xl text-foam md:text-5xl">ZUZUXF_AI</p>
                  </div>
                  <p className="mt-2 max-w-md text-sm text-mist md:text-base">{settings.welcomeMessage}</p>
                  <p className="mt-2 text-xs text-mist">V1 = Gemini · V2 = Groq (key dari Netlify env)</p>
                  <ul className="mt-8 grid gap-2.5 sm:grid-cols-2">
                    {STARTERS.map((item) => (
                      <li key={item.title}>
                        <button type="button" onClick={() => { setMode("chat"); void send(item.prompt, "chat"); }}
                          className="h-full w-full rounded-2xl bg-tide/70 px-4 py-3.5 text-left shadow-[var(--shadow-border)] transition hover:ring-1 hover:ring-accent/25 active:scale-[0.98]">
                          <span className="block text-sm font-medium text-foam">{item.title}</span>
                          <span className="mt-1 block text-xs text-mist">{item.blurb}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button type="button" onClick={() => {
                    openArtifact({ conversationId: activeId ?? "scratch", messageId: "scratch", artifactId: "scratch", lang: "html", code: BLANK_HTML, filename: "index.html" });
                    setDockOpen(true);
                  }} className="mt-4 self-start rounded-xl px-3 py-2 text-sm text-mist hover:text-foam">
                    Ruang kerja kosong →
                  </button>
                </div>
              ) : (
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-4 pb-8">
                  {chat!.messages.map((message) => (
                    <MessageCard key={message.id} message={message} conversationId={chat!.id} streaming={streamingId === message.id}
                      onRun={(next: ActiveArtifact) => { openArtifact(next); setDockOpen(true); }} />
                  ))}
                </div>
              )}
            </div>

            <Composer
              value={draft}
              onChange={setDraft}
              mode={mode}
              onMode={setMode}
              aiVersion={aiVersion}
              onAiVersion={(v) => {
                setAiVersion(v);
                updateSettings({ imageVersion: v, provider: providerFromVersion(v) });
              }}
              busy={busy}
              onSend={() => void send()}
              onStop={stop}
              onFile={handleFile}
            />
          </main>

          {artifact ? (
            <div className="hidden w-[min(28rem,42vw)] shrink-0 border-l border-border lg:block">
              <ArtifactDock artifact={artifact} onClose={closeArtifact} onCode={updateArtifactCode} className="h-full" />
            </div>
          ) : null}
        </div>

        <Dialog.Root open={navOpen} onOpenChange={setNavOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-abyss/70 md:hidden" />
            <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-[min(18.5rem,88vw)] outline-none md:hidden" aria-describedby={undefined}>
              <Dialog.Title className="sr-only">Nav</Dialog.Title>
              <Sidebar conversations={conversations} activeId={activeId}
                onNew={() => { stop(); newChat(); setNavOpen(false); }}
                onSelect={(id) => { stop(); setActive(id); setNavOpen(false); }}
                onDelete={deleteChat}
                onSettings={() => { setNavOpen(false); setSettingsOpen(true); }}
                className="h-full border-r border-border" />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Dialog.Root open={Boolean(mobileArtifact) && dockOpen} onOpenChange={setDockOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-abyss/70 lg:hidden" />
            <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 h-[min(88dvh,40rem)] outline-none lg:hidden" aria-describedby={undefined}>
              <Dialog.Title className="sr-only">Workspace</Dialog.Title>
              {mobileArtifact ? (
                <div className="relative h-full rounded-t-2xl border-t border-border bg-depth">
                  <Dialog.Close asChild>
                    <Button size="iconSm" className="absolute top-2.5 right-2 z-10" aria-label="Tutup"><X /></Button>
                  </Dialog.Close>
                  <ArtifactDock artifact={mobileArtifact} onClose={() => { setDockOpen(false); closeArtifact(); }} onCode={updateArtifactCode} className="h-full rounded-t-2xl" />
                </div>
              ) : null}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Dialog.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-abyss/80" />
            <Dialog.Content className="fixed inset-x-4 top-[10%] z-50 mx-auto max-h-[80dvh] max-w-md overflow-y-auto rounded-2xl border border-border bg-depth p-5 outline-none">
              <Dialog.Title className="font-display text-xl text-foam">Settings</Dialog.Title>
              <p className="mt-2 text-sm text-mist">
                Key AI diambil dari <strong className="text-foam">Netlify Environment Variables</strong>:
                <code className="text-accent"> GEMINI_API_KEY</code> & <code className="text-accent">GROQ_API_KEY</code>.
                User tidak perlu isi key — pilih V1/V2 lalu chat.
              </p>
              <p className="mt-3 rounded-xl bg-tide/50 px-3 py-2 text-xs text-mist">
                Lihat <code>.env.example</code> di repo. Jangan commit key ke GitHub.
              </p>
              <div className="mt-4">
                <Button variant="primary" className="w-full" onClick={() => setSettingsOpen(false)}>Tutup</Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Dialog.Root open={adminOpen || isAdmin} onOpenChange={(o) => { if (!o) { setAdminOpen(false); if (!isAdmin) setAwaitingAdminKey(false); } }}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-abyss/85" />
            <Dialog.Content className="fixed inset-x-3 top-[5%] z-50 mx-auto max-h-[90dvh] max-w-lg overflow-y-auto rounded-2xl border border-accent/30 bg-depth p-5 outline-none">
              <Dialog.Title className="flex items-center gap-2 font-display text-xl text-foam">
                <Shield className="size-5 text-accent" /> Admin Panel
              </Dialog.Title>
              {awaitingAdminKey && !isAdmin ? (
                <div className="mt-4 space-y-3">
                  <input type="password" className="w-full rounded-xl bg-tide px-3 py-2 text-sm" value={adminKeyInput}
                    onChange={(e) => setAdminKeyInput(e.target.value)} placeholder="DEV=ZUZUXF_AI=™X10WDEV"
                    onKeyDown={(e) => e.key === "Enter" && tryAdminKey()} />
                  <Button variant="primary" className="w-full" onClick={tryAdminKey}>Verifikasi</Button>
                </div>
              ) : isAdmin ? (
                <div className="mt-4 space-y-3">
                  <div className="flex gap-1 rounded-xl bg-tide/60 p-1">
                    {(["ai", "fitur", "data", "info"] as const).map((t) => (
                      <button key={t} type="button" onClick={() => setAdminTab(t)}
                        className={cn("flex-1 rounded-lg px-2 py-2 text-xs capitalize", adminTab === t ? "bg-accent/20 text-foam" : "text-mist")}>
                        {t}
                      </button>
                    ))}
                  </div>
                  {adminTab === "ai" && (
                    <div className="space-y-2">
                      <label className="text-xs text-mist">System Prompt</label>
                      <textarea className="min-h-24 w-full rounded-xl bg-tide px-3 py-2 text-sm" value={settings.systemPrompt}
                        onChange={(e) => updateSettings({ systemPrompt: e.target.value })} />
                      <label className="text-xs text-mist">Model (kosong = default provider)</label>
                      <input className="w-full rounded-xl bg-tide px-3 py-2 text-sm" value={settings.model}
                        onChange={(e) => updateSettings({ model: e.target.value })} placeholder="gemini-2.0-flash / llama-3.3-70b-versatile" />
                      <label className="text-xs text-mist">Welcome</label>
                      <input className="w-full rounded-xl bg-tide px-3 py-2 text-sm" value={settings.welcomeMessage}
                        onChange={(e) => updateSettings({ welcomeMessage: e.target.value })} />
                    </div>
                  )}
                  {adminTab === "fitur" && (
                    <div className="space-y-2 text-sm">
                      {([
                        ["enableWebExtract", "Ambil isi web"],
                        ["enableLongTextFile", "Auto-file teks panjang"],
                        ["enableImageGen", "Generate gambar"],
                      ] as const).map(([k, label]) => (
                        <label key={k} className="flex items-center gap-2 rounded-xl bg-tide/40 px-3 py-2">
                          <input type="checkbox" checked={Boolean(settings[k])} onChange={(e) => updateSettings({ [k]: e.target.checked })} />
                          {label}
                        </label>
                      ))}
                      <label className="text-xs text-mist">Kata terlarang</label>
                      <input className="w-full rounded-xl bg-tide px-3 py-2 text-sm" value={settings.bannedWords}
                        onChange={(e) => updateSettings({ bannedWords: e.target.value })} />
                    </div>
                  )}
                  {adminTab === "data" && (
                    <div className="space-y-2">
                      <Button variant="quiet" className="w-full justify-start gap-2" onClick={() => {
                        downloadText(`zuzuxf-settings-${Date.now()}.json`, JSON.stringify(settings, null, 2), "application/json");
                        toast.success("Exported");
                      }}><Download className="size-4" /> Export settings</Button>
                      <Button variant="quiet" className="w-full justify-start gap-2" onClick={() => { resetSettings(); toast.success("Reset"); }}>
                        <RotateCcw className="size-4" /> Reset settings
                      </Button>
                      <Button variant="danger" className="w-full justify-start gap-2" onClick={() => {
                        if (confirm("Hapus semua chat?")) { clearAllChats(); toast.success("Dihapus"); }
                      }}><Trash2 className="size-4" /> Hapus semua chat</Button>
                      <Button variant="danger" className="w-full" onClick={() => { setAdmin(false); setAdminOpen(false); }}>Logout Admin</Button>
                    </div>
                  )}
                  {adminTab === "info" && (
                    <div className="space-y-2 text-sm text-mist">
                      <p>Trigger: <code className="text-accent">FOURDEV/=DEV=KEY</code></p>
                      <p>Key: <code className="text-accent">DEV=ZUZUXF_AI=™X10WDEV</code></p>
                      <p>V1 → Gemini (GEMINI_API_KEY) · V2 → Groq (GROQ_API_KEY)</p>
                      <p>Set di Netlify → Environment variables → Redeploy</p>
                    </div>
                  )}
                </div>
              ) : null}
              <Button variant="quiet" className="mt-4 w-full" onClick={() => { setAdminOpen(false); setAwaitingAdminKey(false); }}>Tutup</Button>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Toaster theme="dark" position="top-center" toastOptions={{ classNames: { toast: "bg-lagoon text-ink border-border" } }} />
      </div>
    </TooltipProvider>
  );
}
