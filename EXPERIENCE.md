# Professional history

`experience.html` renders `data/experience.json` as a list, in the order
the file lists them — put the most recent role first.

## Schema

```json
{
  "roles": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "location": "City, State",
      "start": "2024",
      "end": "Present",
      "description": "One or two sentences on scope and impact.",
      "tags": ["Backend", "Python"]
    }
  ]
}
```

- `company`, `role` &mdash; required for the entry to be meaningful, but
  nothing crashes if they're missing (`role` falls back to "Untitled role",
  a missing `company` just leaves that line out).
- `location` &mdash; optional, shown next to the company as
  "Company &middot; Location".
- `start` / `end` &mdash; free-text, not parsed as real dates. Use "Present"
  for a current role. Either can be omitted.
- `description` &mdash; optional, a sentence or two.
- `tags` &mdash; optional array of short strings, rendered as pills (skills,
  team, stack — whatever's useful).

No admin-panel UI for this file (same as `data/project-overrides.json`) —
edit `data/experience.json` directly and commit it. If the array is empty,
the page shows "Professional history coming soon." instead of an empty list.
