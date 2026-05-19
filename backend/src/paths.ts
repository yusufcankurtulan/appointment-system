import { existsSync } from "fs";
import { join } from "path";

export const isLambda = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

/** Netlify/Lambda bundle'da import.meta.url güvenilir değil; process.cwd() kullan. */
export function getProjectRoot(): string {
  const cwd = process.cwd();
  if (existsSync(join(cwd, "site-template"))) return cwd;
  if (existsSync(join(cwd, "backend"))) return cwd;
  if (existsSync(join(cwd, "..", "site-template"))) return join(cwd, "..");
  return cwd;
}

export function getLocalDataFile(): string {
  const root = getProjectRoot();
  const candidates = [
    join(root, "backend", "data", "sites.json"),
    join(root, "data", "sites.json"),
  ];
  for (const file of candidates) {
    if (existsSync(file)) return file;
  }
  return candidates[0];
}
