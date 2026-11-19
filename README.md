# Lucy site

Landing page for Lucy (With Lucy), served by GitHub Pages from `main` at https://withlucy.ai.

The `CNAME` file pins the custom domain `withlucy.ai`; keep it in the repo or GitHub Pages drops the domain.

## Lucy

[`lucy.html`](lucy.html) is the standalone page for **Lucy**, the consumer WhatsApp life admin product ([withlucy.com](https://withlucy.com)). It is deliberately omitted from `features.json`, which lists Vision-only capabilities for the Features tab and `sync-features.mjs`. Styling reuses the same CSS custom properties as `index.html` (`--bg`, `--ink`, `--glow`, and the rest).

## Features tab

`features.json` is the single source of truth for the Features section. Each new feature is one entry:

```json
{ "id": "my-feature", "name": "My feature", "category": "productivity", "area": "Planning", "status": "building", "source": "manual", "description": "One public-safe sentence." }
```

`category` must be one of the ids in the top-level `categories` block: `essential` (always included, shown as
"Included"), `productivity` or `builder` (optional, shown as "Choose to add"). Each category has a `name`, `tagline`
and `essential: true/false`. `area` is a small sub-label shown next to the feature name.

`status` is `live`, `building` or `planned`. Counts on the page are computed from this file.

Public Lucy modules (repo `public-vision`) are synced from their manifests:

```sh
node scripts/sync-features.mjs                      # reads ../public-vision/modules/*/manifest.json
node scripts/sync-features.mjs --ref origin/main    # or read a git ref without checking it out
node scripts/sync-features.mjs --dry                # preview counts only
```

Sync refreshes module names and descriptions but never overwrites a `status` or `category` you set by hand.
New modules go to the manifest's `category` if valid, else `--category <id>` (default `productivity`). New modules start as
`building`; modules that disappear are kept with `"removed": true` (hidden on the page).

## Pricing

Lucy is **free**. **Lucy Max** is $100/month for bespoke features — or free if you convince Lucy you're worth it
(ambassadors get Max free while active). The landing letter and the Features tab (`#pricing`) show both tiers. The
waitlist interview is onboarding only (always quotes $0 for Lucy).

## Waitlist interview (chat with Lucy)

After signup, Lucy runs a 5-question chat interview and shows a price quote. All copy (greeting, per-answer
reactions, branches, chip labels, free-text matching) lives in personal-agent `data/waitlist-interview.json`; the
page fetches it at signup, so editing that file changes the chat without touching this repo. `interview-core.js` is
the pure logic (branch picking, typed-answer matching, reactions); `node --test tests/` runs its tests (uses the real
config when personal-agent is checked out next to this repo).

## Ambassador referrals

Ambassador links look like `https://withlucy.ai/?ref=manya`. The page keeps the code in
localStorage (`vision-wl-ref`), prefills the optional "Who invited you?" field and sends it with the signup. The server
stores it on the waitlist record (first referral wins). Codes are listed in `ambassadors.json` (code -> name).

```sh
node scripts/ambassador-report.mjs          # signups and interviews per ambassador (reads ../personal-agent/data/waitlist.jsonl)
node --test tests/                          # includes the referral tests
```

Commission is not in code: an ambassador earns one month of what each referred client actually pays.
