import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "src/lib/brain/pathways");
const names = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort();
const pathways = [];
for (const name of names) {
  const pathway = JSON.parse(await readFile(join(dir, name), "utf8"));
  if (!pathway.id || !pathway.answer) {
    throw new Error(`Jalur tidak lengkap: ${name}`);
  }
  pathways.push(pathway);
}
const raw = {
  name: "samudra-otak",
  note: "Disusun dari src/lib/brain/pathways. Jangan sunting berkas ini.",
  pathways,
};
await writeFile(join(root, "src/lib/brain/raw.json"), `${JSON.stringify(raw)}\n`);
console.log(`[otak] ${pathways.length} jalur -> src/lib/brain/raw.json`);
