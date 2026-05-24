import type { SiteProfile } from "./types.js";
import { SITE_TEMPLATE_HTML } from "./templateHtml.js";
import { getCategoryLabel } from "./categories.js";

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

function galleryHtml(photoUrls: string[]): string {
  if (!photoUrls || !photoUrls.length) return "";
  const items = photoUrls.slice(0, 5).map((url) =>
    `<div class="gallery-item"><img src="${escapeHtml(url)}" alt="Fotoğraf"></div>`
  );
  return `
  <section class="gallery-section">
    <div class="container">
      <div class="gallery-header">
        <p class="gallery-title">Galeri</p>
        <p class="gallery-intro">Müşterilerinizin işletmenizde neler bulacağını gösteren öne çıkan fotoğraflar.</p>
      </div>
      <div class="gallery-grid">
        ${items.join("\n        ")}
      </div>
    </div>
  </section>
  `;
}

export function renderSite(profile: SiteProfile): string {
  let html = SITE_TEMPLATE_HTML;

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
    "{{categoryLabel}}": escapeHtml(getCategoryLabel(profile.category)),
    "{{siteSlug}}": escapeHtml(profile.slug),
    "{{primaryColor}}": escapeHtml(profile.primaryColor || "#2563eb"),
    "{{logoBlock}}": logoBlock,
    "{{servicesList}}": servicesHtml(profile.services),
    "{{photoGallery}}": galleryHtml(profile.photoUrls),
    "{{year}}": String(new Date().getFullYear()),
  };

  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(key).join(value);
  }

  return html;
}
