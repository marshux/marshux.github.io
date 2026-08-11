// GitHub OAuth + Cloudinary upload signer for the custom admin panel at /admin/.
//
// Deploy this on Cloudflare Workers (free tier).
//
// /auth, /callback   - broker the GitHub OAuth handshake so the browser never
//                       sees the GitHub OAuth client secret.
// /sign-upload        - checks the caller's GitHub token has push access to
//                       the repo, then returns a signed Cloudinary upload
//                       request. The Cloudinary API secret lives only here,
//                       as an encrypted Worker secret, and never reaches the
//                       browser.
//
// Env vars required (Settings -> Variables and Secrets on the Worker):
//   GITHUB_CLIENT_ID       (plain var)   - GitHub OAuth App client id
//   GITHUB_CLIENT_SECRET   (encrypted)   - GitHub OAuth App client secret
//   CLOUDINARY_API_SECRET  (encrypted)   - Cloudinary account API secret

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_REPO = "marshux/marshux.github.io";
const CLOUDINARY_CLOUD_NAME = "hf0tmghh";
const CLOUDINARY_API_KEY = "443229755747333";
const ALLOWED_ORIGIN = "https://marshux.github.io";

function html(body) {
  return new Response(body, {
    headers: { "content-type": "text/html;charset=UTF-8" },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders() },
  });
}

async function sha1Hex(message) {
  const data = new TextEncoder().encode(message);
  const digest = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hasPushAccess(token) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "marshux-github-io-oauth-proxy",
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) return false;
  const data = await res.json();
  return Boolean(data.permissions && data.permissions.push);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/auth") {
      const state = crypto.randomUUID();
      const authorizeUrl = new URL(GITHUB_AUTHORIZE_URL);
      authorizeUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
      authorizeUrl.searchParams.set("redirect_uri", `${url.origin}/callback`);
      authorizeUrl.searchParams.set("scope", "repo user");
      authorizeUrl.searchParams.set("state", state);

      return new Response(null, {
        status: 302,
        headers: {
          Location: authorizeUrl.toString(),
          "Set-Cookie": `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
        },
      });
    }

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const cookieHeader = request.headers.get("Cookie") || "";
      const cookieState = (cookieHeader.match(/oauth_state=([^;]+)/) || [])[1];

      if (!code || !state || state !== cookieState) {
        return html("<p>Auth failed: invalid or missing state.</p>");
      }

      const tokenRes = await fetch(GITHUB_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "marshux-github-io-oauth-proxy",
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${url.origin}/callback`,
        }),
      });
      const tokenData = await tokenRes.json();

      if (!tokenData.access_token) {
        return html(`<p>Auth failed: ${tokenData.error_description || "no token returned"}.</p>`);
      }

      const message = `authorization:github:success:${JSON.stringify({
        token: tokenData.access_token,
        provider: "github",
      })}`;

      const script = `<!doctype html><html><body><script>
        (function() {
          function receiveMessage(e) {
            window.opener.postMessage(${JSON.stringify(message)}, e.origin);
            window.removeEventListener("message", receiveMessage, false);
          }
          window.addEventListener("message", receiveMessage, false);
          window.opener.postMessage("authorizing:github", "*");
        })();
      </script></body></html>`;

      return html(script);
    }

    if (url.pathname === "/sign-upload") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }
      if (request.method !== "POST") {
        return json({ error: "method not allowed" }, 405);
      }

      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      if (!token) {
        return json({ error: "missing token" }, 401);
      }

      const authorized = await hasPushAccess(token);
      if (!authorized) {
        return json({ error: "not authorized" }, 403);
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await sha1Hex(`timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`);

      return json({
        signature,
        timestamp,
        api_key: CLOUDINARY_API_KEY,
        cloud_name: CLOUDINARY_CLOUD_NAME,
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
