import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import type { Appointment } from "./types.js";
import { getProjectRoot, isLambda } from "./paths.js";

const TMP_FILE = "/tmp/appointment-bookings.json";
const BLOB_KEY = "appointments";

const BLOB_REQUIRED_ENV = [
  "NETLIFY",
  "NETLIFY_SITE_ID",
  "NETLIFY_AUTH_TOKEN",
  "NETLIFY_TOKEN",
  "NETLIFY_ACCESS_TOKEN",
];

function canUseBlobStore(): boolean {
  return Boolean(process.env.NETLIFY && (process.env.SITE_ID || process.env.NETLIFY_SITE_ID));
}

async function getBlobStore(name: string) {
  const { getStore } = await import("@netlify/blobs");
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

function getLocalAppointmentsFile(): string {
  const root = getProjectRoot();
  return join(root, "backend", "data", "appointments.json");
}

function readFromFile(path: string): Appointment[] {
  if (!path || !existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Appointment[];
  } catch {
    return [];
  }
}

function writeToFile(path: string, items: Appointment[]): void {
  if (!path) return;
  const dir = dirname(path);
  if (dir && dir !== "/tmp" && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(items), "utf-8");
}

async function readFromBlobs(): Promise<Appointment[]> {
  const store = await getBlobStore("appointment-bookings");
  const raw = await store.get(BLOB_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as Appointment[];
}

async function writeToBlobs(items: Appointment[]): Promise<void> {
  const store = await getBlobStore("appointment-bookings");
  await store.set(BLOB_KEY, JSON.stringify(items));
}

async function readAll(): Promise<Appointment[]> {
  if (isLambda) {
    if (!canUseBlobStore()) {
      try {
        const file = getLocalAppointmentsFile();
        if (!existsSync(file)) writeToFile(file, []);
        return readFromFile(file);
      } catch {
        return readFromFile(TMP_FILE);
      }
    }
    try {
      return await readFromBlobs();
    } catch {
      return readFromFile(TMP_FILE);
    }
  }
  const file = getLocalAppointmentsFile();
  if (!existsSync(file)) writeToFile(file, []);
  return readFromFile(file);
}

async function writeAll(items: Appointment[]): Promise<void> {
  if (isLambda) {
    if (!canUseBlobStore()) {
      try {
        writeToFile(getLocalAppointmentsFile(), items);
        return;
      } catch {
        writeToFile(TMP_FILE, items);
        return;
      }
    }
    try {
      await writeToBlobs(items);
      writeToFile(TMP_FILE, items);
      return;
    } catch {
      writeToFile(TMP_FILE, items);
      return;
    }
  }
  writeToFile(getLocalAppointmentsFile(), items);
}

export async function listAppointments(siteSlug?: string): Promise<Appointment[]> {
  const all = await readAll();
  if (!siteSlug) return all;
  return all.filter((a) => a.siteSlug === siteSlug);
}

export async function createAppointment(
  data: Omit<Appointment, "id" | "createdAt">
): Promise<Appointment> {
  const all = await readAll();
  const conflict = all.find(
    (a) => a.siteSlug === data.siteSlug && a.date === data.date && a.time === data.time
  );
  if (conflict) throw new Error("Bu saat dolu. Lütfen başka bir saat seçin.");

  const appointment: Appointment = {
    ...data,
    id: `${data.siteSlug}-${data.date}-${data.time}-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  all.push(appointment);
  await writeAll(all);
  return appointment;
}

export async function deleteAppointmentsForSite(siteSlug: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((a) => a.siteSlug !== siteSlug));
}
