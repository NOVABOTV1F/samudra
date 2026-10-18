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

function keyOk(key: string): boolean {
  const k = key.trim().toUpperCase();
  const allow = env("DEPLOY_PREMIUM_KEYS");
  if (allow) {
    const set = allow.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (set.includes(k)) return true;
  }
  return /^ZUZUKX_[A-Z0-9]{6,24}$/.test(k);
}

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Samudra-Deploy",
  };
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function deployGithub(siteName: string, html: string) {
  const token = env("GITHUB_TOKEN") || env("GH_TOKEN") || env("DEPLOY_GITHUB_TOKEN");
  let owner = env("GITHUB_OWNER") || env("DEPLOY_GITHUB_OWNER");
  if (!token) {
    return {
      ok: false as const,
      error:
        "GITHUB_TOKEN belum di Cloudflare. Buat PAT (classic) scope repo → Variables and Secrets.",
    };
  }

  const headers = ghHeaders(token);

  // Pastikan token valid + ambil login jika OWNER kosong
  const me = await fetch("https://api.github.com/user", { headers });
  if (me.status === 401) {
    return {
      ok: false as const,
      error: "GITHUB_TOKEN invalid / expired. Buat PAT baru (classic, centang repo).",
    };
  }
  if (me.status === 403) {
    const t = await me.text();
    return {
      ok: false as const,
      error: `GitHub 403 token: cek scope repo & SSO authorize. ${t.slice(0, 120)}`,
    };
  }
  if (me.ok) {
    try {
      const u = (await me.json()) as { login?: string };
      if (!owner && u.login) owner = u.login;
    } catch {
      /* */
    }
  }
  if (!owner) {
    return {
      ok: false as const,
      error: "GITHUB_OWNER belum di-set (username GitHub kamu).",
    };
  }

  const repo = slugify(siteName);
  const repoUrl = `https://api.github.com/repos/${owner}/${repo}`;

  let getRepo = await fetch(repoUrl, { headers });

  // 403 sering = token tidak boleh akses repo orang lain / SSO
  if (getRepo.status === 403) {
    const t = await getRepo.text();
    return {
      ok: false as const,
      error: `GitHub 403 akses repo. Pastikan GITHUB_OWNER = username pemilik token, PAT classic scope "repo". ${t.slice(0, 100)}`,
    };
  }

  if (getRepo.status === 404) {
    const create = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: repo,
        private: false,
        auto_init: true,
        description: `Samudra Deploy · ${siteName}`,
      }),
    });
    if (!create.ok) {
      // Coba org endpoint jika owner beda dari user
      const createOrg = await fetch(`https://api.github.com/orgs/${owner}/repos`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: repo,
          private: false,
          auto_init: true,
          description: `Samudra Deploy · ${siteName}`,
        }),
      });
      if (!createOrg.ok) {
        const t = await create.text();
        const t2 = await createOrg.text();
        return {
          ok: false as const,
          error: `Gagal buat repo: ${create.status}/${createOrg.status}. ${t.slice(0, 100)} ${t2.slice(0, 80)}`,
        };
      }
    }
    // Tunggu repo siap
    for (let i = 0; i < 8; i++) {
      await sleep(800);
      getRepo = await fetch(repoUrl, { headers });
      if (getRepo.ok) break;
    }
  } else if (!getRepo.ok) {
    return { ok: false as const, error: `GitHub repo error: ${getRepo.status}` };
  }

  let sha: string | undefined;
  const existing = await fetch(`${repoUrl}/contents/index.html`, { headers });
  if (existing.ok) {
    try {
      const j = (await existing.json()) as { sha?: string };
      sha = j.sha;
    } catch {
      /* */
    }
  }

  const contentB64 = btoa(unescape(encodeURIComponent(html)));
  const putBody: Record<string, unknown> = {
    message: `Samudra deploy ${new Date().toISOString()}`,
    content: contentB64,
    branch: "main",
  };
  if (sha) putBody.sha = sha;

  let put = await fetch(`${repoUrl}/contents/index.html`, {
    method: "PUT",
    headers,
    body: JSON.stringify(putBody),
  });

  // Fallback branch master
  if (!put.ok) {
    const putMaster = { ...putBody, branch: "master" };
    put = await fetch(`${repoUrl}/contents/index.html`, {
      method: "PUT",
      headers,
      body: JSON.stringify(putMaster),
    });
  }

  if (!put.ok) {
    const t = await put.text();
    return {
      ok: false as const,
      error: `Gagal upload index.html: ${put.status} ${t.slice(0, 200)}`,
    };
  }

  await fetch(`${repoUrl}/pages`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      build_type: "legacy",
      source: { branch: "main", path: "/" },
    }),
  }).catch(() => null);

  const url = `https://${owner}.github.io/${repo}/`;
  return { ok: true as const, url, repo: `${owner}/${repo}` };
}

