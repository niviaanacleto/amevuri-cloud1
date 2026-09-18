import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { CATALOG } from "../src/lib/catalog.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(root, "public");
const errors = [];
const required = [
  "index.html",
  "colecao.html",
  "encontre-seu-aroma.html",
  "cumaru-sandalo.html",
  "produto-cumaru-sandalo.html",
  "produto-sakura-musk.html",
  "checkout.html",
  "acompanhar-pedido.html",
  "prive.html",
  "admin-pedidos.html",
  "diagnostico.html",
  "styles.css",
  "script.js",
  "commerce.js",
  "prive.js",
  "404.html",
  "robots.txt",
  "sitemap.xml",
];
for (const f of required)
  if (!fs.existsSync(path.join(pub, f))) errors.push(`Ausente: public/${f}`);
if (fs.existsSync(path.join(pub, "_redirects")))
  errors.push(
    "public/_redirects é incompatível com esta estratégia de rotas do Cloudflare.",
  );
const walk = (d) =>
  fs
    .readdirSync(d, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
    );
const files = walk(pub);
const textFiles = files.filter((f) => /\.(html|js|css|xml|txt)$/i.test(f));
const refs = [];
for (const f of textFiles) {
  const s = fs.readFileSync(f, "utf8");
  const rel = path.relative(pub, f);
  if (s.includes("amevuri.netlify.app"))
    errors.push(`${rel}: URL antiga do Netlify.`);
  if (s.includes("/.netlify/functions/"))
    errors.push(`${rel}: endpoint Netlify antigo.`);
  if (s.includes("5521969126759")) errors.push(`${rel}: WhatsApp antigo.`);
  for (const m of s.matchAll(
    /(?:src|href)=["']([^"'#?]+)|url\(["']?([^"')?#]+)["']?\)/g,
  ))
    refs.push({ from: rel, value: m[1] || m[2] });
}
for (const { from, value } of refs) {
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/api/")
  )
    continue;
  const clean = decodeURIComponent(value).replace(/^\//, "");
  const candidates = path.extname(clean)
    ? [clean]
    : [`${clean}.html`, path.join(clean, "index.html")];
  if (clean === "" || clean === "index.html") continue;
  if (!candidates.some((c) => fs.existsSync(path.join(pub, c))))
    errors.push(`${from}: referência local inexistente ${value}`);
}
for (const f of files.filter((f) => /\.(png|jpe?g|webp|gif|svg)$/i.test(f)))
  if (fs.statSync(f).size === 0)
    errors.push(`${path.relative(pub, f)}: imagem vazia.`);
for (const f of walk(path.join(root, "src"))
  .filter((f) => f.endsWith(".js"))
  .concat(files.filter((f) => f.endsWith(".js")))) {
  try {
    new vm.SourceTextModule(fs.readFileSync(f, "utf8"));
  } catch (e) {
    errors.push(`${path.relative(root, f)}: JavaScript inválido: ${e.message}`);
  }
}
for (const f of files.filter((f) => f.endsWith(".html"))) {
  const source = fs.readFileSync(f, "utf8");
  for (const [, attrs, code] of source.matchAll(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
  )) {
    if (/src\s*=/.test(attrs)) continue;
    try {
      if (/application\/ld\+json/.test(attrs)) JSON.parse(code);
      else new vm.Script(code);
    } catch (e) {
      errors.push(
        `${path.basename(f)}: script embutido inválido: ${e.message}`,
      );
    }
  }
  const visible = source
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, "");
  if (/[-—–]|\b(?:120|60)\s*g\b/.test(visible))
    errors.push(
      `${path.basename(f)}: texto contém hífen, travessão ou peso antigo.`,
    );
}
const checkout = fs.readFileSync(path.join(pub, "checkout.html"), "utf8");
if (/24358|CEP de origem|Estoque inicial/.test(checkout))
  errors.push("Checkout expõe dados internos.");
const commerce = fs.readFileSync(path.join(pub, "commerce.js"), "utf8");
const productBlock = commerce.match(/const PRODUCTS = (\{[\s\S]*?\n  \});/);
if (!productBlock) errors.push("Catálogo do navegador não localizado.");
else {
  const products = new vm.Script("(" + productBlock[1] + ")").runInNewContext(
    {},
    { timeout: 1000 },
  );
  for (const [id, product] of Object.entries(CATALOG)) {
    if (
      products[id]?.size !== product.size ||
      products[id]?.price !== product.price ||
      products[id]?.name !== product.name ||
      products[id]?.fragrance !== product.fragrance
    )
      errors.push(`Catálogos divergentes: ${id}`);
  }
  if (Object.keys(products).length !== Object.keys(CATALOG).length)
    errors.push(
      "Quantidade de produtos divergente entre servidor e navegador.",
    );
}
const wr = fs.readFileSync(path.join(root, "wrangler.jsonc"), "utf8");
const config = JSON.parse(wr);
if (
  config.name !== "amevuri-cloud" ||
  config.main !== "src/index.js" ||
  config.assets?.directory !== "./public" ||
  config.assets?.binding !== "ASSETS" ||
  config.assets?.html_handling !== "drop-trailing-slash" ||
  !config.assets?.run_worker_first?.includes("/api/*") ||
  !config.migrations?.some((m) =>
    m.new_sqlite_classes?.includes("AmevuriStore"),
  )
)
  errors.push("Configuração Cloudflare incompleta.");
if (errors.length) {
  console.error(
    `\nAMEVURI: auditoria falhou (${errors.length} erro(s)):\n- ${errors.join("\n- ")}`,
  );
  process.exit(1);
}
console.log(
  `AMEVURI: auditoria concluída — ${files.length} arquivos públicos, ${refs.length} referências verificadas, JavaScript e configuração Cloudflare válidos.`,
);
