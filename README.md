# Vision site

Landing page for Vision, served by GitHub Pages from `main`.

## Features tab

`features.json` is the single source of truth for the Features section. Each new feature is one entry:

```json
{ "id": "my-feature", "name": "My feature", "category": "Planning", "status": "building", "source": "manual", "description": "One public-safe sentence." }
```

`status` is `live`, `building` or `planned`. Counts on the page are computed from this file.

Public Vision modules are synced from their manifests:

```sh
node scripts/sync-features.mjs                      # reads ../public-vision/modules/*/manifest.json
node scripts/sync-features.mjs --ref origin/main    # or read a git ref without checking it out
node scripts/sync-features.mjs --dry                # preview counts only
```

Sync refreshes module names and descriptions but never overwrites a `status` you set by hand. New modules start as
`building`; modules that disappear are kept with `"removed": true` (hidden on the page).
