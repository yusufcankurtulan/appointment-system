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

async function loadSites() {
  const res = await fetch(`${API}/api/sites`);
  const sites = await res.json();

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
      await fetch(`${API}/api/sites/${encodeURIComponent(slug)}`, { method: "DELETE" });
      loadSites();
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const res = await fetch(`${API}/api/sites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getFormData()),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Kayıt başarısız.");

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
    const res = await fetch(`${API}/api/sites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getFormData()),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Önizleme başarısız.");
    window.open(`/site/${data.profile.slug}`, "_blank");
    loadSites();
  } catch (err) {
    showMessage(err.message, "error");
  }
});

loadSites();