async function deployVercel(siteName: string, html: string) {
  const token = env("VERCEL_TOKEN") || env("DEPLOY_VERCEL_TOKEN");
  if (!token) {
    return {
      ok: false as const,
      error: "VERCEL_TOKEN belum di Cloudflare Variables and Secrets.",
    };
  }
  const project = slugify(siteName);
  const res = await fetch("https://api.vercel.com/v13/deployments?forceNew=1", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: project,
      files: [
        {
          file: "index.html",
          data: Buffer.from(html, "utf8").toString("base64"),
        },
      ],
      projectSettings: { framework: null },
      target: "production",
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false as const, error: `Vercel gagal: ${res.status} ${t.slice(0, 240)}` };
  }
  const data = (await res.json()) as {
    url?: string;
    alias?: string[];
    readyState?: string;
    id?: string;
  };
  // Prefer alias production / clean url
  let url = "";
  if (data.alias && data.alias.length) {
    const a = data.alias.find((x) => !x.includes("-") || x.endsWith(".vercel.app")) || data.alias[0];
    url = a.startsWith("http") ? a : `https://${a}`;
  } else if (data.url) {
    url = data.url.startsWith("http") ? data.url : `https://${data.url}`;
  } else {
    url = `https://${project}.vercel.app`;
  }
  return { ok: true as const, url };
}

async function deployCloudflare(siteName: string, html: string) {
  const token = env("CLOUDFLARE_API_TOKEN") || env("DEPLOY_CF_TOKEN");
  const account = env("CLOUDFLARE_ACCOUNT_ID") || env("DEPLOY_CF_ACCOUNT");
  if (!token || !account) {
    return {
      ok: false as const,
      error:
        "CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID belum di Workers Variables and Secrets.",
    };
  }

  const project = slugify(siteName);
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Buat project Pages jika belum ada
  const list = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${project}`,
    { headers },
  );
  if (list.status === 404) {
    const create = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: project,
          production_branch: "production",
          deployment_configs: {
            production: { env_vars: {} },
            preview: { env_vars: {} },
          },
        }),
      },
    );
    if (!create.ok) {
      const t = await create.text();
      return {
        ok: false as const,
        error: `CF Pages buat project gagal: ${create.status} ${t.slice(0, 200)}`,
      };
    }
  } else if (!list.ok && list.status !== 200) {
    const t = await list.text();
    return {
      ok: false as const,
      error: `CF Pages project error: ${list.status} ${t.slice(0, 160)}`,
    };
  }

  // Direct upload: mulai deployment session
  const start = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${project}/deployments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      // multipart dengan file index.html
      body: (() => {
        const fd = new FormData();
        fd.append(
          "index.html",
          new Blob([html], { type: "text/html" }),
          "index.html",
        );
        return fd;
      })(),
    },
  );

  if (!start.ok) {
    const t = await start.text();
    // Fallback: return pages subdomain expectation
    return {
      ok: false as const,
      error: `CF deploy gagal: ${start.status} ${t.slice(0, 220)}. Token butuh izin Account → Cloudflare Pages → Edit.`,
    };
  }

  try {
    const data = (await start.json()) as {
      success?: boolean;
      result?: { url?: string; subdomain?: string; id?: string };
    };
    const url =
      data.result?.url ||
      (data.result?.subdomain
        ? `https://${data.result.subdomain}`
        : `https://${project}.pages.dev`);
    return { ok: true as const, url };
  } catch {
    return { ok: true as const, url: `https://${project}.pages.dev` };
  }
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
          const result = await deployVercel(siteName, html);
          if (!result.ok) return Response.json({ error: result.error }, { status: 502 });
          return Response.json({ ok: true, target: "2", url: result.url });
        }

        if (target === "3") {
          const result = await deployCloudflare(siteName, html);
          if (!result.ok) return Response.json({ error: result.error }, { status: 502 });
          return Response.json({ ok: true, target: "3", url: result.url });
        }

        return Response.json({ error: "Target tidak dikenal." }, { status: 400 });
      },
    },
  },
});
