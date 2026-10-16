---
name: graphic-assets
description: "Trigger: icon set, icons, sprite, favicon, app icon, export PNG, social post, banner, one-pager, marketing piece. Specifies and generates icon sets; renders SVG or HTML pieces to PNG at sizes and DPR."
license: UNLICENSED
metadata:
  author: "Mapplics"
  version: "1.0"
---

## Activation Contract

`ux-designer` runs it from the caller's task envelope (objective, inputs, platform, constraints, output dir, return budget; see `${CLAUDE_PLUGIN_ROOT}/skills/presentation-brief/references/task-envelope.md`). `BRIEF.md` is optional; when present, its module plan and design scope apply. Deliverables: icon sets (SVG per icon, sprite, contact sheet), PNG exports (sizes × DPR 1–3, app icon, favicon, social) and pieces (social posts, marketing pieces, banners, one-pagers). Uses the design system's `tokens.css` when one exists. If the objective, the deliverable, the formats or a required brand asset is missing, return a closed-option questionnaire to the caller first and build nothing that depends on it.

## Hard Rules

- Never reproduce third-party trademarks or logos. Client brand assets only when the client supplied and approved them; otherwise a neutral style.
- Illustrations are geometric or spot illustrations built from primitives (path, line, rect, circle, polyline). Never claim photo-realistic or AI-generated imagery unless a tool for it is in your tool list.
- Every output records its source spec: the scripts write `manifest.json` (source and SHA-256) and a provenance comment in each SVG and HTML; hand-made files carry the same comment.
- Outputs go to `--out`, default `tmp/<topic>/graphics/`, git-ignored; the scripts refuse a folder git tracks. Use a distinct `--out` per invocation so parallel runs never collide. Never write into a product repository: delivering assets into a product is `ui-developer`'s job, with the user's consent.
- Colour only from tokens: icons draw with `currentColor`, pieces with `var(--token)`. Text inside images meets 4.5:1, or 3:1 for large text.
- Never install anything or download a browser: return the install commands the scripts print.

## Decision Gates

- Deliverable: read `${CLAUDE_SKILL_DIR}/references/icon-guidelines.md` only for an icon set and `${CLAUDE_SKILL_DIR}/references/pieces.md` only for a piece; an export of existing files needs neither.
- Piece medium: a claude.ai Design artifact when the `Artifact` tool offers a Design type; otherwise one HTML file in `tmp/<topic>/` exported with `export.mjs` (`pieces.md` §1).
- Brand: no supplied and approved assets → neutral style, and say so once.
- Imagery the rules forbid (a third-party logo, a photo, AI art) → one questionnaire item offering supplied assets or a geometric alternative (recommended).
- Optional accelerators: if the `ui-ux-pro-max` or `huashu-design` skills are installed, they may inform style choices (mood, palette, layout); this skill's rules and output contract still apply.

## Execution Steps

1. Icons: copy `${CLAUDE_SKILL_DIR}/assets/icons.spec.example.json` to `tmp/<topic>/icons.spec.json` and specify the set.
2. `node ${CLAUDE_SKILL_DIR}/assets/icon-set.mjs --spec tmp/<topic>/icons.spec.json --check`; fix every error and each unintended warning.
3. `node ${CLAUDE_SKILL_DIR}/assets/icon-set.mjs --spec … --out <dir> --tokens <tokens.css>` (`--topic <topic>` instead of `--out` writes to `tmp/<topic>/graphics/`; `--size <px>` only when the consumer needs width/height).
4. Review `preview.html` in every theme at 1× and 4× (render it with `export.mjs --size 1200x900`); iterate.
5. Pieces: build from `${CLAUDE_SKILL_DIR}/assets/piece-template.html` following `pieces.md`.
6. Export: `node ${CLAUDE_SKILL_DIR}/assets/export.mjs --input <file.svg|file.html> --out <dir> --preset <name>` or `--size <W>x<H> --dpr 1,2,3` (`--list-presets`, `--help`). Look at every PNG before returning it.

## Output Contract

- In the output folder: `svg/<name>.svg`, `icons.svg` and `preview.html` for icons; the piece HTML (in `tmp/<topic>/`) and its PNGs; `favicon.ico` with the favicon preset; `manifest.json` always.
- Return within the envelope's budget: a summary, the paths and the questions. The summary is at most five lines (what was made, counts, checks run and their result); questions are closed options with the recommended one first. Never paste file contents.

## References

- `${CLAUDE_SKILL_DIR}/references/icon-guidelines.md` (icons only) · `${CLAUDE_SKILL_DIR}/references/pieces.md` (pieces only)
- `${CLAUDE_SKILL_DIR}/assets/icon-set.mjs` · `${CLAUDE_SKILL_DIR}/assets/export.mjs` · `${CLAUDE_SKILL_DIR}/assets/lib/cli.mjs`
- `${CLAUDE_SKILL_DIR}/assets/icons.spec.example.json` · `${CLAUDE_SKILL_DIR}/assets/piece-template.html`
