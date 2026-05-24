import type { SiteProfile } from "./types.js";

export function normalizeSite(raw: Partial<SiteProfile> & { slug: string }): SiteProfile {
  const slot = Number(raw.slotDuration);
  return {
    slug: raw.slug,
    companyName: raw.companyName ?? "",
    category: raw.category?.trim() || "diger",
    tagline: raw.tagline ?? "",
    about: raw.about ?? "",
    phone: raw.phone ?? "",
    email: raw.email ?? "",
    address: raw.address ?? "",
    workingHours: raw.workingHours?.trim() || "Pazartesi – Cuma: 09:00 – 18:00",
    workStart: raw.workStart?.trim() || "09:00",
    workEnd: raw.workEnd?.trim() || "18:00",
    workDays: raw.workDays?.trim() || "1,2,3,4,5",
    slotDuration: slot > 0 ? slot : 30,
    services: raw.services ?? "",
    primaryColor: raw.primaryColor?.trim() || "#2563eb",
    logoUrl: raw.logoUrl ?? "",
    photoUrls: Array.isArray(raw.photoUrls)
      ? raw.photoUrls.filter((url): url is string => typeof url === "string").slice(0, 5)
      : [],
    ownerName: raw.ownerName ?? "",
    ownerEmail: raw.ownerEmail ?? "",
    ownerToken: raw.ownerToken ?? "",
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}
