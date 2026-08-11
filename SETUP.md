# One-time setup: GitHub OAuth + Cloudinary signing for the admin panel

This wires up https://marshux.github.io/admin/ so only a GitHub account with
push access to this repo can publish photos. It needs a small Cloudflare
Worker because GitHub Pages can't run server code, and both the GitHub OAuth
handshake and the Cloudinary upload signature require a secret that must
never reach the browser.

## 1. Deploy the Worker

1. Sign in (or sign up, free) at https://dash.cloudflare.com.
2. **Workers & Pages** &rarr; **Create** &rarr; **Create Worker**. Name it
   something like `marshux-cms-oauth`. Deploy the default "Hello World".
3. Click **Edit code**, delete the placeholder, and paste in the full
   contents of [`cloudflare-worker/oauth-proxy.js`](cloudflare-worker/oauth-proxy.js)
   from this repo. Save and deploy.
4. Note the Worker's URL shown at the top &mdash; it'll look like
   `https://marshux-cms-oauth.<your-subdomain>.workers.dev`.

Whenever `cloudflare-worker/oauth-proxy.js` changes in this repo, re-paste it
into the Worker's **Edit code** view and deploy again — Cloudflare doesn't
pull from the repo automatically.

## 2. Create a GitHub OAuth App

1. Go to https://github.com/settings/developers &rarr; **OAuth Apps** &rarr;
   **New OAuth App**.
2. Fill in:
   - **Application name**: anything, e.g. `marshux.github.io admin`
   - **Homepage URL**: `https://marshux.github.io`
   - **Authorization callback URL**: `https://<your-worker-url>/callback`
3. Register the app, then click **Generate a new client secret**.
4. Copy the **Client ID** and **Client Secret**.

## 3. Add secrets to the Worker

In the Worker &rarr; **Settings** &rarr; **Variables and Secrets**, add:

- `GITHUB_CLIENT_ID` &mdash; plain text variable, the Client ID from step 2.
- `GITHUB_CLIENT_SECRET` &mdash; **encrypted** secret, the Client Secret from step 2.
- `CLOUDINARY_API_SECRET` &mdash; **encrypted** secret, from your Cloudinary
  dashboard (Settings &rarr; API Keys). This is only ever used server-side
  inside the Worker to sign upload requests.

Save/deploy after adding these.

## 4. Point the site at your Worker

`admin/index.html` and `admin/admin.js` already point at
`https://marshux-cms-oauth.marshalx08.workers.dev`. If you ever redeploy the
Worker under a different URL, update `WORKER_URL` at the top of
`admin/admin.js` to match.

## 5. Log in and test

1. Visit https://marshux.github.io/admin/ and click **Login with GitHub**.
2. Authorize the app. The admin page checks your GitHub token has push
   access to `marshux/marshux.github.io` before showing the photo manager —
   anyone else who logs in with their own GitHub account gets denied.
3. Drag in some photos, edit captions, click **Publish changes**.

If anything errors, open the browser console on `/admin/` — that'll usually
show whether it's the GitHub OAuth handshake, the push-access check, or the
Cloudinary signing step.
