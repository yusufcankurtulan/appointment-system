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

function getFormData() {
  return {
    companyName: form.companyName.value,
    category: form.category.value,
    slug: form.slug.value,
    tagline: form.tagline.value,
    about: form.about.value,
    phone: form.phone.value,
    email: form.email.value,
    address: form.address.value,
    workingHours: form.workingHours.value,
    workStart: form.workStart.value,
    workEnd: form.workEnd.value,
    workDays: getWorkDays(),
    slotDuration: Number(form.slotDuration.value),
    services: form.services.value,
    primaryColor: form.primaryColor.value,
    logoUrl: form.logoUrl.value,
  };
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
    body: JSON.stringify(getFormData()),
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
      <span class="site-meta">${escapeHtml(CATEGORY_LABELS[site.category] || site.category || "Diğer")} · /site/${escapeHtml(site.slug)}</span>
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
    showMessage(
      `Site oluşturuldu! ${window.location.origin}/site/${data.profile.slug}`,
      "success"
    );
    form.slug.value = data.profile.slug;
    loadSites();
  } catch (err) {
    showMessage(err.message, "error");
  }
});

previewBtn.addEventListener("click", async () => {
  try {
    const data = await apiPost();
    window.open(`/site/${data.profile.slug}`, "_blank");
    loadSites();
  } catch (err) {
    showMessage(err.message, "error");
  }
});

loadCategories();
loadSites();
