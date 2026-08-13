# Projects page

`projects.html` pulls the live repo list from the **unauthenticated** public
GitHub API (`js/main.js` → `loadProjects()`), listing every repo under
`github.com/marshux` that is not a fork and not in `HIDDEN_REPOS` (the site
repo itself and the `marshux` profile-README repo).

This is deliberate: it's a static site with no server, so there is no safe
place to hold a token that could read private repos. **Private repos will
never show up here.** To feature something on this page, it has to be public
(or the repo itself doesn't need to be public — see below).

## Adding an image / TLDR / tags for a repo

Each row renders straight from the GitHub API by default (repo name,
description, primary language, star count). To dress a specific repo up with
a thumbnail, a punchier one-line summary, and topic tags, add an entry to
`data/project-overrides.json` keyed by the **exact, case-sensitive repo
name**:

```json
{
  "COVIDTracker": {
    "image": "https://res.cloudinary.com/hf0tmghh/image/upload/v.../thumb.jpg",
    "tldr": "Real-time COVID case dashboard built for a class project.",
    "tags": ["Python", "Flask", "Data Viz"]
  }
}
```

All three fields are optional and fall back independently:

- `image` — omit it and the row just renders without a thumbnail (no broken
  placeholder). When present, it's run through the same Cloudinary
  `f_auto,q_auto,c_limit` auto-optimize helper used for the photo grid.
- `tldr` — falls back to the repo's GitHub description, then to
  `"No description yet."`.
- `tags` — falls back to a single tag from the repo's detected primary
  language, or no tags at all if GitHub has none.

There's no admin-panel UI for this file (unlike Photos/Music) — edit
`data/project-overrides.json` directly and commit it.

## Hiding a repo entirely

- Make it a fork, or
- Make it private, or
- Add its name to `HIDDEN_REPOS` in `js/main.js`.

An override entry for a repo that's private, hidden, or forked is harmless —
it's simply never reached because the repo never appears in the API
response in the first place.
