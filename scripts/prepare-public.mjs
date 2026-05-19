import { cpSync, mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(root, "public");

if (existsSync(publicDir)) {
  rmSync(join(publicDir, "dashboard"), { recursive: true, force: true });
  rmSync(join(publicDir, "site-template"), { recursive: true, force: true });
} else {
  mkdirSync(publicDir, { recursive: true });
}

cpSync(join(root, "dashboard"), join(publicDir, "dashboard"), { recursive: true });
cpSync(join(root, "site-template"), join(publicDir, "site-template"), { recursive: true });

writeFileSync(
  join(publicDir, "index.html"),
  `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=/dashboard/">
  <title>Yönlendiriliyor…</title>
</head>
<body>
  <p><a href="/dashboard/">Dashboard'a git</a></p>
</body>
</html>
`
);

writeFileSync(
  join(publicDir, "_redirects"),
  `/api/*  /.netlify/functions/api  200
/site/*  /.netlify/functions/api  200
`
);

console.log("public/ klasörü hazır.");
