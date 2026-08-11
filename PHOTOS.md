# Publishing photos

Photos are published through a login-gated admin panel at
**https://marshux.github.io/admin/**, not by hand-editing files.

- Click **Login with GitHub**. Only accounts with push access to
  `marshux/marshux.github.io` can actually publish — see `SETUP.md` for the
  one-time OAuth setup.
- Drag and drop (or select) as many photos as you want at once. Each uploads
  straight to Cloudinary; a caption field appears next to each thumbnail as
  soon as it finishes.
- Every existing photo is shown the same way — edit its caption inline, or
  click &times; to remove it.
- The admin grid mirrors the live collage layout exactly, so what you see is
  what gets published. Drag any photo to reorder it, and use the size
  dropdown on each card (Small/Wide/Tall/Big) to change its tile shape.
- Click **Publish changes** to commit everything (new uploads, caption edits,
  reordering, resizing, deletions) to `data/photos.json` on `main` in one go.
  The photography page reads that file and renders whatever's listed, in the
  order and sizes you set.

The Cloudinary upload itself is signed server-side by the same Cloudflare
Worker that handles GitHub login (see `cloudflare-worker/oauth-proxy.js`) —
it checks your GitHub token has push access before issuing a signature, so
the Cloudinary API secret never reaches the browser and there's no exposed
upload preset for anyone else to abuse.
