// GitHub OAuth proxy for Decap CMS (see admin/config.yml's base_url).
//
// Deploy this on Cloudflare Workers (free tier). It never sees or stores the
// Cloudinary secret — this file only brokers the GitHub OAuth handshake so
// Decap CMS can confirm "this visitor has push access to the repo" before
// letting them publish. GITHUB_CLIENT_SECRET must be set as an encrypted
// Worker secret, never committed here.
//
// Env vars required (Settings -> Variables on the Worker):
//   GITHUB_CLIENT_ID      (plain var)
//   GITHUB_CLIENT_SECRET  (encrypted secret)

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

function html(body) {
  return new Response(body, {
    headers: { "content-type": "text/html;charset=UTF-8" },
  });
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

    return new Response("Not found", { status: 404 });
  },
};
