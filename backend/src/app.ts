import express from "express";
import cors from "cors";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { deleteSite, getSite, listSites, saveSite } from "./store.js";
import { renderSite } from "./renderSite.js";
import type { SiteProfile, SiteProfileInput } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

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
  return null;
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

  // Yerel geliştirme: Netlify public/ klasörünü kullanmaz
  if (!process.env.NETLIFY) {
    app.use("/dashboard", express.static(join(ROOT, "dashboard")));
    app.use("/site-template", express.static(join(ROOT, "site-template")));
  }

  app.get("/api/sites", asyncHandler(async (_req, res) => {
    res.json(await listSites());
  }));

  app.get("/api/sites/:slug", asyncHandler(async (req, res) => {
    const site = await getSite(req.params.slug);
    if (!site) return res.status(404).json({ error: "Site bulunamadı." });
    res.json(site);
  }));

  app.post("/api/sites", asyncHandler(async (req, res) => {
    const body = req.body as Partial<SiteProfileInput>;
    const error = validateInput(body);
    if (error) return res.status(400).json({ error });

    const slug = body.slug?.trim() || slugify(body.companyName || "");
    if (!slug) return res.status(400).json({ error: "Geçerli bir site adresi (slug) gerekli." });

    const existing = await getSite(slug);
    const now = new Date().toISOString();

    const profile: SiteProfile = {
      slug,
      companyName: body.companyName!.trim(),
      tagline: body.tagline?.trim() || "",
      about: body.about?.trim() || "",
      phone: body.phone!.trim(),
      email: body.email!.trim(),
      address: body.address?.trim() || "",
      workingHours: body.workingHours?.trim() || "Pazartesi – Cuma: 09:00 – 18:00",
      services: body.services?.trim() || "",
      primaryColor: body.primaryColor?.trim() || "#2563eb",
      logoUrl: body.logoUrl?.trim() || "",
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

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
