# Adding photos to the Photography board

1. Drop the image file into this `photos/` folder (JPG/PNG/WebP, keep it under ~1-2MB — resize/compress before adding so the page stays fast).
2. Add an entry to `photos.json` in this same folder:

```json
{ "file": "sunset-ridge.jpg", "alt": "Sunset over the ridge" }
```

3. Commit and push. The grid on the homepage reads `photos.json` and renders every entry in order.

There's no build step — just files + a JSON list.
