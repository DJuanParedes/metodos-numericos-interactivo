import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, "dist");
const publicFiles = ["index.html", "styles.css", "app.js", "math-engine.js", "numerical.js", "polynomial.js"];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of publicFiles) await cp(join(root, file), join(output, file));
await writeFile(join(output, ".nojekyll"), "", "utf8");
console.log(`Sitio preparado en ${output}`);

