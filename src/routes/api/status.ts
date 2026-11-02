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
        const deepseek = Boolean(
          envKey(["FREEMODEL_API_KEY", "DEEPSEEK_API_KEY", "FM_API_KEY"]),
        );
        const groq = Boolean(envKey(["GROQ_API_KEY"]));
        const gemini = Boolean(envKey(["GEMINI_API_KEY", "GOOGLE_API_KEY"]));
        const baseUrl = (process.env.FREEMODEL_BASE_URL || "https://freemodel.in/v1").replace(
          /\/$/,
          "",
        );
        const model =
          (process.env.DEEPSEEK_MODEL || process.env.FREEMODEL_MODEL || "deepseek-v4-pro-0813").trim();

        return Response.json({
          version: "1.6",
          deepseek,
          groq,
          gemini,
          baseUrl,
          model,
          time: new Date().toISOString(),
          /** true = key terpasang (bukan sisa kuota provider — itu di dashboard FreeModel) */
          ready: deepseek || groq || gemini,
        });
      },
    },
  },
});
