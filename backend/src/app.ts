import express from "express";
import cors from "cors";
import { join } from "path";
import { deleteSite, getSite, listSites, saveSite } from "./store.js";
import { renderSite } from "./renderSite.js";
import type { SiteProfile, SiteProfileInput } from "./types.js";
import { getProjectRoot, isLambda } from "./paths.js";
import { CATEGORIES } from "./categories.js";
import { normalizeSite } from "./normalize.js";
import { getAvailableSlots } from "./slots.js";
import { createAppointment, listAppointments } from "./appointmentStore.js";

export function slugify(text: string): string {
  const tr: Record<string, string> = {
    ğ: "g", ü: "u", ş: "s", ı: "i", ö: "o", ç: "c",
    Ğ: "g", Ü: "u", Ş: "s", İ: "i", Ö: "o", Ç: "c",
  };
  return text
    .trim()
    .split("")
    .map((c) => tr[c] ?? c)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function validateInput(body: Partial<SiteProfileInput>): string | null {
  if (!body.companyName?.trim()) return "Firma adı zorunludur.";
  if (!body.phone?.trim()) return "Telefon zorunludur.";
  if (!body.email?.trim()) return "E-posta zorunludur.";
  if (!body.category?.trim()) return "İş kolu seçiniz.";
  return null;
}

function buildProfile(body: Partial<SiteProfileInput>, slug: string, existing?: SiteProfile): SiteProfile {
  return normalizeSite({
    slug,
    companyName: body.companyName!.trim(),
    category: body.category!.trim(),
    tagline: body.tagline?.trim() || "",
    about: body.about?.trim() || "",
    phone: body.phone!.trim(),
    email: body.email!.trim(),
    address: body.address?.trim() || "",
    workingHours: body.workingHours?.trim() || "Pazartesi – Cuma: 09:00 – 18:00",
    workStart: body.workStart?.trim() || "09:00",
    workEnd: body.workEnd?.trim() || "18:00",
    workDays: body.workDays?.trim() || "1,2,3,4,5",
    slotDuration: Number(body.slotDuration) || 30,
    services: body.services?.trim() || "",
    primaryColor: body.primaryColor?.trim() || "#2563eb",
    logoUrl: body.logoUrl?.trim() || "",
    createdAt: existing?.createdAt,
    updatedAt: new Date().toISOString(),
  });
}

const asyncHandler =
  (fn: (req: express.Request, res: express.Response) => Promise<unknown>) =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

export function createApp(): express.Application {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  if (!isLambda && !process.env.NETLIFY) {
    const root = getProjectRoot();
    app.use("/dashboard", express.static(join(root, "dashboard")));
    app.use("/site-template", express.static(join(root, "site-template")));
  }

  app.get("/api/categories", (_req, res) => {
    res.json(CATEGORIES);
  });

  app.get("/api/sites", asyncHandler(async (_req, res) => {
    res.json(await listSites());
  }));

  app.get("/api/sites/:slug", asyncHandler(async (req, res) => {
    const site = await getSite(req.params.slug);
    if (!site) return res.status(404).json({ error: "Site bulunamadı." });
    res.json(site);
  }));

  app.get("/api/sites/:slug/slots", asyncHandler(async (req, res) => {
    const site = await getSite(req.params.slug);
    if (!site) return res.status(404).json({ error: "Site bulunamadı." });
    const date = String(req.query.date || "");
    const booked = await listAppointments(site.slug);
    res.json({ date, slots: getAvailableSlots(site, date, booked) });
  }));

  app.get("/api/sites/:slug/appointments", asyncHandler(async (req, res) => {
    const site = await getSite(req.params.slug);
    if (!site) return res.status(404).json({ error: "Site bulunamadı." });
    const appointments = await listAppointments(site.slug);
    res.json(appointments.sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)));
  }));

  app.post("/api/sites/:slug/appointments", asyncHandler(async (req, res) => {
    const site = await getSite(req.params.slug);
    if (!site) return res.status(404).json({ error: "Site bulunamadı." });

    const { date, time, customerName, customerPhone, customerEmail, note } = req.body as Record<string, string>;
    if (!date || !time) return res.status(400).json({ error: "Tarih ve saat seçiniz." });
    if (!customerName?.trim()) return res.status(400).json({ error: "Ad soyad zorunludur." });
    if (!customerPhone?.trim()) return res.status(400).json({ error: "Telefon zorunludur." });

    const booked = await listAppointments(site.slug);
    const slots = getAvailableSlots(site, date, booked);
    const slot = slots.find((s) => s.time === time);
    if (!slot?.available) return res.status(400).json({ error: "Seçilen saat müsait değil." });

    const appointment = await createAppointment({
      siteSlug: site.slug,
      date,
      time,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail?.trim() || "",
      note: note?.trim() || "",
    });

    res.status(201).json({ appointment });
  }));

  app.post("/api/sites", asyncHandler(async (req, res) => {
    const body = req.body as Partial<SiteProfileInput>;
    const error = validateInput(body);
    if (error) return res.status(400).json({ error });

    const slug = body.slug?.trim() || slugify(body.companyName || "");
    if (!slug) return res.status(400).json({ error: "Geçerli bir site adresi (slug) gerekli." });

    const existing = await getSite(slug);
    const profile = buildProfile(body, slug, existing);
    await saveSite(profile);

    res.json({
      profile,
      siteUrl: `/site/${slug}`,
      previewUrl: `/site/${slug}`,
    });
  }));

  app.delete("/api/sites/:slug", asyncHandler(async (req, res) => {
    const ok = await deleteSite(req.params.slug);
    if (!ok) return res.status(404).json({ error: "Site bulunamadı." });
    res.json({ success: true });
  }));

  app.get("/site/:slug", asyncHandler(async (req, res) => {
    const site = await getSite(req.params.slug);
    if (!site) return res.status(404).send("Bu firma için site henüz oluşturulmamış.");
    res.type("html").send(renderSite(site));
  }));

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("API hatası:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Sunucu hatası." });
    }
  });

  app.get("/", (_req, res) => {
    res.redirect("/dashboard/");
  });

  return app;
}
