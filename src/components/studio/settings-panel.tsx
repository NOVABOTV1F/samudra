import * as Dialog from "@radix-ui/react-dialog";
import { Settings, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  APP_VERSION,
  applyTheme,
  hasActiveAccess,
  loadSettings,
  loginWithAccessKey,
  redeemLicense,
  saveSettings,
  type ThemeMode,
  type UserSettings,
} from "@/lib/studio/settings";
import { cn } from "@/lib/utils";

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
  const [tab, setTab] = useState<"akses" | "tema" | "prompt">("akses");
  const [s, setS] = useState<UserSettings>(loadSettings);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setS(loadSettings());
      setMsg("");
      setCode("");
    }
  }, [open]);

  function persist(next: UserSettings) {
    setS(next);
    saveSettings(next);
  }

  function setTheme(theme: ThemeMode) {
    const next = { ...s, theme };
    persist(next);
    applyTheme(theme);
  }

  async function applyCode() {
    const c = code.trim();
    if (!c) {
      setMsg("Tempel key dulu.");
      return;
    }
    setBusy(true);
    setMsg("Memeriksa…");
    try {
      if (c.startsWith("TODA_") || c.startsWith("toda_")) {
        const res = await loginWithAccessKey(c);
        setMsg(res.message);
        if (res.ok && res.patch) persist({ ...s, ...res.patch });
        return;
      }
      const res = redeemLicense(c);
      setMsg(res.message);
      if (res.ok && res.patch) persist({ ...s, ...res.patch });
    } finally {
      setBusy(false);
    }
  }

  const accessLabel = hasActiveAccess(s)
    ? `Aktif · ${s.accessUser || s.accessTier} · sampai ${new Date(s.accessUntil).toLocaleString("id-ID")}`
    : "Belum login";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed inset-x-3 top-[8%] z-50 mx-auto max-h-[84dvh] w-full max-w-md overflow-hidden rounded-2xl border border-border bg-tide shadow-lg outline-none">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <Dialog.Title className="text-sm font-semibold text-foam">Pengaturan</Dialog.Title>
            <Dialog.Close asChild>
              <Button size="iconSm" aria-label="Tutup">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="flex gap-1 border-b border-border px-3 py-2">
            {(
              [
                ["akses", "Akses"],
                ["tema", "Tema"],
                ["prompt", "Prompt"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium",
                  tab === id ? "bg-accent text-white" : "text-mist",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="max-h-[min(60dvh,28rem)] overflow-y-auto px-4 py-4">
            {tab === "akses" ? (
              <div className="space-y-3">
                <p className="text-sm text-ink">
                  Status: <strong className="text-foam">{accessLabel}</strong>
                </p>
                <p className="text-xs leading-relaxed text-mist">
                  Beli sewa di bot Telegram → dapat <strong className="text-foam">API Key</strong> →
                  tempel di bawah → Login. Satu key untuk satu user, otomatis habis masa aktif.
                </p>
                <a
                  className="block text-xs font-medium text-accent-dim underline"
                  href="https://t.me/AccountStoreID_bot"
                  target="_blank"
                  rel="noreferrer"
                >
                  Buka bot beli key →
                </a>
                <label className="block text-xs text-mist">API Key (TODA_…)</label>
                <textarea
                  className="min-h-[4.5rem] w-full rounded-xl border border-border bg-depth px-3 py-2 font-mono text-xs outline-none"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Tempel key dari bot di sini"
                  spellCheck={false}
                />
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={busy}
                  onClick={() => void applyCode()}
                >
                  {busy ? "Memeriksa…" : "Login"}
                </Button>
                {msg ? <p className="text-xs text-mist">{msg}</p> : null}
                <p className="text-[10px] text-mist/80">Samudra {APP_VERSION}</p>
              </div>
            ) : null}

            {tab === "tema" ? (
              <div className="space-y-3">
                <p className="text-xs text-mist">Pilih tema</p>
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
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
