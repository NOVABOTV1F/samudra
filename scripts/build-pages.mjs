/** Cloudflare Pages — NITRO_PRESET=cloudflare_pages */
import { spawnSync } from "node:child_process";

process.env.NITRO_PRESET = "cloudflare_pages";
process.env.CF_PAGES = "1";
process.env.CLOUDFLARE = "1";

console.log("[build:pages] NITRO_PRESET=cloudflare_pages");

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
console.log("[build:pages] OK");
