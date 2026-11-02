import { createFileRoute } from "@tanstack/react-router";

function envKey(names: string[]): string {
  for (const n of names) {
    try {
      const v = (process.env as Record<string, string | undefined>)[n];
      if (v?.trim()) return v.trim();
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
        const v3 = Boolean(envKey(["FREEMODELV3", "FREEMODELCLAUDE", "FREEMODEL_CLAUDE", "FE_OA_KEY"]));
        const groq = Boolean(envKey(["GROQ_API_KEY"]));
        return Response.json({
          version: "1.6.8",
          deepseek: v1,
          groq,
          claude: v3,
          models: {
            v1: process.env.DEEPSEEK_MODEL || "deepseek-v4.1-flash",
            v2: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
            v3: process.env.CLAUDE_MODEL || "claude-mythos-preview",
          },
          endpoints: {
            v1: "https://api.freemodel.dev/v1",
            v3: "https://api.freemodel.dev/v1",
          },
          time: new Date().toISOString(),
          ready: v1 || v3 || groq,
        });
      },
    },
  },
});
