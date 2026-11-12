import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ADMIN_KEY_ALIASES,
  ADMIN_USER,
  APP_VERSION,
  QUICK_ACTIONS,
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
  const [welcome, setWelcome] = useState("Halo! Aku Samudra AI");
  const [tab, setTab] = useState<"status" | "konten" | "sistem">("status");
  const [sys, setSys] = useState<SystemStatus | null>(null);
  const [stats, setStats] = useState({ chats: 0, msgs: 0 });

  useEffect(() => {
    if (!open || step !== "ok") return;
    void fetchSystemStatus().then(setSys);
    try {
      setAnnounce(localStorage.getItem("samudra-announce") ?? "");
      setWelcome(localStorage.getItem("samudra-welcome") ?? "Halo! Aku Samudra AI");
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
    const userOk =
      !u || u.toUpperCase() === ADMIN_USER.toUpperCase() || u.toLowerCase() === "admin";
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

  return (
    <Dialog.Root open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-abyss/70" />
        <Dialog.Content className="fixed inset-x-3 top-[5%] z-[70] mx-auto max-h-[90dvh] w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-tide shadow-[var(--shadow-border)] outline-none">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <Dialog.Title className="text-sm font-medium text-foam">
              Admin · v{APP_VERSION}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button size="iconSm" aria-label="Tutup" onClick={close}>
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>

          {step === "key" ? (
            <div className="space-y-3 p-4">
              <p className="text-xs text-mist">Login admin Samudra</p>
              <label className="block text-[11px] text-mist">Username</label>
              <input
                className="w-full rounded-xl border border-border bg-depth px-3 py-2 text-sm"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="ZUZUXF"
              />
              <label className="block text-[11px] text-mist">Password</label>
              <input
                type="password"
                className="w-full rounded-xl border border-border bg-depth px-3 py-2 text-sm"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="DEV=…"
              />
              {err ? <p className="text-xs text-danger">{err}</p> : null}
              <Button variant="primary" className="w-full" onClick={submitKey}>
                Masuk
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1 border-b border-border px-2 py-2">
                {(
                  [
                    ["status", "Status"],
                    ["konten", "Konten"],
                    ["sistem", "Sistem"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={
                      "rounded-lg px-3 py-1.5 text-xs font-medium " +
                      (tab === id ? "bg-lagoon text-foam" : "text-mist")
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="max-h-[min(70dvh,34rem)] overflow-y-auto p-4 text-sm">
                {tab === "status" ? (
                  <div className="space-y-3">
                    <p className="rounded-xl bg-ok/15 px-3 py-2 text-xs text-ok">
                      Mode: chat bebas · tools: {QUICK_ACTIONS.length}
                    </p>
                    <div className="rounded-xl border border-border bg-depth p-3 text-xs">
                      <p className="mb-2 font-medium text-foam">AI (Cloudflare secrets)</p>
                      <p>V1 DeepSeek: {sys?.deepseek ? "ON" : "OFF"}</p>
                      <p>V2 Groq: {sys?.groq ? "ON" : "OFF"}</p>
                      <p>V3 Claude: {sys?.claude ? "ON" : "OFF"}</p>
                      <p className="mt-2 text-mist">V1: {sys?.models?.v1 ?? "-"}</p>
                      <p className="text-mist">V2: {sys?.models?.v2 ?? "-"}</p>
                      <p className="text-mist">V3: {sys?.models?.v3 ?? "-"}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-depth p-3 text-xs">
                      <p className="font-medium text-foam">Lokal</p>
                      <p className="text-mist">Chat: {stats.chats} · Pesan: {stats.msgs}</p>
                    </div>
                  </div>
                ) : null}

                {tab === "konten" ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-xs font-medium text-mist">Pengumuman</h3>
                      <textarea
                        className="min-h-20 w-full rounded-xl border border-border bg-depth px-3 py-2 text-sm"
                        value={announce}
                        onChange={(e) => setAnnounce(e.target.value)}
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
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xs font-medium text-mist">Teks selamat datang</h3>
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
                    </div>
                  </div>
                ) : null}

                {tab === "sistem" ? (
                  <div className="space-y-3">
                    <Button
                      className="w-full"
                      onClick={() => {
                        if (confirm("Hapus semua chat lokal?")) {
                          localStorage.removeItem("samudra-studio-v1");
                          location.reload();
                        }
                      }}
                    >
                      Hapus semua riwayat chat
                    </Button>
                    <Button
                      className="w-full"
                      onClick={() => {
                        if (confirm("Reset pengaturan?")) {
                          localStorage.removeItem("samudra-settings-v1");
                          localStorage.removeItem("samudra-announce");
                          localStorage.removeItem("samudra-welcome");
                          location.reload();
                        }
                      }}
                    >
                      Reset pengaturan lokal
                    </Button>
                    <Button className="w-full" onClick={() => location.reload()}>
                      Refresh halaman
                    </Button>
                    <p className="text-[10px] text-mist">
                      Admin: ketik <code className="text-foam">/SAMUDRA.PANEL</code>
                    </p>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
