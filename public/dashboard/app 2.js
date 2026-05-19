const API = "";

const form = document.getElementById("site-form");
const messageEl = document.getElementById("message");
const sitesList = document.getElementById("sites-list");
const previewBtn = document.getElementById("preview-btn");

function showMessage(text, type = "success") {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  messageEl.hidden = false;
}

function getFormData() {
  return {
    companyName: form.companyName.value,
    slug: form.slug.value,
    tagline: form.tagline.value,
    about: form.about.value,
    phone: form.phone.value,
    email: form.email.value,
    address: form.address.value,
    workingHours: form.workingHours.value,
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
        : `Sunucu hatası (${res.status}). API çalışmıyor olabilir — Netlify Functions deploy edildi mi?`
    );
  }
}

async function apiPost() {
  const res = await fetch(`${API}/api/sites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

async function loadSites() {
  try {
    const res = await fetch(`${API}/api/sites`);
    const { data: sites, ok } = await parseResponse(res);
    if (!ok) {
      sitesList.innerHTML = `<li class="empty">Liste yüklenemedi (HTTP ${res.status}).</li>`;
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
      <span>/site/${escapeHtml(site.slug)}</span>
      <div class="site-links">
        <a href="/site/${encodeURIComponent(site.slug)}" target="_blank">Siteyi aç</a>
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
        const delRes = await fetch(`${API}/api/sites/${encodeURIComponent(slug)}`, {
          method: "DELETE",
        });
        const { ok } = await parseResponse(delRes);
        if (!ok) showMessage("Silme başarısız.", "error");
        loadSites();
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
      `Site oluşturuldu! Adres: ${window.location.origin}/site/${data.profile.slug}`,
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

loadSites();
