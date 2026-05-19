import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type { SiteProfile } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const DATA_FILE = join(DATA_DIR, "sites.json");

function ensureDataFile(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DATA_FILE)) writeFileSync(DATA_FILE, "[]", "utf-8");
}

function readAll(): SiteProfile[] {
  ensureDataFile();
  return JSON.parse(readFileSync(DATA_FILE, "utf-8")) as SiteProfile[];
}

function writeAll(sites: SiteProfile[]): void {
  ensureDataFile();
  writeFileSync(DATA_FILE, JSON.stringify(sites, null, 2), "utf-8");
}

export function listSites(): SiteProfile[] {
  return readAll();
}

export function getSite(slug: string): SiteProfile | undefined {
  return readAll().find((s) => s.slug === slug);
}

export function saveSite(profile: SiteProfile): SiteProfile {
  const sites = readAll();
  const index = sites.findIndex((s) => s.slug === profile.slug);
  if (index >= 0) sites[index] = profile;
  else sites.push(profile);
  writeAll(sites);
  return profile;
}

export function deleteSite(slug: string): boolean {
  const sites = readAll();
  const next = sites.filter((s) => s.slug !== slug);
  if (next.length === sites.length) return false;
  writeAll(next);
  return true;
}
