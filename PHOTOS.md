# Publishing photos

Photos are published through a login-gated admin panel at
**https://marshux.github.io/admin/**, not by hand-editing files.

- The admin panel is [Decap CMS](https://decapcms.org), backed by this GitHub
  repo. Logging in requires a GitHub account with push access to
  `marshux/marshux.github.io` — see `SETUP.md` for the one-time OAuth setup.
- Uploading an image opens Cloudinary's media library widget, which requires
  logging into the Cloudinary account tied to the configured `api_key`
  (in `admin/config.yml`). The Cloudinary API secret is never used by the
  site or stored anywhere in this repo.
- Saving in the admin panel commits directly to `data/photos.json` on `main`;
  the photography page reads that file and renders whatever's listed.

No local file management needed — everything happens through the admin UI.
