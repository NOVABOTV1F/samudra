/**
 * Cloudflare Workers build — always force Nitro cloudflare_module preset.
 * Dashboard Build command MUST be: npm run build:cf
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

process.env.NITRO_PRESET = "cloudflare_module";
process.env.CLOUDFLARE = "1";

console.log("[build:cf] NITRO_PRESET=cloudflare_module");

const build = spawnSync(
  "node",
  ["scripts/with-app-env.mjs", "vite", "build"],
  { stdio: "inherit", env: process.env, shell: false },
);

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const migrate = spawnSync("node", ["scripts/migrate.mjs"], {
  stdio: "inherit",
  env: process.env,
});
if (migrate.status !== 0) {
  process.exit(migrate.status ?? 1);
}

const entry = ".output/server/index.mjs";
if (!existsSync(entry)) {
  console.error(
    `[build:cf] ERROR: ${entry} tidak ada. Nitro mungkin masih build preset lain. Cek log "preset: cloudflare_module".`,
  );
  process.exit(1);
}

console.log(`[build:cf] OK — ${entry} siap untuk wrangler deploy`);
