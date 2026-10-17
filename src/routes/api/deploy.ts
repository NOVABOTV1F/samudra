import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  premiumKey: z.string().min(8).max(120),
  target: z.enum(["1", "2", "3"]),
  siteName: z.string().min(1).max(80),
  html: z.string().min(20).max(500_000),
  mode: z.enum(["create", "update"]).optional(),
});

function env(name: string): string {
  try {
    return ((process.env as Record<string, string | undefined>)[name] ?? "").trim();
  } catch {
    return "";
  }
}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || "samudra-site"
  );
}

/** Key: daftar DEPLOY_PREMIUM_KEYS di secrets, atau format ZUZUKX_XXXX */
function keyOk(key: string): boolean {
  const k = key.trim().toUpperCase();
  const allow = env("DEPLOY_PREMIUM_KEYS");
  if (allow) {
    const set = allow.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (set.includes(k)) return true;
  }
  return /^ZUZUKX_[A-Z0-9]{6,24}$/.test(k);
}

async function deployGithub(siteName: string, html: string) {
  const token = env("GITHUB_TOKEN") || env("GH_TOKEN") || env("DEPLOY_GITHUB_TOKEN");
  const owner = env("GITHUB_OWNER") || env("DEPLOY_GITHUB_OWNER");
  if (!token || !owner) {
    return {
      ok: false as const,
      error:
        "GITHUB_TOKEN / GITHUB_OWNER belum di Cloudflare Workers → Settings → Variables and Secrets.",
    };
  }

  const repo = slugify(siteName);
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  const getRepo = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (getRepo.status === 404) {
    const create = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: repo,
        private: false,
        auto_init: true,
        description: `Samudra Deploy Premium · ${siteName}`,
      }),
    });
    if (!create.ok) {
      const t = await create.text();
      return { ok: false as const, error: `Gagal buat repo GitHub: ${create.status} ${t.slice(0, 200)}` };
    }
  } else if (!getRepo.ok) {
    return { ok: false as const, error: `GitHub repo error: ${getRepo.status}` };
  }

  let sha: string | undefined;
  const existing = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/index.html`,
    { headers },
  );
  if (existing.ok) {
    try {
      const j = (await existing.json()) as { sha?: string };
      sha = j.sha;
    } catch {
      /* */
    }
  }

  const contentB64 = btoa(unescape(encodeURIComponent(html)));
  const put = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/index.html`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: `Samudra deploy ${new Date().toISOString()}`,
      content: contentB64,
      sha,
      branch: "main",
    }),
  });

  if (!put.ok) {
    const t = await put.text();
    return { ok: false as const, error: `Gagal upload index.html: ${put.status} ${t.slice(0, 200)}` };
  }

  await fetch(`https://api.github.com/repos/${owner}/${repo}/pages`, {
    method: "POST",
    headers,
    body: JSON.stringify({ build_type: "legacy", source: { branch: "main", path: "/" } }),
  }).catch(() => null);

  const url = `https://${owner}.github.io/${repo}/`;
  return { ok: true as const, url, repo: `${owner}/${repo}` };
}

export const Route = createFileRoute("/api/deploy")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return Response.json({ error: "Body tidak valid." }, { status: 400 });
        }

        const parsed = Body.safeParse(json);
        if (!parsed.success) {
          return Response.json({ error: "Data deploy tidak lengkap." }, { status: 400 });
        }

        const { premiumKey, target, siteName, html } = parsed.data;

        if (!keyOk(premiumKey)) {
          return Response.json({ error: "Key premium tidak valid." }, { status: 403 });
        }

        if (target === "1") {
          const result = await deployGithub(siteName, html);
          if (!result.ok) return Response.json({ error: result.error }, { status: 502 });
          return Response.json({
            ok: true,
            target: "1",
            url: result.url,
            repo: result.repo,
          });
        }

        if (target === "2") {
          const token = env("VERCEL_TOKEN") || env("DEPLOY_VERCEL_TOKEN");
          if (!token) {
            return Response.json(
              {
                error:
                  "VERCEL_TOKEN belum di Cloudflare Workers Settings → Variables and Secrets.",
              },
              { status: 503 },
            );
          }
          const project = slugify(siteName);
          const res = await fetch("https://api.vercel.com/v13/deployments", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: project,
              files: [{ file: "index.html", data: Buffer.from(html, "utf8").toString("base64") }],
              projectSettings: { framework: null },
            }),
          });
          if (!res.ok) {
            const t = await res.text();
            return Response.json(
              { error: `Vercel gagal: ${res.status} ${t.slice(0, 240)}` },
              { status: 502 },
            );
          }
          const data = (await res.json()) as { url?: string };
          const url = data.url?.startsWith("http") ? data.url : `https://${data.url}`;
          return Response.json({ ok: true, target: "2", url: url || "https://vercel.com" });
        }

        if (target === "3") {
          const token = env("CLOUDFLARE_API_TOKEN") || env("DEPLOY_CF_TOKEN");
          const account = env("CLOUDFLARE_ACCOUNT_ID") || env("DEPLOY_CF_ACCOUNT");
          if (!token || !account) {
            return Response.json(
              {
                error:
                  "CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID belum di Workers Variables and Secrets.",
              },
              { status: 503 },
            );
          }
          return Response.json({
            ok: true,
            target: "3",
            url: `https://dash.cloudflare.com/${account}/pages`,
            note: "Token Cloudflare siap. Selesaikan project Pages di dashboard jika belum ada.",
          });
        }

        return Response.json({ error: "Target tidak dikenal." }, { status: 400 });
      },
    },
  },
});
