# Pieces: social posts, marketing pieces, banners and one-pagers

Read this only when the deliverable is a piece. Icons have their own reference.

## 1. Choose the medium

| Situation | Medium |
| --- | --- |
| Your tool list has the `Artifact` tool and its quickstart (`intent: "design"`) offers a Design type | A claude.ai **Design artifact** built with the design system. Best for review and iteration with the user. |
| No Design type, no `Artifact` tool, or the caller needs PNG files the artifact cannot export | A **single HTML file** in `tmp/<topic>/`, built from the design-system tokens and rendered with `export.mjs`. |

Never switch medium on your own: the caller's envelope or `BRIEF.md` decides; when neither says, use the
first row that applies and state it in the return. Without the `Artifact` tool, build the HTML, verify it
and return its path for the caller to publish.

## 2. The HTML route

1. Copy `${CLAUDE_SKILL_DIR}/assets/piece-template.html` to `tmp/<topic>/<piece>.html` and the design
   system's `tokens.css` beside it. Replace the provenance comment with the source of the piece (envelope
   objective, brief section or spec).
2. Write the copy and compose the spot illustration from primitives (circle, rect, line, polyline, path)
   coloured only with tokens. Keep every element that carries the message inside `[data-safe]`.
3. Render every requested format into a distinct output folder:

   ```bash
   node ${CLAUDE_SKILL_DIR}/assets/export.mjs --input tmp/<topic>/<piece>.html \
     --out tmp/<topic>/graphics/<run>/ --preset social          # or social-link, --size 1440x480 …
   node ${CLAUDE_SKILL_DIR}/assets/export.mjs --input … --preset social-square --dpr 2   # sharper copy
   ```

4. Look at every PNG downscaled to at most 1000 px wide (Budget #2) and at the size it will be shown
   (a feed shows a 1080 px image at roughly a third of its width); a 1:1 crop only where a check
   flags a defect. Check the contrast (section 5). Fix and re-render.
5. Return the HTML path, the PNG paths and `manifest.json`.

The template is one artboard that fills the viewport, so one file serves every format below. Layout,
margins and type follow a unit `u`: 1% of the short side, 1.25% at 3:2 or wider, 1.5% at 9:5 or wider
(link cards are shown small).

## 3. Layout grid and safe area per format

| Format | Size (px) | Preset | Columns | Gutter | Safe area (margin) | Layout in the template |
| --- | --- | --- | --- | --- | --- | --- |
| Square 1:1 | 1080×1080 | `social-square` | 6 | 26 | 80 on every side | brand and copy on top; CTA and illustration below |
| Portrait 4:5 | 1080×1350 | `social-portrait` | 6 | 26 | 80 on every side | brand · copy · illustration · CTA |
| Link card 1.91:1 | 1200×630 | `social-link` | 12 | 23 | 70 on every side | copy in 7 columns, illustration in 5 |
| Landscape 16:9 (banner, cover, slide) | 1920×1080 | `social-landscape` | 12 | 32 | 100 on every side | copy in 7 columns, illustration in 5 |
| Web banner | any, such as 1440×480 | `--size` | 12 | 2.4u | 7.4u | wide layout from 3:2 |
| One-pager (A4 at 96 dpi) | 794×1123 | `--size 794x1123 --dpr 2` | 12 | 16 | 48 | document layout, see section 6 |

- Nothing that carries the message (text, logo, call to action, the key shape) goes outside the safe area:
  feeds, link cards and banners crop or round corners, and a piece is often shown much smaller.
- Link cards are often shown at a fraction of their size: headline plus one short line, no captions, no
  small print.
- Backgrounds and decorative shapes may bleed to the edges.
- App icons: Android adaptive icons keep the mark inside the central 66 of 108 units (about 61%); iOS
  masks the corners. Keep the mark inside the central 60–80% and use an opaque background.
- Favicons: one simple shape that still reads at 16 px; check `favicon-16x16.png` at 1×.

## 4. Type scale

Use the design system's families (`--font-display` for the headline, `--font-sans` for the rest).
The sizes below are the template's (`8.2u / 4.4u / 3u / 2.4u`), in px at 1×:

| Format | Headline | Subhead | Body | Caption (minimum) |
| --- | --- | --- | --- | --- |
| 1080×1080 and 1080×1350 | 89 | 48 | 32 | 26 |
| 1200×630 | 77 | 42 | 28 | avoid |
| 1920×1080 | 111 | 59 | 41 | 32 |
| One-pager 794×1123 | the system's `display` style | `heading` | `body` | `caption` |

- One message per piece; a headline of a few words, at most three lines.
- Line height 1.05–1.15 for headlines, 1.3–1.5 for body; measure up to 16 characters of headline per
  line in square formats and up to 36 for body.
- Never set text below the caption size for its format: it becomes unreadable when the piece is scaled
  down.

## 5. Contrast

Text inside images is still text: **4.5:1** against what is behind it, **3:1** for large text (at least
24 px regular or 18.66 px bold at the size it is shown). When the display size is unknown, treat all
text as normal text (4.5:1). Meaningful shapes (a chart line, an icon that is the message) need 3:1
against their background.

- Prefer token pairs the design system already validates (`text-primary` and `text-secondary` on
  `surface-page`, `on-accent` on `accent`; see design-system-builder's `tokens-to-css.mjs --check`).
- For text over a shape, gradient or image, measure against the lightest and darkest pixels behind the
  text in the exported PNG. Ratio = (L1 + 0.05) / (L2 + 0.05), with L the relative luminance:
  `0.2126 R + 0.7152 G + 0.0722 B` on linearised channels (`c ≤ 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4`).
- Below target: add a solid panel or scrim from the tokens, or move the text; never thin the text.
- Never carry meaning by colour alone.

## 6. One-pagers

A one-pager is read like a document: use the design system's text styles (`--text-body-size` and so
on), a 12-column grid with 48 px margins on 794×1123, a clear hierarchy (title, three to five sections,
a closing contact or next step) and real hierarchy over decoration. Export with
`--size 794x1123 --dpr 2` for screen sharing. For a PDF, add `@page { size: A4; margin: 0 }` and print
the HTML from the browser; `export.mjs` writes PNG only.

## 7. Brand and imagery

- Client brand assets (logo, fonts, photos) only when the client supplied and approved them; record
  where they came from in the piece's provenance comment. Otherwise the neutral mark in the template.
- Never reproduce third-party trademarks or logos, including app-store badges or social-network marks.
- Illustrations are geometric or spot illustrations from primitives. No photo-realistic or AI-generated
  imagery unless a tool for it is in your tool list; when the brief asks for it, return a question
  offering supplied imagery or a geometric alternative.
