const MarshuxAuth = (function () {
  const WORKER_URL = "https://marshux-cms-oauth.marshalx08.workers.dev";
  const GITHUB_REPO = "marshux/marshux.github.io";
  const TOKEN_KEY = "marshux_admin_gh_token";

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
  }

  function login() {
    return new Promise((resolve, reject) => {
      const popup = window.open(`${WORKER_URL}/auth`, "github-oauth", "width=600,height=700");
      if (!popup) {
        reject(new Error("Popup was blocked. Allow popups for this site and try again."));
        return;
      }

      function handleMessage(e) {
        if (e.data === "authorizing:github") {
          popup.postMessage("authorizing:github", "*");
          return;
        }
        if (typeof e.data !== "string") return;
        if (e.data.startsWith("authorization:github:success:")) {
          window.removeEventListener("message", handleMessage);
          const payload = JSON.parse(e.data.replace("authorization:github:success:", ""));
          resolve(payload.token);
        } else if (e.data.startsWith("authorization:github:error:")) {
          window.removeEventListener("message", handleMessage);
          reject(new Error("GitHub authorization failed."));
        }
      }
      window.addEventListener("message", handleMessage);
    });
  }

  async function hasPushAccess(token) {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "marshux-site",
        Accept: "application/vnd.github+json",
      },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.permissions && data.permissions.push);
  }

  // Resolves true/false; clears an invalid or unauthorized stored token as a side effect.
  async function checkAdmin() {
    const token = getToken();
    if (!token) return false;
    const ok = await hasPushAccess(token);
    if (!ok) clearToken();
    return ok;
  }

  return { WORKER_URL, GITHUB_REPO, getToken, setToken, clearToken, login, hasPushAccess, checkAdmin };
})();
