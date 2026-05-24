const API = "";

if (!DashboardAuth.requireAuth()) {
  throw new Error("redirect");
}

document.getElementById("user-label").textContent = DashboardAuth.getUser() || "";
document.getElementById("logout-btn").addEventListener("click", () => DashboardAuth.logout());

const form = document.getElementById("site-form");
const messageEl = document.getElementById("message");
const sitesList = document.getElementById("sites-list");
const previewBtn = document.getElementById("preview-btn");
const categorySelect = document.getElementById("category");
const appointmentsPanel = document.getElementById("appointments-panel");
const appointmentsList = document.getElementById("appointments-list");
const apptPanelTitle = document.getElementById("appt-panel-title");

const CATEGORY_LABELS = {
  berber: "Berber / Kuaför",
  guzellik: "Güzellik Salonu",
  spa: "Spa & Masaj",
  dis: "Diş Kliniği",
  doktor: "Doktor / Sağlık",
  veteriner: "Veteriner",
  peyzaj: "Peyzaj / Bahçe",
  temizlik: "Temizlik",
  emlak: "Emlak",
  oto: "Oto Servis",
  fitness: "Fitness",
  egitim: "Eğitim / Kurs",
  fotograf: "Fotoğrafçı",
  avukat: "Avukat",
  danismanlik: "Danışmanlık",
  restoran: "Restoran",
  tattoo: "Dövme",
  nail: "Nail Art",
  psikolog: "Psikolog",
  fizyoterapi: "Fizyoterapi",
  kuafor: "Kuaför",
  optik: "Optik",
  dugun: "Düğün / Organizasyon",
  diger: "Diğer",
};

function showMessage(text, type = "success") {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  messageEl.hidden = false;
}

function getWorkDays() {
  return [...document.querySelectorAll("#work-days input:checked")]
    .map((cb) => cb.value)
    .join(",");
}

function setWorkDays(value) {
  const days = (value || "1,2,3,4,5").split(",");
  document.querySelectorAll("#work-days input").forEach((cb) => {
    cb.checked = days.includes(cb.value);
  });
}

function formatWorkingHoursLabel(start, end, daysStr) {
  const dayNames = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
  const days = (daysStr || "1,2,3,4,5").split(",").map(Number).sort();
  const labels = days.map((d) => dayNames[d]).join(", ");
  return `${labels}: ${start} – ${end}`;
}

window.applySiteDefaults = function (s) {
  if (!s) return;
  if (s.defaultWorkStart) form.workStart.value = s.defaultWorkStart;
  if (s.defaultWorkEnd) form.workEnd.value = s.defaultWorkEnd;
  if (s.defaultSlotDuration) form.slotDuration.value = String(s.defaultSlotDuration);
  if (s.defaultWorkDays) setWorkDays(s.defaultWorkDays);
  if (s.defaultWorkStart && s.defaultWorkEnd) {
    form.workingHours.value = formatWorkingHoursLabel(
      s.defaultWorkStart,
      s.defaultWorkEnd,
      s.defaultWorkDays || "1,2,3,4,5"
    );
  }
  if (s.displayName) {
    document.getElementById("dashboard-title").textContent = s.displayName;
    document.title = `${s.displayName} — Dashboard`;
  }
};

async function getFormData() {
  return {
    companyName: form.companyName.value,
    category: form.category.value,
    slug: form.slug.value,
    tagline: form.tagline.value,
    about: form.about.value,
    phone: form.phone.value,
    email: form.email.value,
    ownerName: form.ownerName?.value || "",
    ownerEmail: form.ownerEmail?.value || "",
    address: form.address.value,
    workingHours: form.workingHours.value,
    workStart: form.workStart.value,
    workEnd: form.workEnd.value,
    workDays: getWorkDays(),
    slotDuration: Number(form.slotDuration.value),
    services: form.services.value,
    primaryColor: form.primaryColor.value,
    logoUrl: form.logoUrl.value,
    photoUrls: await readPhotoFiles(),
  };
}

function makeSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[ğĞüÜşŞıİöÖçÇ]/g, (ch) => {
      const map = { ğ: "g", Ğ: "g", ü: "u", Ü: "u", ş: "s", Ş: "s", ı: "i", İ: "i", ö: "o", Ö: "o", ç: "c", Ç: "c" };
      return map[ch] || "";
    })
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function replaceTemplatePlaceholders(template, data) {
  return template
    .replace(/{{companyName}}/g, data.companyName)
    .replace(/{{tagline}}/g, data.tagline)
    .replace(/{{about}}/g, data.about)
    .replace(/{{phone}}/g, data.phone)
    .replace(/{{email}}/g, data.email)
    .replace(/{{address}}/g, data.address)
    .replace(/{{workingHours}}/g, data.workingHours)
    .replace(/{{categoryLabel}}/g, data.categoryLabel)
    .replace(/{{siteSlug}}/g, data.siteSlug)
    .replace(/{{primaryColor}}/g, data.primaryColor)
    .replace(/{{logoBlock}}/g, data.logoBlock)
    .replace(/{{servicesList}}/g, data.servicesList)
    .replace(/{{year}}/g, data.year)
    .replace(/{{photoGallery}}/g, data.photoGallery);
}

function makeGalleryHtml(photoUrls) {
  if (!photoUrls || !photoUrls.length) return "";
  return `
  <section class="gallery-section">
    <div class="container">
      <div class="gallery-header">
        <p class="gallery-title">Galeri</p>
        <p class="gallery-intro">İşletmenizin en iyi yanlarını gösteren öne çıkan fotoğraflar.</p>
      </div>
      <div class="gallery-grid">
        ${photoUrls
          .slice(0, 5)
          .map(
            (url) =>
              `<div class="gallery-item"><img src="${escapeHtml(url)}" alt="Fotoğraf"></div>`
          )
          .join("")}
      </div>
    </div>
  </section>
  `;
}

async function buildPreviewHtml(siteData) {
  const templateText = await fetch("/site-template/index.html").then((res) => res.text());
  const services = siteData.services
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("\n          ");
  const logoBlock = siteData.logoUrl
    ? `<img src="${escapeHtml(siteData.logoUrl)}" alt="${escapeHtml(siteData.companyName)}" class="logo-img">`
    : `<span class="logo-text">${escapeHtml(siteData.companyName.charAt(0) || "")} </span>`;
  const data = {
    companyName: escapeHtml(siteData.companyName),
    tagline: escapeHtml(siteData.tagline),
    about: escapeHtml(siteData.about),
    phone: escapeHtml(siteData.phone),
    email: escapeHtml(siteData.email),
    address: escapeHtml(siteData.address),
    workingHours: escapeHtml(siteData.workingHours),
    categoryLabel: escapeHtml(CATEGORY_LABELS[siteData.category] || siteData.category || "Diğer"),
    siteSlug: escapeHtml(siteData.siteSlug),
    primaryColor: escapeHtml(siteData.primaryColor),
    logoBlock,
    servicesList: services || "<li>Randevu hizmeti</li>",
    year: String(new Date().getFullYear()),
    photoGallery: makeGalleryHtml(siteData.photoUrls),
  };
  return replaceTemplatePlaceholders(templateText, data);
}

async function previewSite() {
  try {
    const formData = await getFormData();
    const slug = form.slug.value.trim() || makeSlug(form.companyName.value);
    const siteData = {
      ...formData,
      siteSlug: slug || "preview",
      categoryLabel: CATEGORY_LABELS[formData.category] || formData.category || "Diğer",
    };
    const previewHtml = await buildPreviewHtml(siteData);
    const previewWindow = window.open("", "previewWindow");
    if (!previewWindow) {
      showMessage("Önizleme penceresi açılamadı. Lütfen pop-up engelleyiciyi kontrol edin.", "error");
      return;
    }
    previewWindow.document.write(previewHtml);
    previewWindow.document.close();
  } catch (err) {
    showMessage(err.message, "error");
  }
}

async function readPhotoFiles() {
  const input = document.getElementById("photoFiles");
  if (!(input instanceof HTMLInputElement) || !input.files) return [];
  const files = Array.from(input.files).slice(0, 5);
  return Promise.all(
    files.map((file) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") resolve(reader.result);
          else reject(new Error("Dosya okunamadı."));
        };
        reader.onerror = () => reject(new Error("Dosya okunamadı."));
        reader.readAsDataURL(file);
      })
    )
  );
}

async function parseResponse(res) {
  const text = await res.text();
  if (!text) return { data: {}, ok: res.ok };
  try {
    return { data: JSON.parse(text), ok: res.ok };
  } catch {
    throw new Error(
      res.ok
        ? "Sunucu yanıtı okunamadı."
        : `Sunucu hatası (${res.status}). API çalışmıyor olabilir.`
    );
  }
}

