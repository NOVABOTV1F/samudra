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
  const [imageVersion, setImageVersion] = useState<ImageVersion>(settings.imageVersion);
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
  useEffect(() => { setImageVersion(settings.imageVersion); }, [settings.imageVersion]);
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
    const words = settings.bannedWords
      .split(/[,\n]/)
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);
    if (words.length === 0) return null;
    const lower = text.toLowerCase();
    const hit = words.find((w) => lower.includes(w));
    return hit ? `Pesan diblokir (kata terlarang: "${hit}")` : null;
  }

  async function handleWebExtract(url: string, conversationId: string, assistantId: string) {
    if (!settings.enableWebExtract) {
      patchMessage(conversationId, assistantId, { content: "Fitur ambil isi web dimatikan di Admin Panel." });
      return;
    }
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      const text = await res.text();
      const snippet = text.slice(0, 15000);
      const summary = `### Analisis isi web\n\n**URL:** ${url}\n\n**Panjang:** ${text.length} karakter\n\n#### Cuplikan\n\n\`\`\`html\n${snippet}${text.length > 15000 ? "\n... (dipotong)" : ""}\n\`\`\`\n\nMinta breakdown komponen, CSS, JS, atau buat ulang versi lebih rapi.`;
      patchMessage(conversationId, assistantId, { content: summary });
    } catch {
      patchMessage(conversationId, assistantId, {
        content: `Gagal ambil **${url}** (CORS).\n\nAlternatif: View Source → salin HTML → paste di sini + bilang "analisis komponen ini".`,
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
      setAdminTab("ai");
      toast.message("Masukkan key admin");
      return;
    }

    const banned = filterBanned(prompt);
    if (banned) {
      toast.error(banned);
      return;
    }

    let fileName: string | undefined;
    if (settings.enableLongTextFile && prompt.length > LONG_TEXT_LIMIT) {
      fileName = `zuzuxf-long-${Date.now()}.txt`;
      downloadText(fileName, prompt);
      toast.success(`Teks > ${LONG_TEXT_LIMIT} → file ${fileName}`);
      prompt = `[File panjang: ${fileName}]\n\nCuplikan:\n${prompt.slice(0, 1500)}…`;
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
          patchMessage(conversationId, assistantId, { error: "Generate gambar dimatikan di Admin." });
          return;
        }
        const image = await generateImage(prompt, controller.signal, imageVersion);
        patchMessage(conversationId, assistantId, { imageUrl: image, content: prompt });
        return;
      }

      const snapshot = useStudioStore.getState().conversations.find((i) => i.id === conversationId);
      const history = (snapshot?.messages ?? [])
        .filter((m) => m.id !== assistantId && m.content.trim())
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

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
          content: `[Foto: ${file.name}]`,
          imageUrl: dataUrl,
          fileName: file.name,
        });
        toast.success(`Foto ${file.name} ditambahkan`);
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        setDraft((prev) => (prev ? `${prev}\n\n` : "") + `--- ${file.name} ---\n${text.slice(0, 6000)}`);
        toast.success(`File ${file.name} dimasukkan ke chat`);
      };
      reader.readAsText(file);
    }
  }

  function tryAdminKey() {
    if (adminKeyInput.trim() === ADMIN_KEY) {
      setAdmin(true);
      setAwaitingAdminKey(false);
      setAdminKeyInput("");
      toast.success("Admin aktif ✨");
    } else {
      toast.error("Key salah");
    }
  }

  function exportSettings() {
    downloadText(
      `zuzuxf-settings-${Date.now()}.json`,
      JSON.stringify(settings, null, 2),
      "application/json;charset=utf-8",
    );
    toast.success("Settings diekspor");
  }

  function handleRun(next: ActiveArtifact) {
    openArtifact(next);
    setDockOpen(true);
  }

  const mobileArtifact = useMemo(() => artifact, [artifact]);

  return (
    <TooltipProvider>
      <div className="relative flex h-dvh overflow-hidden bg-abyss text-ink" style={{ fontSize: `${settings.fontScale * 100}%` }}>
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
              <Button size="icon" className="md:hidden" aria-label="Menu" onClick={() => setNavOpen(true)}>
                <Menu />
              </Button>
              <div className="flex min-w-0 items-center gap-2 md:hidden">
                <WaveMark className="size-6" />
                <span className="font-display text-base tracking-tight">ZUZUXF_AI</span>
              </div>
              <p className="hidden truncate text-sm text-mist md:block">
                {chat?.title ?? settings.welcomeMessage}
              </p>
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
                <EmptyState
                  welcome={settings.welcomeMessage}
                  onPick={(p) => { setMode("chat"); void send(p, "chat"); }}
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
              <ArtifactDock artifact={artifact} onClose={closeArtifact} onCode={updateArtifactCode} className="h-full" />
            </div>
          ) : null}
        </div>

        {/* Mobile nav */}
        <Dialog.Root open={navOpen} onOpenChange={setNavOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-abyss/70 md:hidden" />
            <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-[min(18.5rem,88vw)] outline-none md:hidden" aria-describedby={undefined}>
              <Dialog.Title className="sr-only">Percakapan</Dialog.Title>
              <Sidebar
                conversations={conversations}
                activeId={activeId}
                onNew={() => { stop(); newChat(); setNavOpen(false); }}
                onSelect={(id) => { stop(); setActive(id); setNavOpen(false); }}
                onDelete={deleteChat}
                onSettings={() => { setNavOpen(false); setSettingsOpen(true); }}
                className="h-full border-r border-border"
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {/* Mobile dock */}
        <Dialog.Root open={Boolean(mobileArtifact) && dockOpen} onOpenChange={setDockOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-abyss/70 lg:hidden" />
            <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 h-[min(88dvh,40rem)] outline-none lg:hidden" aria-describedby={undefined}>
              <Dialog.Title className="sr-only">Ruang kerja</Dialog.Title>
              {mobileArtifact ? (
                <div className="relative h-full rounded-t-2xl border-t border-border bg-depth">
                  <Dialog.Close asChild>
                    <Button size="iconSm" className="absolute top-2.5 right-2 z-10" aria-label="Tutup"><X /></Button>
                  </Dialog.Close>
                  <ArtifactDock
                    artifact={mobileArtifact}
                    onClose={() => { setDockOpen(false); closeArtifact(); }}
                    onCode={updateArtifactCode}
                    className="h-full rounded-t-2xl"
                  />
                </div>
              ) : null}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {/* Settings */}
        <Dialog.Root open={settingsOpen} onOpenChange={setSettingsOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-abyss/80" />
            <Dialog.Content className="fixed inset-x-4 top-[8%] z-50 mx-auto max-h-[84dvh] max-w-md overflow-y-auto rounded-2xl border border-border bg-depth p-5 shadow-[var(--shadow-glow)] outline-none">
              <Dialog.Title className="font-display text-xl text-foam">Settings & API Keys</Dialog.Title>
              <p className="mt-1 text-sm text-mist">Key di browser (localStorage). Atau isi di file <code className="text-accent">.env</code> / Vercel env.</p>

              <div className="mt-4 space-y-3">
                <label className="block text-xs font-medium text-mist">Provider AI</label>
                <select className="w-full rounded-xl bg-tide px-3 py-2.5 text-sm text-ink ring-1 ring-border" value={settings.provider} onChange={(e) => updateSettings({ provider: e.target.value as "xai" | "gemini" | "groq" })}>
                  <option value="xai">xAI / Grok</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="groq">Groq</option>
                </select>

                <label className="block text-xs font-medium text-mist">Gemini API Key</label>
                <input type="password" className="w-full rounded-xl bg-tide px-3 py-2.5 text-sm text-ink ring-1 ring-border" placeholder="AIza..." value={settings.geminiKey} onChange={(e) => updateSettings({ geminiKey: e.target.value })} />

                <label className="block text-xs font-medium text-mist">Groq API Key</label>
                <input type="password" className="w-full rounded-xl bg-tide px-3 py-2.5 text-sm text-ink ring-1 ring-border" placeholder="gsk_..." value={settings.groqKey} onChange={(e) => updateSettings({ groqKey: e.target.value })} />

                <label className="block text-xs font-medium text-mist">Model</label>
                <input className="w-full rounded-xl bg-tide px-3 py-2.5 text-sm text-ink ring-1 ring-border" placeholder="grok-4.5 / gemini-2.0-flash / llama-3.3-70b-versatile" value={settings.model} onChange={(e) => updateSettings({ model: e.target.value })} />

                <label className="block text-xs font-medium text-mist">Image Version default</label>
                <select className="w-full rounded-xl bg-tide px-3 py-2.5 text-sm text-ink ring-1 ring-border" value={settings.imageVersion} onChange={(e) => updateSettings({ imageVersion: e.target.value as ImageVersion })}>
                  <option value="1">Versi 1 (1k)</option>
                  <option value="2">Versi 2 (2k + detail)</option>
                </select>

                <p className="rounded-xl bg-tide/50 px-3 py-2 text-[11px] leading-relaxed text-mist">
                  File di GitHub: <strong className="text-foam">.env.example</strong> — copy jadi <code>.env</code> atau isi Environment Variables di Vercel/Netlify: <code>GEMINI_API_KEY</code>, <code>GROQ_API_KEY</code>, <code>XAI_API_KEY</code>.
                </p>
              </div>

              <div className="mt-5 flex justify-end">
                <Button variant="primary" onClick={() => setSettingsOpen(false)}>Simpan & Tutup</Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {/* Admin Panel — many features */}
        <Dialog.Root open={adminOpen || isAdmin} onOpenChange={(o) => { if (!o) { setAdminOpen(false); if (!isAdmin) setAwaitingAdminKey(false); } }}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-abyss/85" />
            <Dialog.Content className="fixed inset-x-3 top-[4%] z-50 mx-auto max-h-[92dvh] max-w-lg overflow-y-auto rounded-2xl border border-accent/30 bg-depth p-0 shadow-[var(--shadow-glow)] outline-none sm:inset-x-4">
              <div className="sticky top-0 z-10 border-b border-border bg-depth/95 px-5 pt-4 pb-3 backdrop-blur">
                <Dialog.Title className="flex items-center gap-2 font-display text-xl text-foam">
                  <Shield className="size-5 text-accent" /> Admin Panel
                </Dialog.Title>
                <p className="text-xs text-mist">ZUZUXF_AI · Soft Blue</p>
              </div>

              <div className="px-5 py-4">
                {awaitingAdminKey && !isAdmin ? (
                  <div className="space-y-3">
                    <p className="text-sm text-mist">Masukkan key formalitas admin:</p>
                    <input
                      type="password"
                      className="w-full rounded-xl bg-tide px-3 py-2.5 text-sm text-ink ring-1 ring-border"
                      value={adminKeyInput}
                      onChange={(e) => setAdminKeyInput(e.target.value)}
                      placeholder="DEV=ZUZUXF_AI=™X10WDEV"
                      onKeyDown={(e) => e.key === "Enter" && tryAdminKey()}
                    />
                    <Button variant="primary" className="w-full" onClick={tryAdminKey}>Verifikasi Key</Button>
                  </div>
                ) : isAdmin ? (
                  <>
                    {/* Tabs */}
                    <div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-tide/60 p-1">
                      {(["ai", "fitur", "data", "info"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setAdminTab(t)}
                          className={cn(
                            "flex-1 rounded-lg px-2 py-2 text-xs font-medium capitalize transition-colors",
                            adminTab === t ? "bg-accent/20 text-foam ring-1 ring-accent/40" : "text-mist hover:text-ink",
                          )}
                        >
                          {t === "ai" ? "AI" : t === "fitur" ? "Fitur" : t === "data" ? "Data" : "Info"}
                        </button>
                      ))}
                    </div>

                    {adminTab === "ai" && (
                      <div className="space-y-3">
                        <label className="block text-xs font-medium text-mist">System Prompt</label>
                        <textarea className="min-h-28 w-full rounded-xl bg-tide px-3 py-2 text-sm text-ink ring-1 ring-border" value={settings.systemPrompt} onChange={(e) => updateSettings({ systemPrompt: e.target.value })} />

                        <label className="block text-xs font-medium text-mist">Model</label>
                        <input className="w-full rounded-xl bg-tide px-3 py-2 text-sm text-ink ring-1 ring-border" value={settings.model} onChange={(e) => updateSettings({ model: e.target.value })} />

                        <label className="block text-xs font-medium text-mist">Provider</label>
                        <select className="w-full rounded-xl bg-tide px-3 py-2 text-sm text-ink ring-1 ring-border" value={settings.provider} onChange={(e) => updateSettings({ provider: e.target.value as "xai" | "gemini" | "groq" })}>
                          <option value="xai">xAI / Grok</option>
                          <option value="gemini">Gemini</option>
                          <option value="groq">Groq</option>
                        </select>

                        <label className="block text-xs font-medium text-mist">Temperature: {settings.temperature.toFixed(1)}</label>
                        <input type="range" min={0} max={2} step={0.1} className="w-full accent-sky-400" value={settings.temperature} onChange={(e) => updateSettings({ temperature: Number(e.target.value) })} />

                        <label className="block text-xs font-medium text-mist">Max Tokens: {settings.maxTokens}</label>
                        <input type="range" min={512} max={8192} step={256} className="w-full accent-sky-400" value={settings.maxTokens} onChange={(e) => updateSettings({ maxTokens: Number(e.target.value) })} />

                        <label className="block text-xs font-medium text-mist">Welcome Message</label>
                        <input className="w-full rounded-xl bg-tide px-3 py-2 text-sm text-ink ring-1 ring-border" value={settings.welcomeMessage} onChange={(e) => updateSettings({ welcomeMessage: e.target.value })} />
                      </div>
                    )}

                    {adminTab === "fitur" && (
                      <div className="space-y-4">
                        <ToggleRow label="Ambil isi web" desc="Command: tolong ambilin isi web ini [url]" checked={settings.enableWebExtract} onChange={(v) => updateSettings({ enableWebExtract: v })} />
                        <ToggleRow label="Auto-file teks panjang" desc={`Teks > ${LONG_TEXT_LIMIT} jadi file download`} checked={settings.enableLongTextFile} onChange={(v) => updateSettings({ enableLongTextFile: v })} />
                        <ToggleRow label="Generate gambar" desc="Mode Gambar + Versi 1/2" checked={settings.enableImageGen} onChange={(v) => updateSettings({ enableImageGen: v })} />

                        <label className="block text-xs font-medium text-mist">Kata terlarang (pisah koma)</label>
                        <textarea className="min-h-16 w-full rounded-xl bg-tide px-3 py-2 text-sm text-ink ring-1 ring-border" placeholder="kata1, kata2" value={settings.bannedWords} onChange={(e) => updateSettings({ bannedWords: e.target.value })} />

                        <label className="block text-xs font-medium text-mist">Ukuran font: {Math.round(settings.fontScale * 100)}%</label>
                        <input type="range" min={0.85} max={1.25} step={0.05} className="w-full accent-sky-400" value={settings.fontScale} onChange={(e) => updateSettings({ fontScale: Number(e.target.value) })} />

                        <label className="block text-xs font-medium text-mist">Image Version default</label>
                        <select className="w-full rounded-xl bg-tide px-3 py-2 text-sm text-ink ring-1 ring-border" value={settings.imageVersion} onChange={(e) => updateSettings({ imageVersion: e.target.value as ImageVersion })}>
                          <option value="1">Versi 1</option>
                          <option value="2">Versi 2</option>
                        </select>
                      </div>
                    )}

                    {adminTab === "data" && (
                      <div className="space-y-3">
                        <p className="text-sm text-mist">Percakapan tersimpan: <strong className="text-foam">{conversations.length}</strong></p>
                        <Button variant="quiet" className="w-full justify-start gap-2" onClick={exportSettings}>
                          <Download className="size-4" /> Export settings (JSON)
                        </Button>
                        <Button variant="quiet" className="w-full justify-start gap-2" onClick={() => { resetSettings(); toast.success("Settings direset"); }}>
                          <RotateCcw className="size-4" /> Reset settings ke default
                        </Button>
                        <Button variant="danger" className="w-full justify-start gap-2" onClick={() => { if (confirm("Hapus SEMUA percakapan?")) { clearAllChats(); toast.success("Semua chat dihapus"); } }}>
                          <Trash2 className="size-4" /> Hapus semua percakapan
                        </Button>
                        <Button variant="danger" className="w-full justify-start gap-2" onClick={() => { setAdmin(false); setAdminOpen(false); toast.message("Logout admin"); }}>
                          <Shield className="size-4" /> Logout Admin
                        </Button>
                      </div>
                    )}

                    {adminTab === "info" && (
                      <div className="space-y-3 text-sm text-mist">
                        <p><strong className="text-foam">Trigger:</strong> <code className="text-accent">FOURDEV/=DEV=KEY</code></p>
                        <p><strong className="text-foam">Key:</strong> <code className="text-accent">DEV=ZUZUXF_AI=™X10WDEV</code></p>
                        <p><strong className="text-foam">API keys file:</strong> <code>.env.example</code> di repo → copy ke <code>.env</code> atau Environment Variables hosting.</p>
                        <p><strong className="text-foam">Variabel env:</strong> XAI_API_KEY, GEMINI_API_KEY, GROQ_API_KEY</p>
                        <p className="rounded-xl bg-tide/50 px-3 py-2 text-xs leading-relaxed">
                          Admin mengontrol AI (prompt, model, provider, temperature), fitur (web, long-text, image, ban words, font), dan data (export, reset, clear chats).
                        </p>
                      </div>
                    )}
                  </>
                ) : null}
              </div>

              <div className="border-t border-border px-5 py-3">
                <Button variant="quiet" className="w-full" onClick={() => { setAdminOpen(false); setAwaitingAdminKey(false); }}>Tutup</Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <Toaster theme="dark" position="top-center" toastOptions={{ classNames: { toast: "bg-lagoon text-ink border-border shadow-[var(--shadow-border)]" } }} />
      </div>
    </TooltipProvider>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-tide/40 px-3 py-3 ring-1 ring-border">
      <input type="checkbox" className="mt-1 size-4 accent-sky-400" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm font-medium text-foam">{label}</span>
        <span className="block text-xs text-mist">{desc}</span>
      </span>
    </label>
  );
}

function EmptyState({ welcome, onPick, onScratch }: { welcome: string; onPick: (p: string) => void; onScratch: () => void }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-4 py-10">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="size-6 text-accent" />
        <p className="font-display text-4xl leading-none tracking-tight text-foam md:text-5xl">ZUZUXF_AI</p>
      </div>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-mist md:text-base">{welcome}</p>
      <ul className="mt-8 grid gap-2.5 sm:grid-cols-2">
        {STARTERS.map((item) => (
          <li key={item.title}>
            <button
              type="button"
              onClick={() => onPick(item.prompt)}
              className="h-full w-full rounded-2xl bg-tide/70 px-4 py-3.5 text-left shadow-[var(--shadow-border)] transition-all duration-150 hover:shadow-[var(--shadow-border-hover)] hover:ring-1 hover:ring-accent/25 active:scale-[0.98]"
            >
              <span className="block text-sm font-medium text-foam">{item.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-mist">{item.blurb}</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onScratch} className="mt-4 self-start rounded-xl px-3 py-2 text-sm text-mist transition-colors hover:text-foam">
        Atau buka ruang kerja kosong →
      </button>
    </div>
  );
}
