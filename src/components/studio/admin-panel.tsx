import * as Dialog from "@radix-ui/react-dialog";
import { Copy, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PREMIUM_KEYS } from "@/lib/studio/deploy";
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
  const [welcome, setWelcome] = useState("Hai! Aku Otak Samudra.");
  const [tab, setTab] = useState<"status" | "konten" | "keys" | "tools" | "sistem">("status");
  const [copied, setCopied] = useState("");
  const [sys, setSys] = useState<SystemStatus | null>(null);
  const [stats, setStats] = useState({ chats: 0, msgs: 0 });
  const [toolQ, setToolQ] = useState("");

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

  async function copyText(t: string) {
    try {
      await navigator.clipboard.writeText(t);
      setCopied(t);
      window.setTimeout(() => setCopied(""), 1500);
    } catch {
      /* */
    }
  }

  const toolsFiltered = QUICK_ACTIONS.filter(
    (t) =>
      !toolQ.trim() ||
      t.title.toLowerCase().includes(toolQ.toLowerCase()) ||
      t.blurb.toLowerCase().includes(toolQ.toLowerCase()),
  );

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
                    ["keys", "Keys"],
                    ["tools", "Tools"],
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
                      Login: {ADMIN_USER} · tools terdaftar: {QUICK_ACTIONS.length}
                    </p>
                    <div className="rounded-xl border border-border bg-depth p-3 text-xs">
                      <p className="mb-2 font-medium text-foam">AI keys (server)</p>
                      <p>V1 DeepSeek: {sys?.deepseek ? "ON" : "OFF"}</p>
                      <p>V2 Groq: {sys?.groq ? "ON" : "OFF"}</p>
                      <p>V3 Claude: {sys?.claude || sys?.deepseek ? "ON" : "OFF"}</p>
                      <p className="mt-2 text-mist">V1 model: {sys?.models?.v1 ?? "deepseek-v4.1-flash"}</p>
                      <p className="text-mist">V3 model: {sys?.models?.v3 ?? "claude-mythos-preview"}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-depth p-3 text-xs">
                      <p className="font-medium text-foam">Lokal perangkat</p>
                      <p className="text-mist">Chat: {stats.chats} · Pesan: {stats.msgs}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-depth p-3 text-[11px] text-mist">
                      <p className="font-medium text-foam">Cloudflare secrets (jangan Add dobel)</p>
                      <p>Kalau nama sudah ada → tekan ikon pensil Edit, bukan + Add.</p>
                      <p className="mt-1">V1: DEEPSEEK_API_KEY / FREEMODEL_API_KEY</p>
                      <p>V2: GROQ_API_KEY</p>
                      <p>V3: FE_OA_KEY (fe_oa_…)</p>
                    </div>
                  </div>
                ) : null}

                {tab === "konten" ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-xs font-medium text-mist">Pengumuman banner</h3>
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
                      <h3 className="text-xs font-medium text-mist">Welcome text</h3>
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
                    <div className="text-xs text-mist">
                      <p className="font-medium text-foam">Kode lisensi user</p>
                      <p>SAMUDRA-FREE · 24 jam</p>
                      <p>SAMUDRA-20K · 3 minggu</p>
                      <p>SAMUDRA-PERM · permanen</p>
                    </div>
                  </div>
                ) : null}

                {tab === "keys" ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-mist">
                      Premium deploy keys ({PREMIUM_KEYS.length}) — salin 1 per user
                    </p>
                    <ul className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-border bg-depth p-2">
                      {PREMIUM_KEYS.map((k) => (
                        <li
                          key={k}
                          className="flex items-center gap-2 rounded-lg px-2 py-1 font-mono text-[11px] hover:bg-lagoon"
                        >
                          <span className="min-w-0 flex-1 truncate text-foam">{k}</span>
                          <button type="button" onClick={() => void copyText(k)} aria-label="Salin">
                            <Copy className="size-3.5 text-mist" />
                          </button>
                          {copied === k ? <span className="text-[10px] text-ok">OK</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {tab === "tools" ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-mist">
                      {QUICK_ACTIONS.length} tools di beranda Samudra (cari di bawah)
                    </p>
                    <input
                      className="w-full rounded-xl border border-border bg-depth px-3 py-2 text-sm"
                      placeholder="Cari tool…"
                      value={toolQ}
                      onChange={(e) => setToolQ(e.target.value)}
                    />
                    <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
                      {toolsFiltered.map((t) => (
                        <li key={t.id} className="rounded-lg bg-depth px-2 py-1.5">
                          <span className="font-medium text-foam">{t.title}</span>
                          <span className="text-mist"> — {t.blurb}</span>
                        </li>
                      ))}
                    </ul>
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
                        if (confirm("Reset pengaturan + pengumuman?")) {
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
                      Buka admin: ketik <code className="text-foam">/SAMUDRA.PANEL</code>
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
