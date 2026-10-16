# Path: a design system from an existing site

Use when the user has a live site (URL) and/or screenshots, and wants a design system that keeps
what works and fixes what departs from the brand.

## 1. Inputs

| Input | Rule |
| --- | --- |
| URL and/or screenshots | which pages matter: home plus 2–3 key templates (list, detail, form) |
| Brand definition: brand guide, logo files, brand words, brand colors and fonts | REQUIRED to judge "on-brand". Missing → ask for it. Never invent it, never infer it from the site itself (the site is what is being judged). |
| Whose brand | the site must be the user's own brand (or their client's, with the client's assets). Never reproduce another company's logo or proprietary design. |

## 2. Capture

**With a URL** (per page, into its own folder):

```bash
# playwright-core: once in the git-ignored workspace (cd tmp/ && npm init -y && npm i -D playwright-core)
# or once for every project (npm i -g playwright-core); it downloads no browser
node ${CLAUDE_SKILL_DIR}/assets/extract-styles.mjs <url> --out <dir>/audit/<page> --widths 1440,390   # widths from the BRIEF's platform: Web 1440, Mobile 390, Web y mobile both
```

`playwright-core` resolves from the current folder and its parents, then `NODE_PATH`, then the global
npm root (`UX_STUDIO_GLOBAL_NODE_MODULES` overrides it), then next to the script. Never add it to a
product's `package.json`: use the workspace (run the script from there) or the global install. A local
`.html` file works as input too.

It writes one `screenshot-<width>.png` per width (full page) and `styles.json`: text,
background and border colors as hex, font stacks, sizes, line heights, weights, radii, spacing
values and shadows — each with `count`, the `widths` where it appears and up to three `samples`
(`tag#id.class`). It uses a local Chrome/Chromium (`CHROME_PATH`, HyperFrames' headless shell, the
Playwright cache, `google-chrome`, `chromium`). Exit 2 = install `playwright-core`; exit 3 = no
browser (ask the user to install Chrome or set `CHROME_PATH`). Pages behind a login: ask the user
for screenshots instead; never ask for credentials.

**With screenshots only:** read each image, sample colors from flat areas, estimate sizes against
known elements. Label EVERY such value "aproximado" in the audit and prefer brand-guide values
where they exist.

## 3. Inventory

From `styles.json` and the screenshots, list every color, font, size, radius, spacing value,
shadow and component pattern (buttons, inputs, cards, navigation, tables, badges, modals) with its
frequency and where it appears. Merge near-duplicates into one row and list the variants: grays
within ~2 % lightness of each other, the same hue drifting a few degrees, radii 3/4/5 px, spacing
off a 4 px grid (13, 18, 22 px).

## 4. Classify each row

| Decision | When | The row must give |
| --- | --- | --- |
| KEEP | on-brand, used consistently, accessible | the token it becomes |
| CHANGE | off-brand hue, near-duplicate grays, failing contrast, inconsistent radii or spacing | the replacement value and token |
| ADD | missing: semantic states, second theme, focus ring, motion, disabled/empty states | the new token or component |
| DROP | one-offs, dead variants, decoration that fights the brand | what replaces its uses |

Evidence per row: the hex (or "aproximado"), the contrast ratio where text or a control is
involved (`tokens-contract.md` has the one-liner), and a screenshot crop or a selector from
`samples`. Fill `assets/audit-template.md` in the brief's language.

## 5. Show, iterate, then publish

1. Present the audit table and the proposed system side by side: the KEEP/CHANGE/ADD/DROP table,
   the new `tokens.json` passing `--check`, and a local preview sheet (tokens + the starter
   components from `path-from-scratch.md` §3, restyled to this brand).
2. Iterate with the dev on every CHANGE and DROP they question. Product calls (e.g. "is this
   orange part of the brand?") are theirs.
3. Only after approval publish (`design-system-artifact.md`), with a README "Decisions" section
   (KEEP/CHANGE/ADD/DROP and why). The user marks it as the default design system in claude.ai.

## Logos and marks

Copy logos only from real files the user provides (SVG preferred) into `assets/Logos/`. Never
trace, redraw or screenshot-crop a mark into a logo asset. No file → the system uses the brand
name in plain type and the README says so.
