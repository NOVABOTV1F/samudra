import * as Dialog from "@radix-ui/react-dialog";
import { Copy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PREMIUM_KEYS } from "@/lib/studio/deploy";
import {
  ADMIN_KEY,
  ADMIN_KEY_ALIASES,
  ADMIN_USER,
  APP_VERSION,
} from "@/lib/studio/settings";
import { fetchSystemStatus, type SystemStatus } from "@/lib/studio/client";

export function AdminPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [step, setStep] = useState<"key" | "ok">("key");
  const [user, setUser] = useState("");
  const [key, setKey] = useState("");
  const [err, setErr] = useState("");
  const [announce, setAnnounce] = useState("");
  const [welcome, setWelcome] = useState("Hai! Aku Otak Samudra.");
  const [copied, setCopied] = useState("");
  const [sys, setSys] = useState<SystemStatus | null>(null);
  const [stats, setStats] = useState({ chats: 0, msgs: 0 });

  useEffect(() => {
    if (!open || step !== "ok") return;
    void fetchSystemStatus().then(setSys);
    try {
      setAnnounce(localStorage.getItem("samudra-announce") ?? "");
      setWelcome(localStorage.getItem("samudra-welcome") ?? "Hai! Aku Otak Samudra.");
      const raw = localStorage.getItem("samudra-studio-v1");
      if (raw) {
        const data = JSON.parse(raw) as { conversations?: { messages?: unknown[] }[] };
        const convs = data.conversations ?? [];
        setStats({
          chats: convs.length,
          msgs: convs.reduce((n, c) => n + (c.messages?.length ?? 0), 0),
        });
      }
    } catch {
      /* */
    }
  }, [open, step]);

  function submitKey() {
    const u = user.trim();
    const k = key.trim();
    const userOk = !u || u.toUpperCase() === ADMIN_USER.toUpperCase() || u.toLowerCase() === "admin";
    const keyOk = ADMIN_KEY_ALIASES.some((a) => a === k);
    if (userOk && keyOk) {
      setStep("ok");
      setErr("");
    } else {
      setErr("Username atau password salah.");
    }
  }

  function close() {
    onOpenChange(false);
    setTimeout(() => {
      setStep("key");
      setUser("");
      setKey("");
      setErr("");
    }, 200);
  }

  async function copyKey(k: string) {
    try {
      await navigator.clipboard.writeText(k);
      setCopied(k);
      window.setTimeout(() => setCopied(""), 1500);
    } catch {
      /* */
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-abyss/70" />
        <Dialog.Content className="fixed inset-x-3 top-[6%] z-[70] mx-auto max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-tide p-4 shadow-[var(--shadow-border)] outline-none">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-sm font-medium text-foam">
              Admin Panel · v{APP_VERSION}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button size="iconSm" aria-label="Tutup" onClick={close}>
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>

          {step === "key" ? (
            <div className="space-y-3">
              <p className="text-xs text-mist">Login admin Samudra</p>
              <label className="block text-[11px] text-mist">Username</label>
              <input
                className="w-full rounded-xl border border-border bg-depth px-3 py-2 text-sm"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="ZUZUXF"
                autoComplete="username"
              />
              <label className="block text-[11px] text-mist">Password / key</label>
              <input
                type="password"
                className="w-full rounded-xl border border-border bg-depth px-3 py-2 text-sm"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="DEV=…"
                autoComplete="current-password"
              />
              {err ? <p className="text-xs text-danger">{err}</p> : null}
              <Button variant="primary" className="w-full" onClick={submitKey}>
                Masuk
              </Button>
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <p className="rounded-xl bg-ok/15 px-3 py-2 text-xs text-ok">
                Sukses — admin terbuka ({ADMIN_USER})
              </p>

              <section className="space-y-2 rounded-xl border border-border bg-depth p-3">
                <h3 className="text-xs font-medium uppercase tracking-wide text-mist">
                  Status AI real-time
                </h3>
                <ul className="space-y-1 text-xs text-foam">
                  <li>V1 DeepSeek: {sys?.deepseek ? "key ON" : "key OFF"}</li>
                  <li>V2 Groq: {sys?.groq ? "key ON" : "key OFF"}</li>
                  <li>V3 Claude: {sys?.claude || sys?.deepseek ? "key ON" : "key OFF"}</li>
                  <li className="text-mist">Model V1: {sys?.models?.v1 ?? "deepseek-v4.1-flash"}</li>
                  <li className="text-mist">Model V3: {sys?.models?.v3 ?? "claude-mythos-preview"}</li>
                </ul>
              </section>

              <section className="space-y-1 rounded-xl border border-border bg-depth p-3 text-xs">
                <h3 className="font-medium text-foam">Statistik lokal perangkat</h3>
                <p className="text-mist">Chat: {stats.chats} · Pesan: {stats.msgs}</p>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-mist">
                  Key Deploy Premium ({PREMIUM_KEYS.length})
                </h3>
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border bg-depth p-2">
                  {PREMIUM_KEYS.map((k) => (
                    <li
                      key={k}
                      className="flex items-center gap-2 rounded-lg px-2 py-1 font-mono text-[11px] hover:bg-lagoon"
                    >
                      <span className="min-w-0 flex-1 truncate text-foam">{k}</span>
                      <button
                        type="button"
                        className="shrink-0 text-mist hover:text-accent"
                        aria-label={`Salin ${k}`}
                        onClick={() => void copyKey(k)}
                      >
                        <Copy className="size-3.5" />
                      </button>
                      {copied === k ? <span className="text-[10px] text-ok">OK</span> : null}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-mist">Pengumuman</h3>
                <textarea
                  className="min-h-16 w-full rounded-xl border border-border bg-depth px-3 py-2 text-sm"
                  value={announce}
                  onChange={(e) => setAnnounce(e.target.value)}
                  placeholder="Pesan banner beranda"
                />
                <Button
                  onClick={() => {
                    try {
                      localStorage.setItem("samudra-announce", announce);
                    } catch {
                      /* */
                    }
                  }}
                >
                  Simpan pengumuman
                </Button>
              </section>

              <section className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-mist">Welcome</h3>
                <input
                  className="w-full rounded-xl border border-border bg-depth px-3 py-2 text-sm"
                  value={welcome}
                  onChange={(e) => setWelcome(e.target.value)}
                />
                <Button
                  onClick={() => {
                    try {
                      localStorage.setItem("samudra-welcome", welcome);
                    } catch {
                      /* */
                    }
                  }}
                >
                  Simpan welcome
                </Button>
              </section>

              <section className="space-y-1 text-xs text-mist">
                <h3 className="font-medium text-foam">Lisensi chat user</h3>
                <p>
                  <code>SAMUDRA-FREE</code> · 24 jam
                </p>
                <p>
                  <code>SAMUDRA-20K</code> · 3 minggu
                </p>
                <p>
                  <code>SAMUDRA-PERM</code> · permanen
                </p>
              </section>

              <section className="space-y-2 text-xs">
                <h3 className="font-medium text-foam">Sistem</h3>
                <Button
                  onClick={() => {
                    if (confirm("Hapus semua chat di perangkat ini?")) {
                      localStorage.removeItem("samudra-studio-v1");
                      location.reload();
                    }
                  }}
                >
                  Hapus semua riwayat lokal
                </Button>
                <Button
                  onClick={() => {
                    if (confirm("Reset pengaturan + pengumuman lokal?")) {
                      localStorage.removeItem("samudra-settings-v1");
                      localStorage.removeItem("samudra-announce");
                      localStorage.removeItem("samudra-welcome");
                      location.reload();
                    }
                  }}
                >
                  Reset pengaturan lokal
                </Button>
              </section>

              <p className="text-[10px] text-mist">
                Buka panel: ketik <code className="text-foam">/SAMUDRA.PANEL</code> di chat
              </p>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
