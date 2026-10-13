import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "src/lib/brain/pathways");
const out = join(root, "src/lib/brain/raw.json");

await mkdir(dir, { recursive: true });

const names = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort();
if (names.length === 0) {
  console.warn("[otak] Belum ada pathways — raw.json kosong.");
}

const pathways = [];
for (const name of names) {
  const pathway = JSON.parse(await readFile(join(dir, name), "utf8"));
  if (!pathway.id || !pathway.answer) {
    throw new Error(`Jalur tidak lengkap: ${name}`);
  }
  pathways.push({
    id: String(pathway.id),
    title: pathway.title ?? pathway.id,
    tags: pathway.tags ?? [],
    keywords: pathway.keywords ?? [],
    patterns: pathway.patterns ?? [],
    priority: pathway.priority ?? 0,
    answer: String(pathway.answer),
  });
}

const raw = {
  name: "samudra-otak",
  version: 1,
  updatedAt: new Date().toISOString(),
  note: "Disusun dari src/lib/brain/pathways. Jangan sunting manual — jalankan npm run brain.",
  count: pathways.length,
  pathways,
};

await writeFile(out, `${JSON.stringify(raw, null, 2)}\n`);
console.log(`[otak] ${pathways.length} jalur → src/lib/brain/raw.json`);