async function loadCategories() {
  try {
    const res = await fetch(`${API}/api/categories`);
    const { data, ok } = await parseResponse(res);
    if (ok && Array.isArray(data)) {
      categorySelect.innerHTML =
        '<option value="">Seçiniz...</option>' +
        data.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.label)}</option>`).join("");
    }
  } catch {
    categorySelect.innerHTML =
      '<option value="">Seçiniz...</option>' +
      Object.entries(CATEGORY_LABELS)
        .map(([id, label]) => `<option value="${id}">${label}</option>`)
        .join("");
  }
}

async function apiPost() {
  const res = await DashboardAuth.authFetch(`${API}/api/sites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(await getFormData()),
  });
  const { data, ok } = await parseResponse(res);
  if (!ok) {
    throw new Error(
      data.error || data.errorMessage || data.message || `Kayıt başarısız (HTTP ${res.status}).`
    );
  }
  return data;
}

async function loadAppointments(slug, companyName) {
  appointmentsPanel.hidden = false;
  apptPanelTitle.textContent = `${companyName} — Randevular`;
  appointmentsList.innerHTML = "<li>Yükleniyor...</li>";

  try {
    const res = await DashboardAuth.authFetch(`${API}/api/sites/${encodeURIComponent(slug)}/appointments`);
    const { data, ok } = await parseResponse(res);
    if (!ok) {
      appointmentsList.innerHTML = "<li>Randevular yüklenemedi.</li>";
      return;
    }
    if (!data.length) {
      appointmentsList.innerHTML = "<li class='empty'>Henüz randevu yok.</li>";
      return;
    }
    appointmentsList.innerHTML = data
      .map(
        (a) => `
      <li>
        <strong>${escapeHtml(a.date)} ${escapeHtml(a.time)}</strong>
        <span>${escapeHtml(a.customerName)} — ${escapeHtml(a.customerPhone)}</span>
      </li>
    `
      )
      .join("");
  } catch (err) {
    appointmentsList.innerHTML = `<li>${escapeHtml(err.message)}</li>`;
  }
}

async function loadSites() {
  try {
    const res = await DashboardAuth.authFetch(`${API}/api/sites`);
    const { data: sites, ok } = await parseResponse(res);
    if (!ok) {
      sitesList.innerHTML = `<li class="empty">Liste yüklenemedi.</li>`;
      return;
    }

    if (!sites.length) {
      sitesList.innerHTML = '<li class="empty">Henüz site yok.</li>';
      return;
    }

    sitesList.innerHTML = sites
      .map(
        (site) => `
    <li class="site-item">
      <strong>${escapeHtml(site.companyName)}</strong>
      <span class="site-meta">${escapeHtml(CATEGORY_LABELS[site.category] || site.category || "Diğer")} · /site/${escapeHtml(site.slug)}${site.ownerEmail ? ` · Sahip: ${escapeHtml(site.ownerEmail)}` : ""}${site.photoUrls?.length ? ` · Fotoğraf: ${site.photoUrls.length}` : ""}</span>
      <div class="site-links">
        <a href="/site/${encodeURIComponent(site.slug)}" target="_blank">Siteyi aç</a>
        <button type="button" class="btn btn-small" data-view-appt="${escapeHtml(site.slug)}" data-name="${escapeHtml(site.companyName)}">Randevular</button>
        <button type="button" class="btn btn-danger" data-slug="${escapeHtml(site.slug)}">Sil</button>
      </div>
    </li>
  `
      )
      .join("");

    sitesList.querySelectorAll("[data-slug]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const slug = btn.dataset.slug;
        if (!confirm(`"${slug}" sitesini silmek istediğinize emin misiniz?`)) return;
        const delRes = await DashboardAuth.authFetch(`${API}/api/sites/${encodeURIComponent(slug)}`, {
          method: "DELETE",
        });
        const { ok: delOk } = await parseResponse(delRes);
        if (!delOk) showMessage("Silme başarısız.", "error");
        else {
          appointmentsPanel.hidden = true;
          loadSites();
        }
      });
    });

    sitesList.querySelectorAll("[data-view-appt]").forEach((btn) => {
      btn.addEventListener("click", () => {
        loadAppointments(btn.dataset.viewAppt, btn.dataset.name);
      });
    });
  } catch (err) {
    sitesList.innerHTML = `<li class="empty">${escapeHtml(err.message)}</li>`;
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const data = await apiPost();
    const ownerUrl = data.ownerDashboardUrl ? ` | Owner dashboard: ${window.location.origin}${data.ownerDashboardUrl}` : "";
    showMessage(
      `Site oluşturuldu! ${window.location.origin}/site/${data.profile.slug}${ownerUrl}`,
      "success"
    );
    form.slug.value = data.profile.slug;
    loadSites();
  } catch (err) {
    showMessage(err.message, "error");
  }
});

previewBtn.addEventListener("click", async () => {
  previewSite();
});

loadCategories();
loadSites();
