import * as Dialog from "@radix-ui/react-dialog";
import { Music2, Search, Settings, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  APP_VERSION,
  applyTheme,
  loadSettings,
  saveSettings,
  type ThemeMode,
  type UserSettings,
} from "@/lib/studio/settings";
import { cn } from "@/lib/utils";

type Track = { id: string; title: string; artist: string; url: string };

function isMp3Url(url: string) {
  const u = url.trim().toLowerCase();
  if (!u) return false;
  if (u.startsWith("data:audio/mpeg")) return true;
  if (/\.mp4(\?|#|$)/i.test(u)) return false;
  return /\.mp3(\?|#|$)/i.test(u) || /raw\.githubusercontent\.com/i.test(u);
}

export function SettingsButton({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <>
      <Button size="icon" aria-label="Pengaturan" onClick={() => onOpenChange(true)}>
        <Settings className="size-4" />
      </Button>
      <SettingsPanel open={open} onOpenChange={onOpenChange} />
    </>
  );
}

export function SettingsPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [tab, setTab] = useState<"umum" | "tema" | "prompt" | "music">("umum");
  const [s, setS] = useState<UserSettings>(loadSettings);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [q, setQ] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (open) setS(loadSettings());
  }, [open]);

  useEffect(() => {
    void fetch("/music/playlist.json")
      .then((r) => r.json())
      .then((data: { tracks?: Track[] }) => {
        setTracks(data.tracks ?? []);
        const settings = loadSettings();
        const list = (data.tracks ?? []).filter((t) => isMp3Url(t.url));
        if (settings.musicEnabled && settings.musicAutoPlay && list[0]) {
          playSilent(list[0], settings);
        }
      })
      .catch(() => setTracks([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    let list = tracks.filter((t) => t.url && isMp3Url(t.url));
    if (n) {
      list = list.filter(
        (t) => t.title.toLowerCase().includes(n) || t.artist.toLowerCase().includes(n),
      );
    }
    return list;
  }, [tracks, q]);

  function persist(next: UserSettings) {
    setS(next);
    saveSettings(next);
  }

  function setTheme(theme: ThemeMode) {
    const next = { ...s, theme };
    persist(next);
    applyTheme(theme);
  }

  function ensureAudio() {
    if (!audioRef.current) audioRef.current = new Audio();
    return audioRef.current;
  }

  function playSilent(t: Track, settings = s) {
    if (!settings.musicEnabled) {
      setMsg("Musik dimatikan.");
      return;
    }
    if (!t.url || !isMp3Url(t.url)) {
      setMsg(`\"${t.title}\" butuh URL raw .mp3`);
      return;
    }
    const a = ensureAudio();
    a.src = t.url.trim();
    void a
      .play()
      .then(() => {
        setActiveId(t.id);
        setMsg("");
      })
      .catch(() => setMsg("Gagal putar musik."));
    a.onended = () => setActiveId(null);
  }

  function stopMusic() {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
    setActiveId(null);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-abyss/55" />
        <Dialog.Content className="fixed inset-x-3 top-[7%] z-50 mx-auto max-h-[86dvh] w-full max-w-md overflow-hidden rounded-2xl border border-border bg-tide shadow-[var(--shadow-border)] outline-none">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <Dialog.Title className="text-sm font-semibold text-foam">
              Pengaturan · Samudra {APP_VERSION}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button size="iconSm" aria-label="Tutup">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="flex flex-wrap gap-1 border-b border-border px-2 py-2">
            {(
              [
                ["umum", "Umum"],
                ["tema", "Tema"],
                ["prompt", "Prompt"],
                ["music", "Musik"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium",
                  tab === id ? "bg-accent text-white" : "text-mist hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="max-h-[min(62dvh,30rem)] overflow-y-auto px-4 py-4">
            {tab === "umum" ? (
              <div className="space-y-3 text-sm">
                <p className="rounded-xl bg-lagoon/80 px-3 py-2 text-xs leading-relaxed text-mist">
                  <strong className="text-foam">Samudra AI</strong> — chat bebas, tanpa login key.
                  Model pakai secret Cloudflare (V1 DeepSeek, V2 Groq, V3 Claude).
                </p>
                <p className="text-xs text-mist">
                  V1 = DeepSeek · V2 = Groq · V3 = Claude
                  <br />
                  Pilih di kotak chat bawah.
                </p>
                <label className="flex items-center justify-between rounded-xl bg-depth px-3 py-2 text-xs">
                  <span className="text-foam">Unduh teks panjang otomatis</span>
                  <button
                    type="button"
                    className={cn(
                      "rounded-full px-3 py-1 font-medium",
                      s.autoDownloadLong ? "bg-accent text-white" : "bg-lagoon text-mist",
                    )}
                    onClick={() => persist({ ...s, autoDownloadLong: !s.autoDownloadLong })}
                  >
                    {s.autoDownloadLong ? "ON" : "OFF"}
                  </button>
                </label>
                <label className="flex items-center justify-between rounded-xl bg-depth px-3 py-2 text-xs">
                  <span className="text-foam">Enter untuk kirim</span>
                  <button
                    type="button"
                    className={cn(
                      "rounded-full px-3 py-1 font-medium",
                      s.enterToSend ? "bg-accent text-white" : "bg-lagoon text-mist",
                    )}
                    onClick={() => persist({ ...s, enterToSend: !s.enterToSend })}
                  >
                    {s.enterToSend ? "ON" : "OFF"}
                  </button>
                </label>
              </div>
            ) : null}

            {tab === "tema" ? (
              <div className="space-y-3">
                <p className="text-xs text-mist">Tema tampilan</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["light", "Terang"],
                      ["dark", "Gelap"],
                      ["system", "Sistem"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTheme(id)}
                      className={cn(
                        "rounded-full px-4 py-2 text-xs font-medium",
                        s.theme === id ? "bg-accent text-white" : "bg-depth text-mist",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {tab === "prompt" ? (
              <div className="space-y-3">
                <label className="block text-xs text-mist">Prompt sistem</label>
                <textarea
                  className="min-h-28 w-full rounded-xl border border-border bg-depth px-3 py-2 text-sm outline-none"
                  value={s.systemPrompt}
                  onChange={(e) => persist({ ...s, systemPrompt: e.target.value })}
                />
                <label className="block text-xs text-mist">Gaya bahasa</label>
                <input
                  className="w-full rounded-xl border border-border bg-depth px-3 py-2 text-sm outline-none"
                  value={s.personality}
                  onChange={(e) => persist({ ...s, personality: e.target.value })}
                  placeholder="ramah, jelas, membantu"
                />
              </div>
            ) : null}

            {tab === "music" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-lagoon/70 px-3 py-2">
                  <span className="text-xs text-foam">Musik</span>
                  <button
                    type="button"
                    onClick={() => {
                      const on = !s.musicEnabled;
                      persist({ ...s, musicEnabled: on });
                      if (!on) stopMusic();
                    }}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium",
                      s.musicEnabled ? "bg-accent text-white" : "bg-depth text-mist",
                    )}
                  >
                    {s.musicEnabled ? "ON" : "OFF"}
                  </button>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-mist" />
                  <input
                    className="w-full rounded-xl border border-border bg-depth py-2 pr-3 pl-9 text-sm"
                    placeholder="Cari musik…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
                {msg ? <p className="text-xs text-mist">{msg}</p> : null}
                <ul className="max-h-52 space-y-1 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <li className="px-2 py-3 text-xs text-mist">Belum ada trek MP3.</li>
                  ) : (
                    filtered.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (activeId === t.id) stopMusic();
                            else playSilent(t);
                          }}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-lagoon",
                            activeId === t.id && "bg-lagoon ring-1 ring-accent/40",
                          )}
                        >
                          <Music2 className="size-4 shrink-0 text-accent" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-foam">{t.title}</span>
                            <span className="block truncate text-[11px] text-mist">{t.artist}</span>
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
