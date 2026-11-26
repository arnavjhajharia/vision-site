# Why the best sites don't look vibe-coded

Research for the terraformlabs.ai / withlucy.ai redesign, 26 Nov 2026.
Screenshots (desktop 1440 and phone 390, first screen) are in `docs/research/`.
openai.com sits behind a bot check, so it was studied from memory only.

## What we measured

| Site | Headline type | Size / tracking | Background | Notes |
|---|---|---|---|---|
| Stripe | Söhne, weight 300 | 48px, -0.02em | white | Headline runs into a muted second sentence. One gradient, and it is the brand. |
| Linear | Inter Variable 510 | 64px / 1.0, -0.022em | #08090A | Hero is a real screenshot of the app. Body 15px, grey #8A8F98. |
| Wispr Flow | EB Garamond 400 | 96px, -0.03em | cream #FFFFEB | One serif, one sans. Proof as a number: 45 wpm vs 220 wpm. |
| Anthropic | own serif | 41px, -0.01em | #FAF9F5 | Mission as a left-aligned paragraph. Editorial illustrations, never glows. |
| Thinking Machines | Iowan Old Style | 17px body | white | Almost all text. A manifesto set like an essay. |
| Physical Intelligence | ui-monospace | 14px | #F5F4EF | Home page is a dated research list. Zero decoration. |
| DeepMind | Google Sans Flex 500 | 98px, -0.027em | white | Big type, then a dense news index. |
| Mistral | own grotesk 500 | 96px, -0.02em | #FBFBF8 | Brand colour blocks are a system, used on a strict grid. |
| Vercel | Geist 400 | 64px, -0.06em | #FAFAFA | Mono only for small labels. Logos as proof. |
| Cursor | own gothic 400 | 26px | #F7F7F4 | Small, calm hero; the product window does the talking. |
| Sakana, Perplexity, Figure | | | | Sakana: one mark, lots of white. Perplexity: the product is the page. Figure: one real photo, full bleed. |

## The patterns

1. **One typeface, used well.** Each site has one family (sometimes plus one serif or mono for a set job). Headlines are 500 weight or lighter, tracked tight (-0.02 to -0.04em), line height 1.0 to 1.1. Body is 15 to 18px with a muted colour, not white on black.
2. **Colour is quiet.** Off-white paper (#FAFAF8 to #F5F4EF) or near-black. Text is two or three greys. If there is an accent it has a job: a button, a link, the logo. No neon.
3. **The product is the picture.** Linear, Cursor, Perplexity and Vercel show real UI. Anthropic and Figure use real illustration or photography. Nobody uses abstract gradient blobs, glowing orbs or emoji as imagery.
4. **Left-aligned, on a grid.** Heroes sit on the left edge of a 12-column grid. Centred-everything heroes only appear where the hero is a single product input (Perplexity) or a pure brand moment (Sakana).
5. **Copy density is a choice.** Either very little (Wispr: "Don't type, just speak.") or a real paragraph (Anthropic, Thinking Machines). Never three buzzwords. Stripe and Linear use the two-tone sentence: claim in ink, explanation in grey.
6. **Lists beat cards.** Physical Intelligence, DeepMind and Thinking Machines use dated lists and hairline tables. Three identical icon cards in a row is the single loudest vibe-coded sign.
7. **Proof is specific.** Logos, numbers, dates, names. "45 wpm vs 220 wpm" beats "10x faster".
8. **Motion is rare.** Content is visible on load. Motion, when present, explains the product (Wispr's waveform). No fade-up on every section.
9. **Small type does the structure.** Nav, labels and captions at 13 to 14px. Mono only for data, dates and code.

## The vibe-coded checklist (what we removed)

- Neon accent (#C8FF00 lime) and dark-mode-only
- Italic serif word dropped into a sans headline for "emphasis"
- Mono eyebrow above every heading
- Three identical boxed cards
- Fade-in on scroll for every section
- Glow, radial gradients, noise, glass, sparkles, emoji
- Vague claims ("exponentially better", "frontier")

## Our rules (applied to every page)

- **Type:** Geist only (Geist Mono for dates, data and logs). Display 500, -0.035em. Body 17px / 1.55.
- **Colour:** paper `#FAFAF8` / ink `#111110` with two greys; dark mode is the same system inverted. One accent per product, used on the mark, links and one UI detail only.
  - Terraform Labs: ink (no accent)
  - AI Employees: amber `#B45309` (dark: `#F59E0B`)
  - Agent World: blue `#1D4ED8` (dark: `#7AA2FF`)
  - Lucy: keeps its own paper-and-ink brand
- **Layout:** 1200px max, 12-column grid, left-aligned, hairline rules instead of boxes.
- **Imagery:** real product UI built in HTML (an approvals log, a world ledger, a chat), never decoration.
- **Motion:** none on load. Agent World's simulation is the one moving thing, and it stops for reduced motion.
- **Copy:** plain English, specific, short. Claim in ink, explanation in grey.
