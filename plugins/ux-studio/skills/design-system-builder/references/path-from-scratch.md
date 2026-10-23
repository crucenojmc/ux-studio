# Path: a design system from scratch

Use when the brand has no design system artifact, no code with real styles and no site to audit.

## 1. Inputs (from the brief; ask only for what is missing, one question at a time)

| Input | Why | If missing |
| --- | --- | --- |
| Brand name | the system's `title` and `name` | ask |
| 3–5 brand words ("sereno, preciso, cercano") | they choose the direction | ask; never invent them |
| Audience and product type (internal back office, consumer app, field tablet…) | density, type size, contrast margin | from the brief |
| Constraints (accessibility level, devices, dark mode, languages) | theme set, minimum sizes | assume both themes, WCAG AA |
| Logo, brand colors, brand fonts (files or values) | they are inputs, never approximations | none → plain type for the mark, say so |

## 2. Direction: one by default

Write one local board, `<dir>/directions.html`, with a single column: the direction the brand words
and the brief point to. Write 2–3 columns, and let the user pick ONE, only when the brief asks to
choose among options. Each column:
a name and one sentence tied to the brand words; the palette as large swatches (page, raised,
text, accent, two status colors) in light and dark; the type pairing as a real specimen (display
line, heading, a body paragraph in the brief's language, a caption); one button, one input and one
card rendered with that direction. With several columns, vary what actually differs — hue family
and neutral temperature, serif vs sans display, square vs soft radii — not three tints of the same
idea.

One direction: give the path and its two-line summary, and go on to build it. Several: give the
path, summarize each direction in two lines, and ask which one to build. Build nothing else until
the user picks. Mixing ("A's color with B's type") is a valid pick.

## 3. Build the chosen direction

**Color roles, both themes.** Start from the brand hue. Work in OKLCH so lightness is controlled:
neutrals carry a faint tint of the brand hue (chroma ≤ 0.02); `accent` sits near L 0.40–0.50 in
light and 0.70–0.80 in dark; `on-accent` is whichever of near-white / near-black clears 4.5:1.
`surface-sunken` < `surface-page` < `surface-raised` in light; in dark, raised surfaces get
lighter, not shadowed. Status colors: text-strength value plus a pale (light) / deep (dark) `-bg`.
`series-1..5` differ in lightness as well as hue (one dark, one light, three between), all ≥ 3:1 on
the page. `focus-ring` is usually an alias `{accent}`. Write a `usage` note on every token naming
where it goes and on which ground. Run `tokens-to-css.mjs --check` and fix every error and
warning.

**Typography.** 1–3 Google Fonts families: `sans` (UI, required), optionally `display` and
`mono`. Pick for legibility at the product's density first, character second. Text styles
`display title heading body label caption` on a 1.2–1.333 ratio (body 15–16 px for desktop
tools, 16–17 px for consumer; caption ≥ 12 px); line height 1.4–1.6 for text, ~1.1 for display;
2–3 weights. Hosted fonts appear only in `type.families`.

**Spacing, radii, shadows.** 4 px base, `space-1..8` = 4 8 12 16 24 32 48 64 unless the brand
needs a denser scale. Radii from the brand words: precise → 2/4/8; friendly → 6/10/16; pills only
where the brand uses them. Two elevations (`shadow-raised`, `shadow-overlay`), per theme.

**Motion.** Principles (2–3 lines: what moves, why, how fast) plus tokens in the README "Motion"
section: the defaults `--duration-fast:120ms`, `--duration-base:200ms`, `--duration-slow:320ms`,
`--ease-out`, `--ease-in-out`, `--ease-sheet`. Change them only with a reason, via a
`motion.json` passed to `--motion`. Always: respect `prefers-reduced-motion` (fade or no motion).

**Voice and tone.** 3–4 principles with one "say / don't say" pair each, in the brief's language:
how to name actions, how to write errors (what happened + what to do), numbers and dates format.

**Iconography.** One open-licence icon set, one stroke width, sizes 16/20/24, icons inherit the
text color token of their context; an icon never carries status alone (pair it with a word).

**Starter components** — each with `components/<Comp>/README.md` (first sentence = summary;
anatomy, states, tokens used, do / don't, what the consumer provides) and
`components/<Comp>/preview.html` (first line `<!-- @dsCard group="…" height=N -->`, a few states,
only `var(--token)` values, readable in both themes):

| Component | Group | States to preview |
| --- | --- | --- |
| Button | Actions | primary, secondary, ghost, disabled, focus |
| Input | Forms | empty, filled, error with message, disabled |
| Select | Forms | closed, open list |
| SegmentedControl | Forms | 2–4 options, one selected |
| Card | Content | with title, meta and an action |
| TableRow | Content | default, hover, selected, with a badge |
| Badge | Status | ok, warn, danger, info, neutral |
| Tabs | Navigation | selected, hover, with count |
| Toast | Feedback | ok and danger, with action |
| Sheet | Overlays | bottom sheet (mobile) and side drawer, with scrim |

## 4. Before publishing

Show the user the system locally: `tokens-to-css.mjs <tokens.json> --style-classes --out
<dir>/tokens.css` (outside `project/`; never published), link it from each preview
while viewing locally, and render each preview in the themes the brief or product declares, checked once at the end. Iterate on what they flag. Then
follow `design-system-artifact.md` (previews use the page's text-style classes, not `--text-*`).
