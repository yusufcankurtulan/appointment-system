import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import type { SiteProfile } from "./types.js";
import { getLocalDataFile, isLambda } from "./paths.js";
import { normalizeSite } from "./normalize.js";
import { deleteAppointmentsForSite } from "./appointmentStore.js";

const TMP_DATA_FILE = "/tmp/appointment-sites.json";
const BLOB_KEY = "sites";

function canUseBlobStore(): boolean {
  return Boolean(
    process.env.NETLIFY &&
    (process.env.SITE_ID || process.env.NETLIFY_SITE_ID)
  );
}

function blobStoreEnvInfo(): string {
  return `NETLIFY=${Boolean(process.env.NETLIFY)}, SITE_ID=${Boolean(process.env.SITE_ID)}, NETLIFY_SITE_ID=${Boolean(process.env.NETLIFY_SITE_ID)}, TOKEN=${Boolean(process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_TOKEN || process.env.NETLIFY_ACCESS_TOKEN)}`;
}

async function getBlobStore(name: string) {
  const { getStore } = await import("@netlify/blobs");
  console.log(`[STORE] Initializing blob store '${name}' with ${blobStoreEnvInfo()}`);
  return getStore({
    name,
    consistency: "strong",
    siteID: process.env.SITE_ID || process.env.NETLIFY_SITE_ID,
    token:
      process.env.NETLIFY_AUTH_TOKEN ||
      process.env.NETLIFY_TOKEN ||
      process.env.NETLIFY_ACCESS_TOKEN,
  });
}

function readFromFile(path: string): SiteProfile[] {
  if (!path || !existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as SiteProfile[];
  } catch (err) {
    console.error("[STORE] Failed to parse local file", path, err);
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
  const store = await getBlobStore("appointment-sites");
  const raw = await store.get(BLOB_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as SiteProfile[];
}

async function writeToBlobs(sites: SiteProfile[]): Promise<void> {
  const store = await getBlobStore("appointment-sites");
  await store.set(BLOB_KEY, JSON.stringify(sites));
}

async function readAll(): Promise<SiteProfile[]> {
  if (isLambda) {
    const blobEnabled = canUseBlobStore();
    console.log(`[STORE] readAll running in Lambda. blobEnabled=${blobEnabled}`);
    if (!blobEnabled) {
      try {
        const dataFile = getLocalDataFile();
        console.log(`[STORE] Blob unavailable, reading local data file ${dataFile}`);
        if (!existsSync(dataFile)) writeToFile(dataFile, []);
        return readFromFile(dataFile);
      } catch (err) {
        console.error("[STORE] Local file read failed, falling back to /tmp", err);
        return readFromFile(TMP_DATA_FILE);
      }
    }
    try {
      console.log("[STORE] Blob available, reading from Netlify blobs");
      return await readFromBlobs();
    } catch (err) {
      console.error("[STORE] Blob read failed", err);
      return readFromFile(TMP_DATA_FILE);
    }
  }
  const dataFile = getLocalDataFile();
  if (!existsSync(dataFile)) writeToFile(dataFile, []);
  return readFromFile(dataFile);
}

async function writeAll(sites: SiteProfile[]): Promise<void> {
  if (isLambda) {
    const blobEnabled = canUseBlobStore();
    console.log(`[STORE] writeAll running in Lambda. blobEnabled=${blobEnabled}`);
    if (!blobEnabled) {
      try {
        console.log("[STORE] Blob unavailable, writing local data file");
        writeToFile(getLocalDataFile(), sites);
        return;
      } catch (err) {
        console.error("[STORE] Local file write failed, falling back to /tmp", err);
        writeToFile(TMP_DATA_FILE, sites);
        return;
      }
    }
    try {
      console.log("[STORE] Blob available, writing to Netlify blobs");
      await writeToBlobs(sites);
      writeToFile(TMP_DATA_FILE, sites);
      return;
    } catch (err) {
      console.error("[STORE] Blob write failed", err);
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
