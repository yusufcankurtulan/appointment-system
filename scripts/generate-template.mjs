import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(root, "site-template", "index.html"), "utf-8");
const out = join(root, "backend", "src", "templateHtml.ts");

writeFileSync(
  out,
  `// Otomatik üretilir — site-template/index.html dosyasını düzenleyin\nexport const SITE_TEMPLATE_HTML = ${JSON.stringify(html)};\n`
);

console.log("templateHtml.ts güncellendi.");
