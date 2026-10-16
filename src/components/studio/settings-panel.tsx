import * as Dialog from "@radix-ui/react-dialog";
import { Music2, Search, Settings, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  APP_VERSION,
  applyTheme,
  hasActiveAccess,
  loadSettings,
  redeemLicense,
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
  const [tab, setTab] = useState<"prompt" | "tampilan" | "keys" | "music" | "akun">("prompt");
  const [s, setS] = useState<UserSettings>(loadSettings);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [q, setQ] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (open) setS(loadSettings());
  }, [open]);

  useEffect(() => {
    void fetch("/music/playlist.json")
      .then((r) => r.json())
      .then((data: { tracks?: Track[] }) => {
        const list = (data.tracks ?? []).filter((t) => isMp3Url(t.url));
        setTracks(data.tracks ?? []);
        const settings = loadSettings();
        if (settings.musicEnabled && settings.musicAutoPlay) {
          const first = list[0];
          if (first) playSilent(first, settings);
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

  const emptySlots = useMemo(() => tracks.filter((t) => !t.url?.trim()).length, [tracks]);

  function persist(next: UserSettings) {
    setS(next);
    saveSettings(next);
  }

  function setTheme(theme: ThemeMode) {
    const next = { ...s, theme };
    persist(next);
    applyTheme(theme);
  }

  function applyCode() {
    const res = redeemLicense(code);
    setMsg(res.message);
    if (res.ok && res.patch) persist({ ...s, ...res.patch });
  }

  function ensureAudio() {
    if (!audioRef.current) audioRef.current = new Audio();
    return audioRef.current;
  }

  function playSilent(t: Track, settings = s) {
    if (!settings.musicEnabled) {
      setMsg("Musik dimatikan di pengaturan.");
      return;
    }
    if (!t.url || !isMp3Url(t.url)) {
      setMsg(`"${t.title}" butuh URL raw .mp3`);
      return;
    }
    const a = ensureAudio();
    a.src = t.url.trim();
    a.loop = false;
    void a
      .play()
      .then(() => {
        setActiveId(t.id);
        setMsg("");
      })
      .catch(() => setMsg("Gagal putar. Cek URL raw / CORS."));
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

  function setMusicEnabled(on: boolean) {
    const next = { ...s, musicEnabled: on };
    persist(next);
    if (!on) stopMusic();
  }

  function setAutoPlay(on: boolean) {
    persist({ ...s, musicAutoPlay: on });
  }

  function loginGmail() {
    window.open("https://accounts.google.com/", "_blank", "noopener,noreferrer");
    const email = window.prompt("Opsional: ketik email Gmail untuk ditampilkan di app") ?? "";
    if (email.trim()) {
      persist({ ...s, gmailEmail: email.trim(), gmailLoggedIn: true });
    }
  }

  function logoutGmail() {
    persist({ ...s, gmailEmail: "", gmailLoggedIn: false });
  }

  const accessLabel = hasActiveAccess(s)
    ? `${s.accessTier} · sampai ${new Date(s.accessUntil).toLocaleString("id-ID")}`
    : "Belum aktif";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-abyss/60" />
        <Dialog.Content className="fixed inset-x-3 top-[8%] z-50 mx-auto max-h-[84dvh] w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-tide shadow-[var(--shadow-border)] outline-none">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <Dialog.Title className="text-sm font-medium text-foam">
              Pengaturan · v{APP_VERSION}
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
                ["prompt", "Prompt"],
                ["tampilan", "Tema"],
                ["keys", "Akses"],
                ["music", "Music"],
                ["akun", "Akun"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium",
                  tab === id ? "bg-lagoon text-foam" : "text-mist hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="max-h-[min(60dvh,28rem)] overflow-y-auto px-4 py-3">
            {tab === "prompt" ? (
              <div className="space-y-3">
                <label className="block text-xs text-mist">Prompt awal</label>
                <textarea
                  className="min-h-24 w-full rounded-xl border border-border bg-depth px-3 py-2 text-sm outline-none"
                  value={s.systemPrompt}
                  onChange={(e) => persist({ ...s, systemPrompt: e.target.value })}
                />
                <label className="block text-xs text-mist">Gaya bahasa</label>
                <input
                  className="w-full rounded-xl border border-border bg-depth px-3 py-2 text-sm outline-none"
                  value={s.personality}
                  onChange={(e) => persist({ ...s, personality: e.target.value })}
                />
              </div>
            ) : null}

            {tab === "tampilan" ? (
              <div className="space-y-3">
                <p className="text-xs text-mist">Tema Ocean Intelligence</p>
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
                <p className="text-[11px] text-mist">
                  Gelap: biru laut + cyan. Terang: putih + biru. Animasi ringan; hormati reduced-motion.
                </p>
              </div>
            ) : null}

            {tab === "keys" ? (
              <div className="space-y-3">
                <div className="rounded-xl bg-lagoon/80 px-3 py-2 text-xs leading-relaxed text-mist">
                  <strong className="text-foam">API key tidak diisi user.</strong>
                  <br />
                  Cloudflare Runtime secrets: GEMINI_API_KEY (V1), GROQ_API_KEY (V2).
                </div>
                <p className="text-xs text-mist">
                  Lisensi: <strong className="text-foam">{accessLabel}</strong>
                </p>
                <label className="block text-xs text-mist">Kode lisensi (opsional)</label>
                <div className="flex gap-2">
                  <input
                    className="min-w-0 flex-1 rounded-xl border border-border bg-depth px-3 py-2 text-sm"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="SAMUDRA-FREE / 20K / PERM"
                  />
                  <Button variant="primary" onClick={applyCode}>
                    Aktifkan
                  </Button>
                </div>
                {msg && tab === "keys" ? <p className="text-xs text-accent-dim">{msg}</p> : null}
              </div>
            ) : null}

            {tab === "music" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-lagoon/70 px-3 py-2">
                  <span className="text-xs text-foam">Musik</span>
                  <button
                    type="button"
                    onClick={() => setMusicEnabled(!s.musicEnabled)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium",
                      s.musicEnabled ? "bg-accent text-white" : "bg-depth text-mist",
                    )}
                  >
                    {s.musicEnabled ? "ON" : "OFF"}
                  </button>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-lagoon/70 px-3 py-2">
                  <span className="text-xs text-foam">Auto play</span>
                  <button
                    type="button"
                    onClick={() => setAutoPlay(!s.musicAutoPlay)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium",
                      s.musicAutoPlay ? "bg-accent text-white" : "bg-depth text-mist",
                    )}
                  >
                    {s.musicAutoPlay ? "ON" : "OFF"}
                  </button>
                </div>
                <p className="text-[11px] text-mist">
                  Hanya MP3 raw. Play background tanpa bar. Slot kosong: {emptySlots}
                </p>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-mist" />
                  <input
                    className="w-full rounded-xl border border-border bg-depth py-2 pr-3 pl-9 text-sm"
                    placeholder="Cari musik…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
                <ul className="max-h-52 space-y-1 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <li className="px-2 py-3 text-xs text-mist">Belum ada MP3 terisi.</li>
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
                          <Music2 className="size-4 text-accent" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-foam">{t.title}</span>
                            <span className="block truncate text-[11px] text-mist">
                              {t.artist}
                              {activeId === t.id ? " · playing" : ""}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
                {msg && tab === "music" ? <p className="text-xs text-accent-dim">{msg}</p> : null}
              </div>
            ) : null}

            {tab === "akun" ? (
              <div className="space-y-3">
                <p className="text-xs text-mist">
                  Login Gmail opsional — penanda lokal, bukan OAuth penuh.
                </p>
                {s.gmailLoggedIn ? (
                  <div className="rounded-xl bg-lagoon/80 px-3 py-3 text-sm text-foam">
                    Masuk sebagai <strong>{s.gmailEmail || "Gmail"}</strong>
                    <div className="mt-2">
                      <Button onClick={logoutGmail}>Keluar</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="primary" className="w-full" onClick={loginGmail}>
                    Login Gmail
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
