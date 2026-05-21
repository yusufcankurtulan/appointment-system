import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import type { SiteProfile } from "./types.js";
import { getLocalDataFile, isLambda } from "./paths.js";
import { normalizeSite } from "./normalize.js";
import { deleteAppointmentsForSite } from "./appointmentStore.js";

const TMP_DATA_FILE = "/tmp/appointment-sites.json";
const BLOB_KEY = "sites";

const BLOB_REQUIRED_ENV = [
  "NETLIFY",
  "NETLIFY_SITE_ID",
  "NETLIFY_AUTH_TOKEN",
  "NETLIFY_TOKEN",
  "NETLIFY_ACCESS_TOKEN",
];

function canUseBlobStore(): boolean {
  return Boolean(
    process.env.NETLIFY_SITE_ID &&
    (
      process.env.NETLIFY_AUTH_TOKEN ||
      process.env.NETLIFY_TOKEN ||
      process.env.NETLIFY_ACCESS_TOKEN
    )
  );
}

function readFromFile(path: string): SiteProfile[] {
  if (!path || !existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as SiteProfile[];
  } catch {
    return [];
  }
}

function writeToFile(path: string, sites: SiteProfile[]): void {
  if (!path) return;
  const dir = dirname(path);
  if (dir && dir !== "/tmp" && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(sites), "utf-8");
}

async function readFromBlobs(): Promise<SiteProfile[]> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: "appointment-sites", consistency: "strong" });
  const raw = await store.get(BLOB_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as SiteProfile[];
}

async function writeToBlobs(sites: SiteProfile[]): Promise<void> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: "appointment-sites", consistency: "strong" });
  await store.set(BLOB_KEY, JSON.stringify(sites));
}

async function readAll(): Promise<SiteProfile[]> {
  if (isLambda) {
    if (!canUseBlobStore()) {
      return readFromFile(TMP_DATA_FILE);
    }
    try {
      return await readFromBlobs();
    } catch {
      return readFromFile(TMP_DATA_FILE);
    }
  }
  const dataFile = getLocalDataFile();
  if (!existsSync(dataFile)) writeToFile(dataFile, []);
  return readFromFile(dataFile);
}

async function writeAll(sites: SiteProfile[]): Promise<void> {
  if (isLambda) {
    if (!canUseBlobStore()) {
      writeToFile(TMP_DATA_FILE, sites);
      return;
    }
    try {
      await writeToBlobs(sites);
      writeToFile(TMP_DATA_FILE, sites);
      return;
    } catch {
      writeToFile(TMP_DATA_FILE, sites);
      return;
    }
  }
  writeToFile(getLocalDataFile(), sites);
}

export async function listSites(): Promise<SiteProfile[]> {
  return (await readAll()).map((s) => normalizeSite(s));
}

export async function getSite(slug: string): Promise<SiteProfile | undefined> {
  const site = (await readAll()).find((s) => s.slug === slug);
  return site ? normalizeSite(site) : undefined;
}

export async function saveSite(profile: SiteProfile): Promise<SiteProfile> {
  const normalized = normalizeSite(profile);
  const sites = await readAll();
  const index = sites.findIndex((s) => s.slug === normalized.slug);
  if (index >= 0) sites[index] = normalized;
  else sites.push(normalized);
  await writeAll(sites);
  return normalized;
}

export async function deleteSite(slug: string): Promise<boolean> {
  const sites = await readAll();
  const next = sites.filter((s) => s.slug !== slug);
  if (next.length === sites.length) return false;
  await writeAll(next);
  await deleteAppointmentsForSite(slug);
  return true;
}
