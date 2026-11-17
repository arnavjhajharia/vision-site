# Vision site

Landing page for Vision, served by GitHub Pages from `main`.

## Features tab

`features.json` is the single source of truth for the Features section. Each new feature is one entry:

```json
{ "id": "my-feature", "name": "My feature", "category": "productivity", "area": "Planning", "status": "building", "source": "manual", "description": "One public-safe sentence." }
```

`category` must be one of the ids in the top-level `categories` block: `essential` (always included, shown as
"Included"), `productivity` or `builder` (optional, shown as "Choose to add"). Each category has a `name`, `tagline`
and `essential: true/false`. `area` is a small sub-label shown next to the feature name.

`status` is `live`, `building` or `planned`. Counts on the page are computed from this file.

Public Vision modules are synced from their manifests:

```sh
node scripts/sync-features.mjs                      # reads ../public-vision/modules/*/manifest.json
node scripts/sync-features.mjs --ref origin/main    # or read a git ref without checking it out
node scripts/sync-features.mjs --dry                # preview counts only
```

Sync refreshes module names and descriptions but never overwrites a `status` or `category` you set by hand.
New modules go to the manifest's `category` if valid, else `--category <id>` (default `productivity`). New modules start as
`building`; modules that disappear are kept with `"removed": true` (hidden on the page).
