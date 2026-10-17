/** Deploy Premium v1.5 — key format & local results (no secrets in client) */

export const APP_VERSION = "1.5";

export const DEPLOY_VIDEO =
  "https://raw.githubusercontent.com/NOVABOTV1F/MUSICPLAYLIST/main/tiktokio.com1791276832_fpiGREmSXwOFVKSZlUUl.mp4";

export const OWNER_WHATSAPP = "085194654911";
export const OWNER_WA_LINK = `https://wa.me/62${OWNER_WHATSAPP.replace(/^0/, "")}`;

/** Format key premium: ZUZUKX😶_103942974V1.5-(huruf/angka random) */
export const PREMIUM_KEY_PREFIX = "ZUZUKX😶_103942974V1.5-";

const RESULTS_KEY = "samudra-deploy-results-v15";
const PREMIUM_SESSION = "samudra-deploy-premium-v15";

export type DeployTarget = "1" | "2" | "3"; // V1 GitHub · V2 Vercel · V3 Cloudflare

export type DeployResult = {
  id: string;
  name: string;
  target: DeployTarget;
  url: string;
  createdAt: number;
  note?: string;
};

export function isPremiumKeyFormat(key: string): boolean {
  const k = key.trim();
  // Terima emoji atau tanpa emoji (kadang keyboard hilangkan)
  if (/^ZUZUKX.?_103942974V1\.5-[A-Za-z0-9]{4,32}$/u.test(k)) return true;
  if (k.startsWith(PREMIUM_KEY_PREFIX) && k.length > PREMIUM_KEY_PREFIX.length + 3) return true;
  return false;
}

/** Generate contoh key (untuk owner) */
export function generatePremiumKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnopqrstuvwxyz";
  let tail = "";
  for (let i = 0; i < 10; i++) tail += chars[Math.floor(Math.random() * chars.length)];
  return `${PREMIUM_KEY_PREFIX}${tail}`;
}

export function loadDeployResults(): DeployResult[] {
  try {
    const raw = localStorage.getItem(RESULTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DeployResult[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDeployResults(list: DeployResult[]) {
  try {
    localStorage.setItem(RESULTS_KEY, JSON.stringify(list.slice(0, 40)));
  } catch {
    /* ignore */
  }
}

export function addDeployResult(r: Omit<DeployResult, "id" | "createdAt">) {
  const item: DeployResult = {
    ...r,
    id: `d_${Date.now().toString(36)}`,
    createdAt: Date.now(),
  };
  const next = [item, ...loadDeployResults()];
  saveDeployResults(next);
  return item;
}

export function removeDeployResult(id: string) {
  saveDeployResults(loadDeployResults().filter((x) => x.id !== id));
}

export function setPremiumSession(ok: boolean) {
  try {
    if (ok) sessionStorage.setItem(PREMIUM_SESSION, "1");
    else sessionStorage.removeItem(PREMIUM_SESSION);
  } catch {
    /* ignore */
  }
}

export function hasPremiumSession(): boolean {
  try {
    return sessionStorage.getItem(PREMIUM_SESSION) === "1";
  } catch {
    return false;
  }
}

export function slugifySiteName(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || "samudra-site"
  );
}
