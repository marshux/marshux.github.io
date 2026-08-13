# Publishing music

The site plays a background playlist through a small player bar shown on
every public page. Like photos, tracks are managed through the same
login-gated admin panel at **https://marshux.github.io/admin/**, under the
**Music** section below Photos.

- Drag and drop (or select) audio files. Each uploads straight to
  Cloudinary; a row with editable **Title** and **Artist** fields appears
  once it finishes.
- Drag rows to reorder the queue &mdash; that's the order visitors hear
  tracks in, and it loops back to the first track after the last one.
- Click **Publish changes** to commit both the photo and music changes (only
  whichever you actually edited) to `data/photos.json` /
  `data/playlist.json` on `main` in one go.
- If there are no tracks in `data/playlist.json`, the player bar simply
  doesn't appear on the site.

No extra setup is needed beyond what `SETUP.md` already covers &mdash; music
uploads reuse the same GitHub-gated Cloudinary signing (`/sign-upload`) that
photos use, just pointed at Cloudinary's audio/video upload endpoint instead
of its image one.

## A note on cross-page playback

Clicking between pages (Me / Projects / Photography) never actually reloads
&mdash; `js/router.js` swaps the page content in place and leaves the
`<audio>` element alone, so playback is genuinely gapless there.

A real page refresh or a fresh visit to a URL is a real reload, so the
`<audio>` element does get recreated. The player remembers the current
track, position, volume, and mute state (`sessionStorage`) and tries to
resume automatically. Browsers are conservative about autoplaying audio with
sound, so that resume can silently fail to auto-start on some page loads
&mdash; when that happens the player just stays paused at the same spot
instead of picking back up on its own, and a visitor can hit play to
continue. There's no reliable way to guarantee gapless playback across a
real page reload on a static site.
