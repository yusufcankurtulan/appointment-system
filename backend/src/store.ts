import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type { SiteProfile } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const DATA_FILE = join(DATA_DIR, "sites.json");
const TMP_DATA_FILE = "/tmp/appointment-sites.json";
const BLOB_KEY = "sites";

const useNetlifyBlobs = Boolean(process.env.NETLIFY) || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

function ensureDataFile(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DATA_FILE)) writeFileSync(DATA_FILE, "[]", "utf-8");
}

function readFromFile(path: string): SiteProfile[] {
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf-8")) as SiteProfile[];
}

function writeToFile(path: string, sites: SiteProfile[]): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(sites, null, 2), "utf-8");
}

async function readFromBlobs(): Promise<SiteProfile[]> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore("appointment-sites");
  const raw = await store.get(BLOB_KEY, { type: "text" });
  if (!raw) return [];
  return JSON.parse(raw) as SiteProfile[];
}

async function writeToBlobs(sites: SiteProfile[]): Promise<void> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore("appointment-sites");
  await store.set(BLOB_KEY, JSON.stringify(sites));
}

async function readAll(): Promise<SiteProfile[]> {
  if (useNetlifyBlobs) {
    try {
      return await readFromBlobs();
    } catch {
      return readFromFile(TMP_DATA_FILE);
    }
  }
  ensureDataFile();
  return readFromFile(DATA_FILE);
}

async function writeAll(sites: SiteProfile[]): Promise<void> {
  if (useNetlifyBlobs) {
    try {
      await writeToBlobs(sites);
      return;
    } catch {
      writeToFile(TMP_DATA_FILE, sites);
      return;
    }
  }
  ensureDataFile();
  writeToFile(DATA_FILE, sites);
}

export async function listSites(): Promise<SiteProfile[]> {
  return readAll();
}

export async function getSite(slug: string): Promise<SiteProfile | undefined> {
  return (await readAll()).find((s) => s.slug === slug);
}

export async function saveSite(profile: SiteProfile): Promise<SiteProfile> {
  const sites = await readAll();
  const index = sites.findIndex((s) => s.slug === profile.slug);
  if (index >= 0) sites[index] = profile;
  else sites.push(profile);
  await writeAll(sites);
  return profile;
}

export async function deleteSite(slug: string): Promise<boolean> {
  const sites = await readAll();
  const next = sites.filter((s) => s.slug !== slug);
  if (next.length === sites.length) return false;
  await writeAll(next);
  return true;
}
