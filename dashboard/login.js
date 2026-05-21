if (DashboardAuth.getToken()) {
  window.location.replace("/dashboard/");
}

const form = document.getElementById("login-form");
const messageEl = document.getElementById("login-message");

function showError(text) {
  messageEl.textContent = text;
  messageEl.className = "message error";
  messageEl.hidden = false;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  messageEl.hidden = true;

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.username.value.trim(),
        password: form.password.value,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Giriş başarısız.");

    DashboardAuth.setSession(data.token, data.username);
    window.location.replace("/dashboard/");
  } catch (err) {
    showError(err.message);
  }
});
