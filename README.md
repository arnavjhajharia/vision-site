# Vision site

Landing page for Vision, served by GitHub Pages from `main`.

## Page layout

The page is one screen: a one-line hero, then a chat with Vision. There are no long sections. Vision introduces
itself and offers quick-reply chips (What can it do?, Pricing, Custom features, Join waitlist). Visitors can also type
questions or their email. Replies are short bubbles from `landingReply` / `landingTopic` / `landingChips` in
`interview-core.js` (tested in `tests/landing-chat.test.js`). Each reply steers back to signup, which runs the waitlist
interview in the same chat.

## Features (chat replies)

`features.json` is the single source of truth for the features Vision names in the chat. "What can it do?" lists a few
live features per category (the `PICKS` in `interview-core.js` first). Each new feature is one entry:

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

## Pricing

$1 to $20 a month, or $100/month for custom features. Vision gives this in the chat (the Pricing and Custom features
chips): **Vision** ($1–$20/month, priced by usage via the interview quote) and **Custom** ($100/month: "You describe a
feature. Vision builds it for you.").

## Waitlist interview (chat with Vision)

After signup, Vision runs a 5-question chat interview and shows a price quote. All copy (greeting, per-answer
reactions, branches, chip labels, free-text matching) lives in personal-agent `data/waitlist-interview.json`; the
page fetches it at signup, so editing that file changes the chat without touching this repo. `interview-core.js` is
the pure logic (branch picking, typed-answer matching, reactions); `node --test tests/` runs its tests (uses the real
config when personal-agent is checked out next to this repo).

## Ambassador referrals

Ambassador links look like `https://arnavjhajharia.github.io/vision-site/?ref=manya`. The page keeps the code in
localStorage (`vision-wl-ref`) and sends it with the signup. Without a code, Vision asks "Did someone invite you?"
after the email; a code or an ambassador's name (`refFromText`) becomes the code. The server
stores it on the waitlist record (first referral wins). Codes are listed in `ambassadors.json` (code -> name).

```sh
node scripts/ambassador-report.mjs          # signups and interviews per ambassador (reads ../personal-agent/data/waitlist.jsonl)
node --test tests/                          # includes the referral tests
```

Commission is not in code: an ambassador earns one month of what each referred client actually pays.
