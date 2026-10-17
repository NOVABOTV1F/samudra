import * as Dialog from "@radix-ui/react-dialog";
import { Copy, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PREMIUM_KEYS } from "@/lib/studio/deploy";
import { ADMIN_KEY } from "@/lib/studio/settings";

export function AdminPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [step, setStep] = useState<"key" | "ok">("key");
  const [key, setKey] = useState("");
  const [err, setErr] = useState("");
  const [announce, setAnnounce] = useState("");
  const [welcome, setWelcome] = useState("Hai! Aku Otak Samudra.");
  const [copied, setCopied] = useState("");

  function submitKey() {
    if (key.trim() === ADMIN_KEY) {
      setStep("ok");
      setErr("");
    } else {
      setErr("Key salah.");
    }
  }

  function close() {
    onOpenChange(false);
    setTimeout(() => {
      setStep("key");
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
        <Dialog.Content className="fixed inset-x-3 top-[8%] z-[70] mx-auto max-h-[84dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-tide p-4 shadow-[var(--shadow-border)] outline-none">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-sm font-medium text-foam">Admin Panel Samudra</Dialog.Title>
            <Dialog.Close asChild>
              <Button size="iconSm" aria-label="Tutup" onClick={close}>
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>

          {step === "key" ? (
            <div className="space-y-3">
              <p className="text-xs text-mist">Masukkan key admin formalitas.</p>
              <input
                type="password"
                className="w-full rounded-xl border border-border bg-depth px-3 py-2 text-sm"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="DEV=…"
              />
              {err ? <p className="text-xs text-danger">{err}</p> : null}
              <Button variant="primary" className="w-full" onClick={submitKey}>
                Buka panel
              </Button>
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <p className="rounded-xl bg-ok/15 px-3 py-2 text-xs text-ok">Sukses — admin terbuka.</p>

              <section className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-mist">
                  Key Deploy Premium ({PREMIUM_KEYS.length})
                </h3>
                <p className="text-[11px] text-mist">
                  Format: ZUZUKX_… (tanpa stiker). Bagikan 1 key per user.
                </p>
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border bg-depth p-2">
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
                  placeholder="Pesan di beranda (lokal perangkat ini)"
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
                <h3 className="font-medium text-foam">Lisensi chat</h3>
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

              <section className="space-y-1 text-xs text-mist">
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
              </section>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
