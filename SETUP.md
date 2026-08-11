# One-time setup: GitHub OAuth for the admin panel

This wires up https://marshux.github.io/admin/ so only a GitHub account with
push access to this repo can publish. It needs a small Cloudflare Worker
because GitHub Pages can't run server code itself, and GitHub's OAuth
handshake requires a server to exchange the auth code for a token without
exposing your OAuth app's client secret to the browser.

## 1. Deploy the OAuth proxy Worker

1. Sign in (or sign up, free) at https://dash.cloudflare.com.
2. **Workers & Pages** &rarr; **Create** &rarr; **Create Worker**. Name it
   something like `marshux-cms-oauth`. Deploy the default "Hello World".
3. Click **Edit code**, delete the placeholder, and paste in the full
   contents of [`cloudflare-worker/oauth-proxy.js`](cloudflare-worker/oauth-proxy.js)
   from this repo. Save and deploy.
4. Note the Worker's URL shown at the top &mdash; it'll look like
   `https://marshux-cms-oauth.<your-subdomain>.workers.dev`. You'll need this
   in steps 2 and 4.

## 2. Create a GitHub OAuth App

1. Go to https://github.com/settings/developers &rarr; **OAuth Apps** &rarr;
   **New OAuth App**.
2. Fill in:
   - **Application name**: anything, e.g. `marshux.github.io CMS`
   - **Homepage URL**: `https://marshux.github.io`
   - **Authorization callback URL**: `https://<your-worker-url>/callback`
     (the exact Worker URL from step 1, with `/callback` appended)
3. Register the app, then click **Generate a new client secret**.
4. Copy the **Client ID** and the **Client Secret** &mdash; you'll paste both
   into the Worker next. Don't put either of these in the repo.

## 3. Add the OAuth credentials to the Worker

1. Back in the Cloudflare dashboard, open your Worker &rarr; **Settings** &rarr;
   **Variables and Secrets**.
2. Add `GITHUB_CLIENT_ID` as a plain text variable (the Client ID from step 2).
3. Add `GITHUB_CLIENT_SECRET` as an **encrypted** secret (the Client Secret
   from step 2). Save/deploy.

## 4. Point the site at your Worker

Send me the Worker URL from step 1 and I'll update `admin/config.yml`'s
`base_url` to match and push it. (Nothing secret needs to come back to me
&mdash; just the public `https://....workers.dev` URL.)

## 5. Log in and test

1. Visit https://marshux.github.io/admin/ and click **Login with GitHub**.
2. Authorize the OAuth app. Decap CMS checks that your GitHub account has
   push access to `marshux/marshux.github.io` before letting you publish
   &mdash; anyone else who logs in with their own GitHub account gets denied.
3. Open the **Photography** collection and click to add an image. This opens
   Cloudinary's own media library widget, which will ask you to log into the
   Cloudinary account tied to cloud name `hf0tmghh`. That login is separate
   from GitHub and is Cloudinary's own auth &mdash; the API secret is never
   used anywhere in this flow.
4. Publishing writes straight to `data/photos.json` on `main`, which the
   live photography page reads.

If anything errors, check the browser console on `/admin/` first — that'll
usually show whether it's a GitHub auth issue or a Decap config issue.
