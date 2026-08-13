# marshux.github.io

Personal site for Marshal Xu — [marshux.github.io](https://marshux.github.io).
A static, multi-page site with an editorial "paper" look (Playfair Display
headings, warm light/dark theme), a self-managed content workflow, and no
backend of its own.

## Tech stack

- **Frontend**: plain HTML/CSS/JS — no framework, no bundler, no build step
  for the public pages. Theme colors, spacing, and fonts are driven by CSS
  custom properties, so light/dark mode is a single attribute flip.
- **Hosting & CI/CD**: GitHub Pages, deployed via a GitHub Actions workflow
  on every push to `main`.
- **Media**: images and audio are hosted on Cloudinary, served through its
  `f_auto,q_auto` auto-optimization and on-the-fly resizing so the browser
  never downloads more than a given layout needs.
- **Content data**: photos, tracks, projects, and work history are all
  simple JSON manifests fetched client-side at runtime — no database, no
  server-side rendering.
- **Live data**: the Projects page also pulls directly from the public
  GitHub REST API (unauthenticated) to list repositories in real time.
- **Admin tooling**: a small login-gated panel (Tailwind CSS v4 for its UI)
  for managing photos and music without hand-editing JSON.

## Features

- **Editorial theme with a cheap toggle** — dark/light mode swaps CSS custom
  properties and crossfades via the View Transitions API, rasterizing the
  before/after states once each rather than animating colors live.
- **Client-side navigation** — clicking between pages doesn't do a full
  reload; a small router intercepts internal links, fetches the new page,
  and swaps just the content region in place. This is also what lets the
  music player keep playing as you move around the site.
- **"Now Playing" widget** — a persistent player with play/pause, next/prev,
  a visible queue, seek, and a volume slider, backed by a plain `<audio>`
  element. Playback position and preferences persist across a session.
- **Photography board** — a responsive collage grid with configurable tile
  sizes, lazy loading, and skeleton placeholders that fade into the loaded
  image instead of popping in.
- **Projects feed** — live GitHub repositories rendered as a row list, with
  an optional manifest for adding a thumbnail, a custom summary, and tags
  per repo on top of what the API provides.
- **Professional history** — a structured timeline of roles driven by a JSON
  file, no code changes required to add an entry.
- **Content management** — photos and music are published through a
  browser-based admin panel with drag-and-drop upload, inline editing, and
  drag-to-reorder, gated to authorized accounts. Access control and upload
  authorization are handled server-side; no credentials or signing logic
  live in the client.

## Project structure

```
├── index.html, projects.html, photography.html, experience.html
├── partials/        shared nav/footer/player markup, injected at runtime
├── js/               router, theme toggle, player, page includes
├── css/              theme + layout styles; Tailwind build for admin/
├── data/             JSON content manifests (photos, playlist, projects, experience)
├── admin/             content management panel
└── cloudflare-worker/  server-side auth/signing proxy the admin panel talks to
```

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — architecture overview and conventions
- [`PHOTOS.md`](PHOTOS.md) / [`MUSIC.md`](MUSIC.md) — publishing photos and
  music through the admin panel
- [`PROJECTS.md`](PROJECTS.md) / [`EXPERIENCE.md`](EXPERIENCE.md) — adding
  project overrides and work history entries
- [`SETUP.md`](SETUP.md) — one-time infrastructure setup

## Development

No formal test suite — this is a static site with no server-side logic to
unit test. Behavioral changes (navigation, playback, drag-and-drop) are
verified with real headless-browser runs during development rather than
assumed from source alone.
