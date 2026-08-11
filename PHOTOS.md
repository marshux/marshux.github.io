# Adding photos to the Photography board

Photos are hosted on [Cloudinary](https://cloudinary.com) (free tier) rather than
committed to this repo — no binaries in git, and Cloudinary auto-optimizes
format/quality/size on delivery.

## One-time setup

1. Sign up free at https://cloudinary.com (no credit card required).
2. On your Cloudinary dashboard, copy your **Cloud Name**.
3. Open `js/main.js` and set:
   ```js
   const CLOUDINARY_CLOUD_NAME = "your-cloud-name";
   ```
4. Commit and push that change.

## Adding a new photo

1. In the Cloudinary dashboard, open the **Media Library** and upload the image
   (drag and drop). No need to resize/compress beforehand — Cloudinary handles
   that on delivery.
2. Copy the image's **Public ID** shown in the Media Library (e.g. `portfolio/sunset-ridge`).
3. Add an entry to `data/photos.json`:
   ```json
   { "publicId": "portfolio/sunset-ridge", "alt": "Sunset over the ridge" }
   ```
4. Commit and push `data/photos.json`.

The photography page reads this manifest and builds an optimized, auto-formatted
delivery URL for each entry — nothing else to configure per photo.
