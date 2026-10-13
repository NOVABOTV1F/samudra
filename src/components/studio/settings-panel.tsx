import * as Dialog from "@radix-ui/react-dialog";
import { Music2, Pause, Play, Search, Settings, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  hasActiveAccess,
  loadSettings,
  redeemLicense,
  saveSettings,
  type UserSettings,
} from "@/lib/studio/settings";
import { cn } from "@/lib/utils";

type Track = { id: string; title: string; artist: string; url: string; hint?: string };

/** Hanya audio: mp3/m4a/ogg/wav + mp4 (diputar lewat Audio = tanpa video) */
function isAudioUrl(url: string) {
  const u = url.trim().toLowerCase();
  if (!u) return false;
  if (u.startsWith("data:audio/")) return true;
  if (u.startsWith("data:video/mp4")) return true; // audio-only via <audio>
  return /\.(mp3|m4a|aac|ogg|wav|mp4)(\?|#|$)/i.test(u) || /raw\.githubusercontent\.com/i.test(u);
}

function isProbablyVideoOnly(url: string) {
  // webm/mov ditolak; mp4 tetap boleh (audio track saja)
  return /\.(webm|mov|avi|mkv)(\?|#|$)/i.test(url.trim());
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
  const [tab, setTab] = useState<"prompt" | "keys" | "music">("prompt");
  const [s, setS] = useState<UserSettings>(loadSettings);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [q, setQ] = useState("");
  const [current, setCurrent] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (open) setS(loadSettings());
  }, [open]);

  useEffect(() => {
    void fetch("/music/playlist.json")
      .then((r) => r.json())
      .then((data: { tracks?: Track[] }) => setTracks(data.tracks ?? []))
      .catch(() => setTracks([]));
  }, []);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    let list = tracks.filter((t) => t.url && isAudioUrl(t.url) && !isProbablyVideoOnly(t.url));
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

  function applyCode() {
    const res = redeemLicense(code);
    setMsg(res.message);
    if (res.ok && res.patch) persist({ ...s, ...res.patch });
  }

  function playTrack(t: Track) {
    if (!t.url || !isAudioUrl(t.url)) {
      setMsg(`"${t.title}" butuh URL raw audio (mp3/mp4).`);
      return;
    }
    if (isProbablyVideoOnly(t.url)) {
      setMsg("Format video murni tidak didukung. Pakai mp3 atau mp4 (hanya audio yang diputar).");
      return;
    }
    if (!audioRef.current) audioRef.current = new Audio();
    const a = audioRef.current;
    // mp4 ikut lewat <audio> → tidak ada video, hanya soundtrack
    if (current?.id === t.id && playing) {
      a.pause();
      setPlaying(false);
      return;
    }
    a.src = t.url.trim();
    void a
      .play()
      .then(() => {
        setCurrent(t);
        setPlaying(true);
        setMsg(
          /\.mp4(\?|#|$)/i.test(t.url)
            ? "MP4: video diabaikan, hanya musik yang diputar."
            : "",
        );
      })
      .catch(() => {
        setMsg("Gagal putar. Pastikan URL raw bisa diakses (CORS) dan berisi audio.");
      });
    a.onended = () => setPlaying(false);
  }

  function togglePlay() {
    const a = audioRef.current;
    if (!a || !current?.url) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      void a.play();
      setPlaying(true);
    }
  }

  const accessLabel = hasActiveAccess(s)
    ? `${s.accessTier} · sampai ${new Date(s.accessUntil).toLocaleString("id-ID")}`
    : "Belum aktif (otak lokal tetap jalan)";

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-abyss/60" />
          <Dialog.Content className="fixed inset-x-3 top-[8%] z-50 mx-auto max-h-[84dvh] w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-tide shadow-[var(--shadow-border)] outline-none md:inset-x-auto">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <Dialog.Title className="text-sm font-medium text-foam">Pengaturan</Dialog.Title>
              <Dialog.Close asChild>
                <Button size="iconSm" aria-label="Tutup">
                  <X className="size-4" />
                </Button>
              </Dialog.Close>
            </div>

            <div className="flex gap-1 border-b border-border px-2 py-2">
              {(
                [
                  ["prompt", "Prompt"],
                  ["keys", "API Keys"],
                  ["music", "Music"],
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
                  <label className="block text-xs text-mist">Prompt awal / sistem</label>
                  <textarea
                    className="min-h-24 w-full rounded-xl border border-border bg-depth px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-accent/40"
                    value={s.systemPrompt}
                    onChange={(e) => persist({ ...s, systemPrompt: e.target.value })}
                  />
                  <label className="block text-xs text-mist">Gaya bahasa / kepribadian</label>
                  <input
                    className="w-full rounded-xl border border-border bg-depth px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                    value={s.personality}
                    onChange={(e) => persist({ ...s, personality: e.target.value })}
                    placeholder="ramah, ringkas, formal…"
                  />
                </div>
              ) : null}

              {tab === "keys" ? (
                <div className="space-y-3">
                  <p className="rounded-xl bg-lagoon/80 px-3 py-2 text-xs text-mist">
                    Status: <strong className="text-foam">{accessLabel}</strong>
                    <br />
                    <strong>V1 = Gemini</strong> · <strong>V2 = Groq</strong> (tombol di chat)
                  </p>
                  <label className="block text-xs text-mist">Kode lisensi</label>
                  <div className="flex gap-2">
                    <input
                      className="min-w-0 flex-1 rounded-xl border border-border bg-depth px-3 py-2 text-sm outline-none"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="SAMUDRA-FREE / SAMUDRA-20K / SAMUDRA-PERM"
                    />
                    <Button variant="primary" onClick={applyCode}>
                      Aktifkan
                    </Button>
                  </div>
                  {msg && tab === "keys" ? <p className="text-xs text-accent-dim">{msg}</p> : null}

                  <label className="block text-xs text-mist">GEMINI_API_KEY (V1)</label>
                  <input
                    type="password"
                    className="w-full rounded-xl border border-border bg-depth px-3 py-2 text-sm"
                    value={s.geminiKey}
                    onChange={(e) => persist({ ...s, geminiKey: e.target.value })}
                    placeholder="AIza…"
                  />
                  <label className="block text-xs text-mist">GROQ_API_KEY (V2 — rekomendasi)</label>
                  <input
                    type="password"
                    className="w-full rounded-xl border border-border bg-depth px-3 py-2 text-sm"
                    value={s.groqKey}
                    onChange={(e) => persist({ ...s, groqKey: e.target.value })}
                    placeholder="gsk_…"
                  />
                  <p className="text-[11px] text-mist">
                    Isi key → pilih V1/V2 di chat → kirim. Tanpa key = otak lokal.
                  </p>
                </div>
              ) : null}

              {tab === "music" ? (
                <div className="space-y-3">
                  <p className="text-[11px] leading-relaxed text-mist">
                    URL harus <strong>raw</strong> (GitHub raw / link langsung file).
                    <br />
                    <strong>mp3</strong> = musik · <strong>mp4</strong> = hanya audio (video tidak ditampilkan).
                  </p>
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-mist" />
                    <input
                      className="w-full rounded-xl border border-border bg-depth py-2 pr-3 pl-9 text-sm outline-none"
                      placeholder="Cari musik…"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                    />
                  </div>
                  <ul className="max-h-56 space-y-1 overflow-y-auto">
                    {filtered.length === 0 ? (
                      <li className="px-2 py-3 text-xs text-mist">
                        Belum ada track valid. Isi url raw di public/music/playlist.json
                      </li>
                    ) : (
                      filtered.map((t) => (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => playTrack(t)}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-lagoon"
                          >
                            <Music2 className="size-4 shrink-0 text-accent" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-foam">{t.title}</span>
                              <span className="block truncate text-[11px] text-mist">
                                {t.artist}
                                {/\.mp4/i.test(t.url) ? " · mp4 audio-only" : ""}
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
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {current ? (
        <div className="music-bar">
          <button type="button" aria-label={playing ? "Pause" : "Play"} onClick={togglePlay}>
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{current.title}</p>
            <p className="truncate text-[11px] opacity-80">{current.artist}</p>
          </div>
          <button
            type="button"
            aria-label="Tutup pemutar"
            onClick={() => {
              audioRef.current?.pause();
              setPlaying(false);
              setCurrent(null);
            }}
          >
            <X className="size-5" />
          </button>
        </div>
      ) : null}
    </>
  );
}
