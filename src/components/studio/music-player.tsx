import { Music2, Pause, Play, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Track = {
  id: string;
  title: string;
  artist: string;
  url: string;
  cover?: string;
};

export function MusicPanel({
  open,
  onClose,
  onPlayingChange,
}: {
  open: boolean;
  onClose: () => void;
  onPlayingChange?: (playing: boolean, track: Track | null) => void;
}) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    void fetch("/music/playlist.json")
      .then((r) => r.json())
      .then((data: { tracks?: Track[] }) => setTracks(data.tracks ?? []))
      .catch(() => setTracks([]));
  }, []);

  useEffect(() => {
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    const onEnded = () => setPlaying(false);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.pause();
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  useEffect(() => {
    onPlayingChange?.(playing, current);
  }, [playing, current, onPlayingChange]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter(
      (t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q),
    );
  }, [tracks, query]);

  function playTrack(track: Track) {
    const audio = audioRef.current;
    if (!audio) return;
    if (current?.id === track.id) {
      if (playing) {
        audio.pause();
        setPlaying(false);
      } else {
        void audio.play();
        setPlaying(true);
      }
      return;
    }
    audio.src = track.url;
    setCurrent(track);
    void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play();
      setPlaying(true);
    }
  }

  if (!open) {
    return current ? (
      <div className="music-bar">
        <button type="button" className="grid size-9 place-items-center rounded-full bg-white/15" onClick={toggle}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{current.title}</p>
          <p className="truncate text-xs opacity-70">{current.artist}</p>
        </div>
        <button type="button" className="grid size-9 place-items-center rounded-full bg-white/10" onClick={onClose} aria-label="Tutup musik">
          <X className="size-4" />
        </button>
      </div>
    ) : null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-abyss/95 backdrop-blur-sm">
      <header className="flex items-center gap-2 border-b border-border px-3 py-3">
        <Music2 className="size-5 text-accent" />
        <h2 className="font-display text-lg text-foam">Music</h2>
        <Button size="icon" className="ml-auto" aria-label="Tutup" onClick={onClose}>
          <X />
        </Button>
      </header>

      <div className="px-3 py-2">
        <label className="flex items-center gap-2 rounded-xl bg-tide px-3 py-2 shadow-[var(--shadow-border)]">
          <Search className="size-4 text-mist" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari musik…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-mist"
          />
        </label>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto px-3 pb-28">
        {filtered.map((track) => (
          <li key={track.id}>
            <button
              type="button"
              onClick={() => playTrack(track)}
              className={cn(
                "mb-2 flex w-full items-center gap-3 rounded-2xl bg-tide px-3 py-3 text-left shadow-[var(--shadow-border)]",
                current?.id === track.id && "ring-2 ring-accent/40",
              )}
            >
              <span className="grid size-10 place-items-center rounded-xl bg-lagoon text-accent">
                {current?.id === track.id && playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foam">{track.title}</span>
                <span className="block truncate text-xs text-mist">{track.artist}</span>
              </span>
            </button>
          </li>
        ))}
        {filtered.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-mist">
            Belum ada lagu. Tambah di <code className="text-xs">public/music/playlist.json</code>
          </p>
        ) : null}
      </ul>

      {current ? (
        <div className="music-bar">
          <button type="button" className="grid size-9 place-items-center rounded-full bg-white/15" onClick={toggle}>
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{current.title}</p>
            <p className="truncate text-xs opacity-70">{current.artist}</p>
          </div>
          <button type="button" className="grid size-9 place-items-center rounded-full bg-white/10" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
