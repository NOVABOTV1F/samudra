import { createFileRoute } from "@tanstack/react-router";

function envKey(names: string[]): string {
  for (const n of names) {
    try {
      let v = (process.env as Record<string, string | undefined>)[n];
      if (!v) continue;
      v = v.trim().replace(/^["']|["']$/g, "");
      if (v) return v;
    } catch {
      /* */
    }
  }
  return "";
}

export const Route = createFileRoute("/api/status")({
  server: {
    handlers: {
      GET: async () => {
        const v1 = Boolean(envKey(["FREEMODEL_API_KEY", "DEEPSEEK_API_KEY", "FM_API_KEY"]));
        const v3raw = envKey(["FREEMODELV3", "CODEX_RELAY_KEY", "CODEX_RELAY_API_KEY"]);
        const v3 = Boolean(v3raw);
        const groq = Boolean(envKey(["GROQ_API_KEY"]));
        const accessAdmin = Boolean(envKey(["ACCESS_ADMIN_TOKEN"]));
        const accessHmac = Boolean(envKey(["ACCESS_HMAC_SECRET", "ACCESS_ADMIN_TOKEN"]));
        return Response.json({
          version: "1.8.2",
          deepseek: v1,
          groq,
          claude: v3,
          v3KeyLooksOk: v3raw.startsWith("sk-"),
          access: {
            adminTokenSet: accessAdmin,
            hmacReady: accessHmac,
            sewaReady: accessAdmin && accessHmac,
          },
          models: {
            v1: process.env.DEEPSEEK_MODEL || "deepseek-v4.1-flash",
            v2: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
            v3: process.env.CLAUDE_MODEL || process.env.V3_MODEL || "claude-opus-5",
          },
          endpoints: {
            v1: "https://api.freemodel.dev/v1",
            v3: "https://codex-relay.codes/v1",
          },
          time: new Date().toISOString(),
          ready: v1 || v3 || groq,
        });
      },
    },
  },
});
