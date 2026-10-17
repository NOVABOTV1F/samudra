import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  addDeployResult,
  DEPLOY_VIDEO,
  hasPremiumSession,
  isPremiumKeyFormat,
  loadDeployResults,
  OWNER_WA_LINK,
  removeDeployResult,
  setPremiumSession,
  type DeployResult,
  type DeployTarget,
} from "@/lib/studio/deploy";
import { cn } from "@/lib/utils";

type Step = "gate" | "wait16" | "form" | "wait10" | "done";

/** Tema premium halaman: biru muda + putih */
const shell =
  "rounded-2xl border border-sky-200 bg-gradient-to-b from-sky-50 to-white p-4 shadow-sm dark:border-sky-800/40 dark:from-sky-950/40 dark:to-depth";

export function DeployPanel() {
  const [step, setStep] = useState<Step>(hasPremiumSession() ? "form" : "gate");
  const [keyInput, setKeyInput] = useState("");
  const [err, setErr] = useState("");
  const [progress, setProgress] = useState(0);
  const [target, setTarget] = useState<DeployTarget | null>(null);
  const [siteName, setSiteName] = useState("");
  const [fileMode, setFileMode] = useState<"github" | "storage" | "paste" | null>(null);
  const [html, setHtml] = useState("");
  const [results, setResults] = useState<DeployResult[]>(() => loadDeployResults());
  const [lastUrl, setLastUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const savedKeyRef = useRef("");

  useEffect(() => {
    if (step !== "wait16" && step !== "wait10") return;
    const total = step === "wait16" ? 16_000 : 10_000;
    const start = Date.now();
    const tick = window.setInterval(() => {
      const p = Math.min(100, ((Date.now() - start) / total) * 100);
      setProgress(p);
      if (p >= 100) {
        window.clearInterval(tick);
        setStep(step === "wait16" ? "form" : "done");
        setProgress(0);
      }
    }, 100);
    return () => window.clearInterval(tick);
  }, [step]);

  function confirmKey() {
    setErr("");
    if (!isPremiumKeyFormat(keyInput)) {
      setErr("Key tidak valid.");
      return;
    }
    savedKeyRef.current = keyInput.trim();
    setPremiumSession(true);
    setStep("wait16");
  }

  async function onPickStorage(file: File | null) {
    if (!file) return;
    const text = await file.text();
    setHtml(text);
    setFileMode("storage");
  }

  async function runDeploy() {
    setErr("");
    if (!target) {
      setErr("Pilih V1 / V2 / V3.");
      return;
    }
    if (!siteName.trim()) {
      setErr("Isi name website.");
      return;
    }
    if (!html.trim() || html.trim().length < 20) {
      setErr("Siapkan file (index.html).");
      return;
    }

    setStep("wait10");

    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          premiumKey: savedKeyRef.current || keyInput.trim(),
          target,
          siteName: siteName.trim(),
          html,
          mode: "create",
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        url?: string;
        error?: string;
        note?: string;
      };
      if (!res.ok || !data.ok) {
        setErr(data.error || "Deploy gagal.");
        setLastUrl("");
        return;
      }
      const url = data.url || "";
      setLastUrl(url);
      addDeployResult({
        name: siteName.trim(),
        target,
        url,
        note: data.note,
      });
      setResults(loadDeployResults());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Jaringan error.");
      setLastUrl("");
    }
  }

  return (
    <div className="space-y-4">
      {step === "gate" ? (
        <div className={cn(shell, "space-y-3")}>
          <p className="text-sm font-semibold text-sky-800 dark:text-sky-200">Deploy Premium</p>
          <label className="block text-xs text-sky-700/80 dark:text-sky-100/70">Key</label>
          <input
            type="password"
            autoComplete="off"
            className="w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-sky-300 dark:border-sky-700 dark:bg-black/30"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="••••••••••••"
          />
          <Button
            variant="primary"
            className="w-full bg-sky-500 text-white hover:bg-sky-600"
            onClick={confirmKey}
          >
            Confirm
          </Button>
          {err ? <p className="text-xs text-danger">{err}</p> : null}
          <a
            href={OWNER_WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-xs font-medium text-sky-700 underline dark:text-sky-300"
          >
            Chat owner
          </a>
        </div>
      ) : null}

      {step === "wait16" || step === "wait10" ? (
        <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black">
          <video
            className="max-h-full max-w-full object-contain"
            src={DEPLOY_VIDEO}
            autoPlay
            muted
            playsInline
            loop
          />
          <div className="absolute bottom-10 left-6 right-6">
            <div className="h-1 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full bg-sky-400 transition-[width] duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {(step === "form" || step === "done") && (
        <div className={cn(shell, "space-y-4")}>
          <div className="flex justify-center pt-1">
            <div className="size-28 overflow-hidden rounded-full border-2 border-sky-300 shadow-lg">
              <video
                className="size-full object-cover"
                src={DEPLOY_VIDEO}
                autoPlay
                muted
                playsInline
                loop
              />
            </div>
          </div>

          <div className="flex justify-center gap-2">
            {(["1", "2", "3"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setTarget(v)}
                className={cn(
                  "min-w-[4.5rem] rounded-xl px-4 py-2.5 text-sm font-semibold",
                  target === v
                    ? "bg-sky-500 text-white shadow"
                    : "bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100",
                )}
              >
                V{v}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs text-sky-800/70 dark:text-sky-200/70">Name website</label>
            <input
              className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm outline-none dark:border-sky-700 dark:bg-black/20"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="(contoh toko diana)"
            />
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setFileMode("github")}
              className={cn(
                "w-full rounded-xl border px-3 py-2.5 text-left text-xs",
                fileMode === "github"
                  ? "border-sky-500 bg-sky-50 dark:bg-sky-950/50"
                  : "border-sky-100 dark:border-sky-800",
              )}
            >
              Izinkan membaca files GitHub dan meminta izin untuk melihat all files
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={cn(
                "w-full rounded-xl border px-3 py-2.5 text-left text-xs",
                fileMode === "storage"
                  ? "border-sky-500 bg-sky-50 dark:bg-sky-950/50"
                  : "border-sky-100 dark:border-sky-800",
              )}
            >
              Ambil file dari penyimpanan
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".html,text/html"
              className="hidden"
              onChange={(e) => void onPickStorage(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => setFileMode("paste")}
              className={cn(
                "w-full rounded-xl border px-3 py-2.5 text-left text-xs",
                fileMode === "paste"
                  ? "border-sky-500 bg-sky-50 dark:bg-sky-950/50"
                  : "border-sky-100 dark:border-sky-800",
              )}
            >
              Paste files (hanya index.html)
            </button>
            {fileMode === "paste" || fileMode === "github" ? (
              <textarea
                className="min-h-28 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 font-mono text-[11px] outline-none dark:border-sky-700 dark:bg-black/20"
                placeholder={
                  fileMode === "paste" ? "Tempel isi index.html…" : "Tempel HTML / isi file…"
                }
                value={html}
                onChange={(e) => setHtml(e.target.value)}
              />
            ) : null}
            {fileMode === "storage" && html ? (
              <p className="text-[11px] text-ok">
                File dimuat ({html.length.toLocaleString("id-ID")} karakter)
              </p>
            ) : null}
          </div>

          <Button
            variant="primary"
            className="w-full bg-sky-500 font-semibold text-white hover:bg-sky-600"
            onClick={() => void runDeploy()}
          >
            Deploy
          </Button>

          {err ? <p className="text-xs text-danger">{err}</p> : null}

          <div className="space-y-2 border-t border-sky-100 pt-3 dark:border-sky-900">
            <p className="text-xs font-medium text-sky-800 dark:text-sky-200">Hasil deploy</p>
            {lastUrl ? (
              <a
                href={lastUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block break-all text-xs text-sky-600 underline dark:text-sky-300"
              >
                {lastUrl}
              </a>
            ) : null}
            {results.length === 0 ? (
              <p className="text-[11px] text-mist">Belum ada hasil.</p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {results.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-start gap-2 rounded-lg bg-white/80 px-2 py-1.5 text-[11px] dark:bg-black/20"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-foam">{r.name}</span>
                      <span className="text-mist"> · V{r.target}</span>
                      {r.url ? (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 block truncate text-sky-600 underline dark:text-sky-300"
                        >
                          {r.url}
                        </a>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-danger"
                      onClick={() => {
                        removeDeployResult(r.id);
                        setResults(loadDeployResults());
                      }}
                    >
                      Hapus
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
