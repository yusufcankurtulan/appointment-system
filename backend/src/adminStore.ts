import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { dirname, join } from "path";
import { getProjectRoot, isLambda } from "./paths.js";

export interface AdminSettings {
  username: string;
  passwordHash: string;
  passwordSalt: string;
  email: string;
  displayName: string;
  defaultWorkStart: string;
  defaultWorkEnd: string;
  defaultWorkDays: string;
  defaultSlotDuration: number;
  updatedAt: string;
}

const TMP_FILE = "/tmp/appointment-admin.json";
const BLOB_KEY = "admin";

function getLocalFile(): string {
  return join(getProjectRoot(), "backend", "data", "admin.json");
}

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || randomBytes(16).toString("hex");
  const hash = scryptSync(password, s, 64).toString("hex");
  return { hash, salt: s };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  const derived = scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(derived);
  const b = Buffer.from(hash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function defaultFromEnv(): AdminSettings {
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const { hash, salt } = hashPassword(password);
  const now = new Date().toISOString();
  return {
    username: process.env.ADMIN_USERNAME || "admin",
    passwordHash: hash,
    passwordSalt: salt,
    email: process.env.ADMIN_EMAIL || "",
    displayName: process.env.ADMIN_DISPLAY_NAME || "Randevu Sitesi Oluşturucu",
    defaultWorkStart: "09:00",
    defaultWorkEnd: "18:00",
    defaultWorkDays: "1,2,3,4,5",
    defaultSlotDuration: 30,
    updatedAt: now,
  };
}

async function readFromBlobs(): Promise<AdminSettings | null> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: "appointment-admin", consistency: "strong" });
  const raw = await store.get(BLOB_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as AdminSettings;
}

async function writeToBlobs(settings: AdminSettings): Promise<void> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: "appointment-admin", consistency: "strong" });
  await store.set(BLOB_KEY, JSON.stringify(settings));
}

function readFromFile(path: string): AdminSettings | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as AdminSettings;
  } catch {
    return null;
  }
}

function writeToFile(path: string, settings: AdminSettings): void {
  const dir = dirname(path);
  if (dir && dir !== "/tmp" && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(settings, null, 2), "utf-8");
}

export async function getAdminSettings(): Promise<AdminSettings> {
  let settings: AdminSettings | null = null;

  if (isLambda) {
    try {
      settings = await readFromBlobs();
    } catch {
      settings = readFromFile(TMP_FILE);
    }
  } else {
    settings = readFromFile(getLocalFile());
  }

  if (!settings?.username || !settings.passwordHash) {
    settings = defaultFromEnv();
    await saveAdminSettings(settings);
  }

  return settings;
}

export async function saveAdminSettings(settings: AdminSettings): Promise<void> {
  settings.updatedAt = new Date().toISOString();
  if (isLambda) {
    try {
      await writeToBlobs(settings);
      writeToFile(TMP_FILE, settings);
      return;
    } catch {
      writeToFile(TMP_FILE, settings);
      return;
    }
  }
  writeToFile(getLocalFile(), settings);
}

export async function verifyLogin(username: string, password: string): Promise<boolean> {
  const s = await getAdminSettings();
  if (username.trim() !== s.username) return false;
  return verifyPassword(password, s.passwordHash, s.passwordSalt);
}

export async function updatePassword(settings: AdminSettings, newPassword: string): Promise<AdminSettings> {
  const { hash, salt } = hashPassword(newPassword);
  settings.passwordHash = hash;
  settings.passwordSalt = salt;
  return settings;
}

export function settingsToPublic(settings: AdminSettings) {
  return {
    username: settings.username,
    email: settings.email,
    displayName: settings.displayName,
    defaultWorkStart: settings.defaultWorkStart,
    defaultWorkEnd: settings.defaultWorkEnd,
    defaultWorkDays: settings.defaultWorkDays,
    defaultSlotDuration: settings.defaultSlotDuration,
    updatedAt: settings.updatedAt,
  };
}
