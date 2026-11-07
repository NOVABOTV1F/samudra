import * as Dialog from "@radix-ui/react-dialog";
import { Menu, PanelRight } from "lucide-react";
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
import { fetchSystemStatus, streamChat, type SystemStatus } from "@/lib/studio/client";
import { downloadText } from "@/lib/studio/files";
import { extractArtifacts } from "@/lib/studio/parse";
import {
  ADMIN_TRIGGER,
  APP_VERSION,
  accessRemainingLabel,
  applyTheme,
  hasActiveAccess,
  loadSettings,
  HOME_TOOLS,
} from "@/lib/studio/settings";
import { selectActiveChat, useStudioStore } from "@/lib/studio/store";
import { type ActiveArtifact, type ImageVersion } from "@/lib/studio/types";

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
  const renameChat = useStudioStore((state) => state.renameChat);
  const addMessage = useStudioStore((state) => state.addMessage);
  const patchMessage = useStudioStore((state) => state.patchMessage);
  const setStreaming = useStudioStore((state) => state.setStreaming);
  const openArtifact = useStudioStore((state) => state.openArtifact);
  const closeArtifact = useStudioStore((state) => state.closeArtifact);
  const updateArtifactCode = useStudioStore((state) => state.updateArtifactCode);
  const chat = useStudioStore(selectActiveChat);

  const [draft, setDraft] = useState("");
  const [aiVersion, setAiVersion] = useState<ImageVersion>("1");
  const [navOpen, setNavOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [sys, setSys] = useState<SystemStatus | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busy = Boolean(streamingId);

  useEffect(() => {
    hydrate();
    applyTheme(loadSettings().theme);
    void fetchSystemStatus().then(setSys).catch(() => setSys(null));
  }, [hydrate]);

  function ensureChat() {
    if (activeId) return activeId;
    return newChat();
  }

  async function send(text = draft) {
    const prompt = text.trim();
    if (!prompt || busy) return;

    if (prompt === ADMIN_TRIGGER || prompt.toUpperCase() === "/SAMUDRA.PANEL") {
      setDraft("");
      setAdminOpen(true);
      return;
    }

    const gate = loadSettings();
    if (!hasActiveAccess(gate)) {
      const conversationId = ensureChat();
      setDraft("");
      addMessage(conversationId, { role: "user", content: prompt });
      addMessage(conversationId, {
        role: "assistant",
        content:
          "Akses belum aktif.\n\n1. Beli key di bot Telegram\n2. Buka ⚙️ Pengaturan → **Akses**\n3. Tempel **API Key** (format `TODA_…` bertanda tangan dari bot yang sudah terhubung)\n4. Login\n\nBot: https://t.me/AccountStoreID_bot",
      });
      setSettingsOpen(true);
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
      const provider = aiVersion === "1" ? "deepseek" : aiVersion === "3" ? "claude" : "groq";

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
        "Jawab sekuat mungkin: kode lengkap, langkah jelas, contoh siap pakai.",
      ]
        .filter(Boolean)
        .join("\n");

      let assembled = "";
      try {
        await streamChat({
          messages: history.slice(-16),
          signal: controller.signal,
          provider,
          systemPrompt,
          onDelta: (chunk) => {
            assembled += chunk;
            patchMessage(conversationId, assistantId, { content: assembled });
          },
        });
      } catch (cloudErr) {
        const reply = think(prompt, "chat");
        const spilled = spillToFile(reply.text);
        if (spilled) downloadText(spilled.filename, spilled.full, "text/markdown;charset=utf-8");
        assembled = spilled?.preview ?? reply.text;
        const errMsg = cloudErr instanceof Error ? cloudErr.message : "gagal";
        patchMessage(conversationId, assistantId, {
          content:
            assembled +
            `\n\n_Catatan: cloud (${provider}) — ${errMsg}. Cek secrets Cloudflare._`,
          pathway: reply.pathway,
        });
      }

      const found = extractArtifacts(assembled, assistantId).filter((item) => item.runnable);
      if (found[0]) {
        openArtifact({
          conversationId,
          messageId: assistantId,
          artifactId: found[0].id,
          lang: found[0].lang,
          code: found[0].code,
          filename: found[0].filename,
        });
        setDockOpen(true);
      }
    } finally {
      setStreaming(null);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
    setStreaming(null);
  }

  function handleRunArtifact(a: ActiveArtifact) {
    openArtifact(a);
    setDockOpen(true);
  }

  const statusLine = useMemo(() => {
    const s = loadSettings();
    const access = accessRemainingLabel(s);
    const v =
      aiVersion === "1"
        ? "V1 DeepSeek"
        : aiVersion === "3"
          ? "V3 Claude"
          : "V2 Groq";
    return `${v} · ${access} · ${APP_VERSION}`;
  }, [aiVersion, sys]);

  const conversationId = chat?.id ?? activeId ?? "";

  return (
    <TooltipProvider>
      <div className="relative flex h-dvh flex-col overflow-hidden bg-abyss text-ink">
        <OceanBackdrop />
        <header className="relative z-10 flex h-12 items-center gap-2 border-b border-border/70 bg-tide/80 px-3 backdrop-blur-md">
          <Button size="icon" aria-label="Menu" onClick={() => setNavOpen(true)}>
            <Menu className="size-4" />
          </Button>
          <WaveMark />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight text-foam">Samudra</p>
          </div>
          <SettingsButton open={settingsOpen} onOpenChange={setSettingsOpen} />
          <Button
            size="icon"
            aria-label="Artifact"
            onClick={() => setDockOpen(true)}
            disabled={!artifact}
          >
            <PanelRight className="size-4" />
          </Button>
        </header>

        <main className="relative z-10 flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-3 py-6 md:px-4">
            <div className="mx-auto flex max-w-2xl flex-col gap-3">
              {(chat?.messages ?? []).length === 0 ? (
                <div className="space-y-5 pt-6 text-center">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-tide shadow-[var(--shadow-border)]">
                    <WaveMark className="size-8" />
                  </div>
                  <div className="space-y-1.5">
                    <h1 className="text-xl font-semibold tracking-tight text-foam">Samudra</h1>
                    <p className="mx-auto max-w-sm text-sm text-mist">
                      Asisten coding & produk. Login dengan key sewa agar model cloud aktif.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {HOME_TOOLS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="rounded-full border border-border bg-tide px-3.5 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:border-accent/40 hover:shadow-[var(--shadow-border-hover)]"
                        onClick={() => setDraft(t.prompt)}
                      >
                        {t.title}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="text-xs font-medium text-accent-dim underline-offset-2 hover:underline"
                    onClick={() => setSettingsOpen(true)}
                  >
                    Buka Pengaturan → login key
                  </button>
                </div>
              ) : (
                (chat?.messages ?? []).map((m) => (
                  <MessageCard
                    key={m.id}
                    message={m}
                    conversationId={conversationId}
                    streaming={streamingId === m.id}
                    onRun={handleRunArtifact}
                  />
                ))
              )}
            </div>
          </div>

          <Composer
            value={draft}
            onChange={setDraft}
            aiVersion={aiVersion}
            onAiVersion={setAiVersion}
            busy={busy}
            onSend={() => void send()}
            onStop={stop}
            statusLine={statusLine}
          />
        </main>

        <Dialog.Root open={navOpen} onOpenChange={setNavOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-abyss/50" />
            <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-[min(100%,20rem)] outline-none">
              <Sidebar
                conversations={conversations}
                activeId={activeId}
                onNew={() => {
                  newChat();
                  setNavOpen(false);
                }}
                onSelect={(id) => {
                  setActive(id);
                  setNavOpen(false);
                }}
                onDelete={deleteChat}
                onRename={renameChat}
                onClose={() => setNavOpen(false)}
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <ArtifactDock
          open={dockOpen}
          onOpenChange={setDockOpen}
          artifact={artifact}
          onClose={closeArtifact}
          onCodeChange={updateArtifactCode}
        />

        <AdminPanel open={adminOpen} onOpenChange={setAdminOpen} />
        <Toaster position="top-center" />
      </div>
    </TooltipProvider>
  );
}
