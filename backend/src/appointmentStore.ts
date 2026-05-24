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
  return Boolean(
    process.env.NETLIFY &&
    (process.env.SITE_ID || process.env.NETLIFY_SITE_ID) &&
    (process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_TOKEN || process.env.NETLIFY_ACCESS_TOKEN)
  );
}

function blobStoreEnvInfo(): string {
  return `NETLIFY=${Boolean(process.env.NETLIFY)}, SITE_ID=${Boolean(process.env.SITE_ID)}, NETLIFY_SITE_ID=${Boolean(process.env.NETLIFY_SITE_ID)}, TOKEN=${Boolean(process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_TOKEN || process.env.NETLIFY_ACCESS_TOKEN)}`;
}

async function getBlobStore(name: string) {
  const { getStore } = await import("@netlify/blobs");
  console.log(`[APPT] Initializing blob store '${name}' with ${blobStoreEnvInfo()}`);
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
  if (isLambda) {
    return TMP_FILE;
  }
  const root = getProjectRoot();
  return join(root, "backend", "data", "appointments.json");
}

function readFromFile(path: string): Appointment[] {
  if (!path || !existsSync(path)) return [];
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as unknown;
    return Array.isArray(raw) ? raw.map(normalizeAppointment) : [];
  } catch {
    console.error("[APPT] Failed to parse local appointments file", path);
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
  const parsed = JSON.parse(raw) as unknown;
  return Array.isArray(parsed) ? parsed.map(normalizeAppointment) : [];
}

function normalizeAppointment(item: unknown): Appointment {
  const data = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
  return {
    id: String(data.id || ""),
    siteSlug: String(data.siteSlug || ""),
    date: String(data.date || ""),
    time: String(data.time || ""),
    customerName: String(data.customerName || ""),
    customerPhone: String(data.customerPhone || ""),
    customerEmail: String(data.customerEmail || ""),
    note: String(data.note || ""),
    createdAt: String(data.createdAt || new Date().toISOString()),
    status:
      data.status === "approved" || data.status === "rejected" || data.status === "pending"
        ? data.status
        : "approved",
    rejectionReason: typeof data.rejectionReason === "string" ? data.rejectionReason : undefined,
  };
}

async function writeToBlobs(items: Appointment[]): Promise<void> {
  const store = await getBlobStore("appointment-bookings");
  await store.set(BLOB_KEY, JSON.stringify(items));
}

async function readAll(): Promise<Appointment[]> {
  if (isLambda) {
    const blobEnabled = canUseBlobStore();
    console.log(`[APPT] readAll running in Lambda. blobEnabled=${blobEnabled}`);
    if (!canUseBlobStore()) {
      try {
        const file = getLocalAppointmentsFile();
        console.log(`[APPT] Blob unavailable, reading local appointments file ${file}`);
        if (!existsSync(file)) writeToFile(file, []);
        return readFromFile(file);
      } catch {
        console.error("[APPT] Local appointments file read failed, falling back to /tmp");
        return readFromFile(TMP_FILE);
      }
    }
    try {
      console.log("[APPT] Blob available, reading appointments from Netlify blobs");
      return await readFromBlobs();
    } catch {
      console.error("[APPT] Blob appointments read failed");
      return readFromFile(TMP_FILE);
    }
  }
  const file = getLocalAppointmentsFile();
  if (!existsSync(file)) writeToFile(file, []);
  return readFromFile(file);
}

async function writeAll(items: Appointment[]): Promise<void> {
  if (isLambda) {
    const blobEnabled = canUseBlobStore();
    console.log(`[APPT] writeAll running in Lambda. blobEnabled=${blobEnabled}`);
    if (!canUseBlobStore()) {
      try {
        console.log("[APPT] Blob unavailable, writing local appointments file");
        writeToFile(getLocalAppointmentsFile(), items);
        return;
      } catch {
        console.error("[APPT] Local appointments file write failed, falling back to /tmp");
        writeToFile(TMP_FILE, items);
        return;
      }
    }
    try {
      console.log("[APPT] Blob available, writing appointments to Netlify blobs");
      await writeToBlobs(items);
      writeToFile(TMP_FILE, items);
      return;
    } catch {
      console.error("[APPT] Blob appointments write failed");
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
  data: Omit<Appointment, "id" | "createdAt" | "status">
): Promise<Appointment> {
  const all = await readAll();
  const conflict = all.find(
    (a) =>
      a.siteSlug === data.siteSlug &&
      a.date === data.date &&
      a.time === data.time &&
      a.status !== "rejected"
  );
  if (conflict) throw new Error("Bu saat dolu. Lütfen başka bir saat seçin.");

  const appointment: Appointment = {
    ...data,
    id: `${data.siteSlug}-${data.date}-${data.time}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  all.push(appointment);
  await writeAll(all);
  return appointment;
}

export async function updateAppointmentStatus(
  siteSlug: string,
  appointmentId: string,
  status: "approved" | "rejected",
  rejectionReason?: string
): Promise<Appointment> {
  const all = await readAll();
  const appointment = all.find((a) => a.siteSlug === siteSlug && a.id === appointmentId);
  if (!appointment) throw new Error("Randevu bulunamadı.");
  appointment.status = status;
  appointment.rejectionReason = status === "rejected" ? String(rejectionReason || "") : undefined;
  await writeAll(all);
  return appointment;
}

export async function deleteAppointmentsForSite(siteSlug: string): Promise<void> {
  const all = await readAll();
  await writeAll(all.filter((a) => a.siteSlug !== siteSlug));
}
