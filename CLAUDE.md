# marshux.github.io

Marshal Xu's personal site. Static multi-page site, no backend, deployed to
GitHub Pages via GitHub Actions. Editorial "paper" theme (Playfair Display
serif headings, warm light/dark palette via CSS custom properties).

## Architecture

- **Pages**: `index.html`, `projects.html`, `photography.html` (no
  `interests.html` or `contact.html` — both were removed by request). Each
  page includes shared chrome via `data-include="partials/*.html"`
  (`js/include.js` fetches and injects them at runtime).
- **`js/router.js`**: intercepts same-origin clicks between the pages above
  and swaps `<main>` via `fetch` + `DOMParser` instead of a full page load
  (`history.pushState`/`popstate`). This is what lets the `<audio>` element
  (in `partials/player.html`, outside `<main>`) survive navigation. `/admin/`
  is intentionally excluded — real full page loads there.
- **`js/main.js`**: theme toggle (View Transitions API, no CSS transition —
  see the "no backdrop-filter" comment in `css/style.css`, it was a real
  performance bottleneck), nav highlighting, `loadProjects()`, `loadPhotos()`.
- **`js/player.js`**: the "Now Playing" widget (top-left, fixed position).
  State (track, position, volume, mute) persists to `sessionStorage` and
  best-effort resumes on reload — browsers block autoplay-with-sound on a
  fresh navigation without prior engagement, so there's a fallback that
  resumes on the very next click/keypress anywhere on the page if the
  initial `audio.play()` was rejected. See `MUSIC.md`.
- **`admin/`**: GitHub-OAuth-gated panel (via the Cloudflare Worker in
  `cloudflare-worker/`) for managing photos and music — drag-and-drop
  upload to Cloudinary, inline editing, drag-to-reorder, publishes to
  `data/photos.json` / `data/playlist.json` via the GitHub Contents API.
  Excluded from `router.js`; not built with the projects flow below.
- **Tailwind v4**: only used for the admin panel's chrome. CSS-based
  `@theme` config in `css/tailwind-input.css` (no `tailwind.config.js`),
  mapped onto the site's runtime CSS custom properties so admin utilities
  stay in sync with the dark/light theme. `npm run build` produces the
  gitignored `css/tailwind.css`; CI does this on every push (see below), you
  don't need to run it locally unless previewing admin styling changes.

## Content data files

All under `data/`, all fetched client-side at runtime — no build step reads
them:

| File | Managed via | Doc |
|---|---|---|
| `photos.json` | admin panel | `PHOTOS.md` |
| `playlist.json` | admin panel | `MUSIC.md` |
| `project-overrides.json` | hand-edit | `PROJECTS.md` |

## Adding a new project to the Projects page

`projects.html` lists repos live from the **unauthenticated** public GitHub
API — a static site has nowhere safe to hold a token, so **private repos
never appear here, by design**. Read `PROJECTS.md` before touching this.

When the user asks to add/feature a project:
1. Confirm the repo is public (or should be made public — that's a call for
   the user, not something to do unprompted; repo visibility changes are
   consequential, always confirm first).
2. If they want it to show an image/custom summary/tags rather than the bare
   GitHub description + language, add an entry to
   `data/project-overrides.json` keyed by the **exact repo name**. All
   fields (`image`, `tldr`, `tags`) are optional and fall back gracefully —
   see `PROJECTS.md` for the schema.
3. To hide a repo instead: fork status, visibility, and `HIDDEN_REPOS` in
   `js/main.js` are the three levers — no override-file flag for this.

## Deploy

Push to `main` → `.github/workflows/deploy.yml` runs `npm run build`
(Tailwind), stages everything except dev-only files into `_site/`, and
publishes via `actions/deploy-pages`. No manual deploy step. Check a run with
`gh run list --workflow=deploy.yml --limit 1` / `gh run watch <id>`.

## Testing changes

There's no test suite. For anything DOM/JS-behavior-sensitive (router
navigation, player state, theme toggle, drag-reorder), prefer writing a
throwaway Playwright script over reasoning from source alone — this repo has
a history of "should work" logic that didn't, once actually clicked through.

- `playwright` is installed as a project devDependency
  (`node_modules/playwright`, not in `package.json` — installed with
  `--no-save` to avoid noise). `npx playwright install chromium` if the
  browser binary is missing.
- **This is WSL**: `chromium` needs `libgbm.so.1` and `libwayland-server.so.0`
  which usually aren't present and can't be installed with `apt install`
  without sudo. Workaround that doesn't need root: `apt-get download
  libgbm1 libwayland-server0`, then `dpkg-deb -x <pkg>.deb <dir>` to extract,
  then run node with `LD_LIBRARY_PATH=<dir>/usr/lib/x86_64-linux-gnu`.
- Write test scripts into the repo root (Node resolves `node_modules`
  relative to the script's own directory — a scratch dir elsewhere won't
  find `playwright`), spin up a plain `http.createServer` static file server
  pointed at `process.cwd()`, run the script, then **delete it before
  committing**. Confirm with `git status --short` that nothing test-related
  got staged.

## Other conventions

- The repo lives at `/home/marshux/Work/marshux.github.io` on the native WSL
  filesystem (ext4), not under `/mnt/c/...` — Windows-native Node/npm chokes
  on UNC paths for native-binary installs, so this has to stay a real Linux
  path. Real Node 20 is installed via NodeSource, not the Windows npm.
  `node_modules/` and `css/tailwind.css` are gitignored.
- Never reintroduce `backdrop-filter: blur()` on `.site-header` or
  `#player-bar` — it was a measured, repeat-confirmed performance problem
  (see the comment above `.site-header` in `css/style.css`). Use a
  near-opaque `color-mix()` background instead.
- Login/admin links live only inside `/admin/` — there is deliberately no
  nav-level login UI on the public pages (this was tried and reverted).
