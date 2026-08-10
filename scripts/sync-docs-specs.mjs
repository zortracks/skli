import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcFeatures = path.join(root, "specs", "features");
const srcIndex = path.join(root, "specs", "README.md");
const destDir = path.join(root, "docs", "specs");
const destFeatures = path.join(destDir, "features");

await fs.rm(destDir, { recursive: true, force: true });
await fs.mkdir(destFeatures, { recursive: true });

const indexRaw = await fs.readFile(srcIndex, "utf8");
const indexBody = indexRaw.replace(
  /^# Specifications — skli\n/,
  "# Product specifications\n\nThese pages are mirrored from the repository [`specs/`](https://github.com/zortracks/skli/tree/main/specs) tree (source of truth for product behavior).\n\n",
);
await fs.writeFile(path.join(destDir, "index.md"), indexBody, "utf8");

const entries = await fs.readdir(srcFeatures);
for (const name of entries) {
  if (!name.endsWith(".md")) continue;
  const raw = await fs.readFile(path.join(srcFeatures, name), "utf8");
  await fs.writeFile(path.join(destFeatures, name), raw, "utf8");
}

console.log(`Synced ${entries.filter((n) => n.endsWith(".md")).length} feature specs → docs/specs/`);
