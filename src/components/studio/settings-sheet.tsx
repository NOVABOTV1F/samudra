import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  tierLabel,
  type AccessTier,
  type StudioSettings,
} from "@/lib/studio/settings";

export function SettingsSheet({
  open,
  onOpenChange,
  onOpenMusic,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onOpenMusic: () => void;
}) {
  const [form, setForm] = useState<StudioSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (open) setForm(loadSettings());
  }, [open]);

  function patch<K extends keyof StudioSettings>(key: K, value: StudioSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    saveSettings(form);
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-abyss/60" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-3xl border border-border bg-tide p-4 shadow-[var(--shadow-border)] md:inset-auto md:top-1/2 md:left-1/2 md:w-[min(32rem,94vw)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl">
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="font-display text-xl text-foam">Pengaturan</Dialog.Title>
            <Dialog.Close asChild>
              <Button size="icon" aria-label="Tutup">
                <X />
              </Button>
            </Dialog.Close>
          </div>

          <section className="space-y-3">
            <Field label="Nama tampilan">
              <input
                className="field"
                value={form.displayName}
                onChange={(e) => patch("displayName", e.target.value)}
              />
            </Field>

            <Field label="Prompt awal (kepribadian AI)">
              <textarea
                className="field min-h-20"
                value={form.systemPrompt}
                onChange={(e) => patch("systemPrompt", e.target.value)}
              />
            </Field>

            <Field label="Gaya bahasa">
              <textarea
                className="field min-h-16"
                value={form.personality}
                onChange={(e) => patch("personality", e.target.value)}
              />
            </Field>

            <Field label="Info penting (diingat AI)">
              <textarea
                className="field min-h-16"
                value={form.importantNotes}
                onChange={(e) => patch("importantNotes", e.target.value)}
                placeholder="Contoh: Nama brand, preferensi coding…"
              />
            </Field>

            <div className="rounded-2xl bg-lagoon/60 p-3">
              <p className="text-sm font-medium text-foam">API Keys & paket</p>
              <p className="mt-1 text-xs text-mist">
                Otak lokal Samudra tetap jalan tanpa key. Paket berbayar / key eksternal opsional.
              </p>
              <div className="mt-3 grid gap-2">
                {(["free", "paid_3w", "permanent"] as AccessTier[]).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => patch("tier", tier)}
                    className={`rounded-xl px-3 py-2 text-left text-sm ${form.tier === tier ? "bg-accent text-white" : "bg-tide text-ink"}`}
                  >
                    {tierLabel(tier)}
                    {tier === "paid_3w" ? " · Rp 20.000" : ""}
                    {tier === "free" ? " · 24 jam" : ""}
                  </button>
                ))}
              </div>

              <Field label="Samudra API key (paket permanen)">
                <input
                  className="field"
                  value={form.samudraApiKey}
                  onChange={(e) => patch("samudraApiKey", e.target.value)}
                  placeholder="smdr_…"
                />
              </Field>

              <Field label="Gemini (opsional V1)">
                <input
                  className="field"
                  value={form.geminiKey}
                  onChange={(e) => patch("geminiKey", e.target.value)}
                  placeholder="AIza…"
                />
              </Field>
              <Field label="Groq (opsional V2 — direkomendasikan)">
                <input
                  className="field"
                  value={form.groqKey}
                  onChange={(e) => patch("groqKey", e.target.value)}
                  placeholder="gsk_…"
                />
              </Field>

              <Field label="Pakai model eksternal">
                <select
                  className="field"
                  value={form.preferExternal}
                  onChange={(e) => patch("preferExternal", e.target.value as StudioSettings["preferExternal"])}
                >
                  <option value="off">Off — otak lokal saja</option>
                  <option value="v1">V1 Gemini</option>
                  <option value="v2">V2 Groq (rekomendasi)</option>
                </select>
              </Field>
            </div>

            <button
              type="button"
              onClick={onOpenMusic}
              className="w-full rounded-2xl bg-depth px-4 py-3 text-left text-sm font-medium text-foam shadow-[var(--shadow-border)]"
            >
              🎵 Music — buka daftar lagu
            </button>

            <p className="text-[11px] text-mist">
              Admin: ketik <code>/SAMUDRA.PANEL</code> di chat, lalu masukkan key admin.
            </p>
          </section>

          <div className="mt-4 flex gap-2">
            <Button className="flex-1" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button className="flex-1 bg-accent text-white" onClick={save}>
              Simpan
            </Button>
          </div>

          <style>{`
            .field {
              width: 100%;
              border-radius: 12px;
              border: 1px solid color-mix(in oklab, #0f2744 12%, transparent);
              background: #fff;
              padding: 0.6rem 0.75rem;
              font-size: 0.9rem;
              color: #0f2744;
              outline: none;
            }
            .field:focus {
              border-color: #4da3ff;
              box-shadow: 0 0 0 3px color-mix(in oklab, #4da3ff 25%, transparent);
            }
          `}</style>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-mist">{label}</span>
      {children}
    </label>
  );
}
