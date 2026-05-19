import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import type { SiteProfile } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function getTemplateDir(): string {
  const candidates = [
    join(process.cwd(), "site-template"),
    join(process.cwd(), "public", "site-template"),
    join(__dirname, "..", "..", "site-template"),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, "index.html"))) return dir;
  }
  return candidates[0];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function servicesHtml(services: string): string {
  const items = services
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (items.length === 0) {
    return "<li>Randevu hizmeti</li>";
  }

  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("\n          ");
}

export function renderSite(profile: SiteProfile): string {
  let html = readFileSync(join(getTemplateDir(), "index.html"), "utf-8");

  const logoBlock = profile.logoUrl
    ? `<img src="${escapeHtml(profile.logoUrl)}" alt="${escapeHtml(profile.companyName)}" class="logo-img">`
    : `<span class="logo-text">${escapeHtml(profile.companyName.charAt(0))}</span>`;

  const replacements: Record<string, string> = {
    "{{companyName}}": escapeHtml(profile.companyName),
    "{{tagline}}": escapeHtml(profile.tagline),
    "{{about}}": escapeHtml(profile.about),
    "{{phone}}": escapeHtml(profile.phone),
    "{{email}}": escapeHtml(profile.email),
    "{{address}}": escapeHtml(profile.address),
    "{{workingHours}}": escapeHtml(profile.workingHours),
    "{{primaryColor}}": escapeHtml(profile.primaryColor || "#2563eb"),
    "{{logoBlock}}": logoBlock,
    "{{servicesList}}": servicesHtml(profile.services),
    "{{year}}": String(new Date().getFullYear()),
  };

  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(key).join(value);
  }

  return html;
}
