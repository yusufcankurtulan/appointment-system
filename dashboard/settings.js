if (!DashboardAuth.requireAuth()) throw new Error("redirect");

const settingsForm = document.getElementById("settings-form");
const settingsMessage = document.getElementById("settings-message");

function showSettingsMessage(text, type = "success") {
  settingsMessage.textContent = text;
  settingsMessage.className = `message ${type}`;
  settingsMessage.hidden = false;
}

function getSetWorkDays() {
  return [...document.querySelectorAll("#set-work-days input:checked")]
    .map((cb) => cb.value)
    .join(",");
}

function setSetWorkDays(value) {
  const days = (value || "1,2,3,4,5").split(",");
  document.querySelectorAll("#set-work-days input").forEach((cb) => {
    cb.checked = days.includes(cb.value);
  });
}

function applyDashboardBranding(displayName) {
  const title = displayName || "Randevu Sitesi Oluşturucu";
  document.getElementById("dashboard-title").textContent = title;
  document.title = `${title} — Dashboard`;
}

function applySiteFormDefaults(s) {
  if (!s || !window.applySiteDefaults) return;
  window.applySiteDefaults(s);
}

async function parseResponse(res) {
  const text = await res.text();
  if (!text) return { data: {}, ok: res.ok };
  return { data: JSON.parse(text), ok: res.ok };
}

async function loadSettings() {
  try {
    const res = await DashboardAuth.authFetch("/api/settings");
    const { data, ok } = await parseResponse(res);
    if (!ok) throw new Error(data.error || "Ayarlar yüklenemedi.");

    document.getElementById("set-displayName").value = data.displayName || "";
    document.getElementById("set-username").value = data.username || "";
    document.getElementById("set-email").value = data.email || "";
    document.getElementById("set-defaultWorkStart").value = data.defaultWorkStart || "09:00";
    document.getElementById("set-defaultWorkEnd").value = data.defaultWorkEnd || "18:00";
    document.getElementById("set-defaultSlotDuration").value = String(data.defaultSlotDuration || 30);
    setSetWorkDays(data.defaultWorkDays);
    document.getElementById("settings-updated").textContent = data.updatedAt
      ? new Date(data.updatedAt).toLocaleString("tr-TR")
      : "—";

    applyDashboardBranding(data.displayName);
    applySiteFormDefaults(data);
  } catch (err) {
    showSettingsMessage(err.message, "error");
  }
}

window.loadSettings = loadSettings;

settingsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  settingsMessage.hidden = true;

  const newPassword = document.getElementById("set-newPassword").value;
  const newPasswordConfirm = document.getElementById("set-newPasswordConfirm").value;

  if (newPassword && newPassword !== newPasswordConfirm) {
    showSettingsMessage("Yeni şifreler eşleşmiyor.", "error");
    return;
  }

  const payload = {
    currentPassword: document.getElementById("set-currentPassword").value,
    username: document.getElementById("set-username").value.trim(),
    email: document.getElementById("set-email").value,
    displayName: document.getElementById("set-displayName").value.trim(),
    defaultWorkStart: document.getElementById("set-defaultWorkStart").value,
    defaultWorkEnd: document.getElementById("set-defaultWorkEnd").value,
    defaultWorkDays: getSetWorkDays(),
    defaultSlotDuration: Number(document.getElementById("set-defaultSlotDuration").value),
  };

  if (newPassword) {
    payload.newPassword = newPassword;
    payload.newPasswordConfirm = newPasswordConfirm;
  }

  try {
    const res = await DashboardAuth.authFetch("/api/settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    const { data, ok } = await parseResponse(res);
    if (!ok) throw new Error(data.error || "Kayıt başarısız.");

    if (data.token) {
      DashboardAuth.setSession(data.token, data.username);
      document.getElementById("user-label").textContent = data.username;
    }

    document.getElementById("set-currentPassword").value = "";
    document.getElementById("set-newPassword").value = "";
    document.getElementById("set-newPasswordConfirm").value = "";

    applyDashboardBranding(data.displayName);
    applySiteFormDefaults(data);
    document.getElementById("settings-updated").textContent = new Date(data.updatedAt).toLocaleString("tr-TR");

    showSettingsMessage(data.message || "Ayarlar kaydedildi.", "success");
  } catch (err) {
    showSettingsMessage(err.message, "error");
  }
});

loadSettings();
