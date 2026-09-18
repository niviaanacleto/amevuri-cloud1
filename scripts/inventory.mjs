import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "INVENTARIO_AUDITORIA.json");
const ignored = new Set(["INVENTARIO_AUDITORIA.json"]);
const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else {
      const relative = path.relative(root, absolute).replaceAll(path.sep, "/");
      if (!ignored.has(relative)) files.push({ absolute, relative });
    }
  }
}
walk(root);
files.sort((a, b) => a.relative.localeCompare(b.relative));
const inventory = {
  release: "5.4.0",
  generated_at: new Date().toISOString(),
  total_files: files.length,
  files: files.map(({ absolute, relative }) => {
    const bytes = fs.readFileSync(absolute);
    return {
      file: relative,
      bytes: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    };
  }),
};
fs.writeFileSync(output, JSON.stringify(inventory, null, 2) + "\n");
console.log(`Inventário atualizado: ${inventory.total_files} arquivos.`);
