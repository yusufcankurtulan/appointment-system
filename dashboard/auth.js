const DashboardAuth = (function () {
  const TOKEN_KEY = "dashboard_token";
  const USER_KEY = "dashboard_user";

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function getUser() {
    return sessionStorage.getItem(USER_KEY);
  }

  function setSession(token, username) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, username);
  }

  function clearSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }

  function authHeaders(extra = {}) {
    const token = getToken();
    const headers = { ...extra };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  function requireAuth() {
    if (!getToken()) {
      window.location.replace("/dashboard/login.html");
      return false;
    }
    return true;
  }

  async function authFetch(url, options = {}) {
    const headers = authHeaders(options.headers || {});
    if (options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      clearSession();
      window.location.replace("/dashboard/login.html");
    }
    return res;
  }

  function logout() {
    clearSession();
    window.location.replace("/dashboard/login.html");
  }

  return {
    getToken,
    getUser,
    setSession,
    clearSession,
    authHeaders,
    requireAuth,
    authFetch,
    logout,
  };
})();
