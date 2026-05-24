import express from "express";
import cors from "cors";
import { join } from "path";
import { randomBytes } from "crypto";
import { deleteSite, getSite, listSites, saveSite } from "./store.js";
import { renderSite } from "./renderSite.js";
import type { SiteProfile, SiteProfileInput } from "./types.js";
import { getProjectRoot, isLambda } from "./paths.js";
import { CATEGORIES } from "./categories.js";
import { normalizeSite } from "./normalize.js";
import { getAvailableSlots } from "./slots.js";
import { createAppointment, listAppointments } from "./appointmentStore.js";
import { loginHandler, requireAuth } from "./auth.js";
import { getSettingsHandler, updateSettingsHandler } from "./settingsRoutes.js";

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
    ownerName: body.ownerName?.trim() || existing?.ownerName || "",
    ownerEmail: body.ownerEmail?.trim() || existing?.ownerEmail || "",
    ownerToken: existing?.ownerToken || body.ownerToken?.trim() || generateOwnerToken(),
    logoUrl: body.logoUrl?.trim() || "",
    createdAt: existing?.createdAt,
    updatedAt: new Date().toISOString(),
  });
}

function generateOwnerToken(): string {
  return randomBytes(16).toString("hex");
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

  app.post("/api/auth/login", asyncHandler(async (req, res) => loginHandler(req, res)));

  app.get("/api/auth/me", requireAuth, asyncHandler(async (req, res) => {
    const user = (req as express.Request & { user?: string }).user;
    res.json({ username: user });
  }));

  app.get("/api/settings", requireAuth, asyncHandler(getSettingsHandler));
  app.put("/api/settings", requireAuth, asyncHandler(updateSettingsHandler));

  app.get("/api/categories", (_req, res) => {
    res.json(CATEGORIES);
  });

  app.get("/api/sites", requireAuth, asyncHandler(async (_req, res) => {
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

  app.get("/api/sites/:slug/appointments", requireAuth, asyncHandler(async (req, res) => {
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

  app.get("/api/owner/:slug/appointments", asyncHandler(async (req, res) => {
    const token = String(req.query.token || "").trim();
    if (!token) return res.status(400).json({ error: "Token gerekli." });
    const site = await getSite(req.params.slug);
    if (!site) return res.status(404).json({ error: "Site bulunamadı." });
    if (!site.ownerToken || site.ownerToken !== token) {
      return res.status(403).json({ error: "Geçersiz token." });
    }
    const appointments = await listAppointments(site.slug);
    res.json(appointments.sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)));
  }));

  app.post("/api/sites", requireAuth, asyncHandler(async (req, res) => {
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
      ownerDashboardUrl: `/owner/${slug}?token=${profile.ownerToken}`,
    });
  }));

  app.get("/owner/:slug", asyncHandler(async (req, res) => {
    const site = await getSite(req.params.slug);
    if (!site) return res.status(404).send("Bu firma için site henüz oluşturulmamış.");
    const ownerEmailDisplay = site.ownerEmail
      ? `<p>Site sahibine token paylaşın. Sahibin e-posta adresi: <strong>${escapeHtml(site.ownerEmail)}</strong></p>`
      : "";
    res.type("html").send(`<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(site.companyName)} — Randevu Yönetimi</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 1.5rem; background: #f7f7fb; color: #111; }
    .container { max-width: 820px; margin: 0 auto; background: #fff; padding: 1.5rem; border-radius: 12px; box-shadow: 0 14px 40px rgba(0,0,0,.08); }
    h1 { margin-top: 0; }
    .field { margin-bottom: 1rem; }
    .field label { display: block; margin-bottom: .4rem; font-weight: 600; }
    input[type=text] { width: 100%; padding: .75rem 1rem; border: 1px solid #d1d5db; border-radius: 8px; }
    button { cursor: pointer; border: none; background: #2563eb; color: white; padding: .85rem 1.1rem; border-radius: 8px; font-weight: 600; }
    .message { margin: 1rem 0; padding: 1rem; border-radius: 10px; background: #f8fafc; }
    .message.error { background: #fee2e2; color: #991b1b; }
    .appointments { list-style: none; padding: 0; margin: 0; }
    .appointments li { border-bottom: 1px solid #e5e7eb; padding: 1rem 0; }
    .appointments li:last-child { border-bottom: none; }
    .appointment-meta { color: #4b5563; margin-top: .35rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${escapeHtml(site.companyName)} — Randevu Yönetimi</h1>
    <p>${escapeHtml(site.tagline || "Siteniz için randevu yönetim sayfası.")}</p>
    ${ownerEmailDisplay}
    <div class="field">
      <label for="owner-token">Sahip token</label>
      <input id="owner-token" type="text" placeholder="Token girin veya paylaşılmış link kullanın">
    </div>
    <button id="load-appointments">Randevuları Görüntüle</button>
    <div id="status" class="message" hidden></div>
    <ul id="appointments" class="appointments"></ul>
  </div>
  <script>
    const slug = ${JSON.stringify(site.slug)};
    const loadBtn = document.getElementById("load-appointments");
    const tokenInput = document.getElementById("owner-token");
    const status = document.getElementById("status");
    const list = document.getElementById("appointments");
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("token")) tokenInput.value = urlParams.get("token");

    function showStatus(message, isError = false) {
      status.textContent = message;
      status.hidden = false;
      status.className = isError ? "message error" : "message";
    }

    async function loadAppointments(token) {
      list.innerHTML = "";
      showStatus("Yükleniyor...");
      try {
        const res = await fetch('/api/owner/' + encodeURIComponent(slug) + '/appointments?token=' + encodeURIComponent(token));
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Randevular yüklenemedi.");
        if (!data.length) {
          showStatus("Henüz randevu yok.");
          return;
        }
        showStatus(data.length + " randevu bulundu.");
        list.innerHTML = data
          .map((a) =>
            '<li>' +
            '<strong>' + a.date + ' ' + a.time + '</strong>' +
            '<div class="appointment-meta">' + a.customerName + ' — ' + a.customerPhone + (a.customerEmail ? ' | ' + a.customerEmail : '') + '</div>' +
            (a.note ? '<div class="appointment-meta">Not: ' + a.note + '</div>' : '') +
            '</li>'
          )
          .join("");
      } catch (err) {
        showStatus(err.message, true);
      }
    }

    loadBtn.addEventListener("click", () => {
      const token = tokenInput.value.trim();
      if (!token) return showStatus("Token giriniz.", true);
      loadAppointments(token);
    });
  </script>
</body>
</html>
    `);
  }));

  app.delete("/api/sites/:slug", requireAuth, asyncHandler(async (req, res) => {
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
