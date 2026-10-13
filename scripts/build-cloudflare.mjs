/** Cloudflare Workers — NITRO_PRESET=cloudflare_module */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

process.env.NITRO_PRESET = process.env.NITRO_PRESET || "cloudflare_module";
process.env.CLOUDFLARE = "1";

console.log(`[build:cf] NITRO_PRESET=${process.env.NITRO_PRESET}`);

const brain = spawnSync("node", ["scripts/compile-brain.mjs"], {
  stdio: "inherit",
  env: process.env,
});
if (brain.status !== 0) process.exit(brain.status ?? 1);

const build = spawnSync("node", ["scripts/with-app-env.mjs", "vite", "build"], {
  stdio: "inherit",
  env: process.env,
});
if (build.status !== 0) process.exit(build.status ?? 1);

spawnSync("node", ["scripts/migrate.mjs"], { stdio: "inherit", env: process.env });

const entry = ".output/server/index.mjs";
if (!existsSync(entry) && process.env.NITRO_PRESET === "cloudflare_module") {
  console.error(`[build:cf] Missing ${entry}`);
  process.exit(1);
}
console.log("[build:cf] OK");
