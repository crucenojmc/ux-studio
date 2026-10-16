---
name: design-system-builder
description: "Trigger: design system, sistema de diseño, tokens, style guide, brand audit, auditar sitio, rediseño. Builds a brand design system from scratch or by auditing an existing site, and publishes it as a reusable claude.ai Design System artifact."
license: UNLICENSED
metadata:
  author: "Mapplics"
  version: "1.0"
---

## Activation Contract

- Runs when the `BRIEF.md` module plan selects it (its variant picks the path: reuse, from code, audit a web, from scratch) or on a direct request (mini brief). Never a mandatory step: `ux-studio:prototype-showcase` falls back to template tokens when the plan skips it.
- Use for a design system, tokens, a style guide, a site's brand audit, or a prototype request for a brand with no system.
- Input: the brief (`BRIEF.md`). None → ask for brand name, 3–5 brand words, audience.

## Hard Rules

- Never invent the brand definition (words, logo, colors, fonts); ask, one question at a time.
- Never copy another company's logo or design unless it is the user's own brand; logos only from real files, else plain type plus a note.
- Every system meets the tokens contract: `node ${CLAUDE_SKILL_DIR}/assets/tokens-to-css.mjs <tokens.json> --check` exits 0 before publishing.
- Text contrast 4.5:1 (3:1 at 24px+) in every theme and preview; distinguish colors by lightness; no AI tropes (blue-purple gradients, emoji cards, left-border cards).
- Build or publish only after the user picks a direction or approves the audit. Only the user marks a system as default.
- Deliverables use the brief's language.

## Decision Gates

| Situation | Path |
| --- | --- |
| Design System artifact for this brand exists | Reuse: `read` its `project/README.md`, `project/tokens.json`; `--check`; missing tokens → propose a revision |
| Repo has real styles/components | From code (beats screenshots): `from-code.md` (this skill's, no GitHub or publishing needed); React library → mention `/design-sync` |
| Site URL and/or screenshots | Audit: `path-from-existing-site.md` |
| Nothing | From scratch: `path-from-scratch.md` |

## Execution Steps

1. Read the brief; confirm brand name, words, audience, language, assets.
2. Run the gate's reference up to the user checkpoint.
3. Write `<dir>/project/` (Output folder below): `tokens.json` (shape of `tokens.sample.json`), `README.md` (`readme-template.md`), components, cover last.
4. `--check` until exit 0; fix or justify each warning.
5. Publish per `design-system-artifact.md`. No Artifact tool → return the `project/` tree for the parent session.
6. Ask the user to mark it default in claude.ai; continue with `ux-studio:prototype-showcase`.

## Output folder

`<dir>` is the folder the parent session gives (for example "write it to `docs/design-system/`").
Everything this skill writes goes under `<dir>/project/` (plus `<dir>/directions.html`, `<dir>/tokens.css` and
`<dir>/audit/` for local work). Without one it is `design-system/<slug>/` in the working project. Never
write outside `<dir>`; when the path is ambiguous, ask once.

## Output Contract

In the user's language: system name and link (or tree path), path taken, sources and assumptions, `--check` result and warnings, audit decision counts, inventory left, next step.

## References

- `${CLAUDE_SKILL_DIR}/references/path-from-scratch.md` — directions, roles, type, spacing, motion, voice, icons, components.
- `${CLAUDE_SKILL_DIR}/references/from-code.md` — repo styles: sources, inventory, mapping, naming, uniqueness.
- `${CLAUDE_SKILL_DIR}/references/path-from-existing-site.md` — capture, inventory, KEEP/CHANGE/ADD/DROP.
- `${CLAUDE_SKILL_DIR}/references/design-system-artifact.md` — create, upload, publish, consume, revise.
- `${CLAUDE_SKILL_DIR}/references/tokens-contract.md` — required tokens, CSS mapping, check.
- `${CLAUDE_SKILL_DIR}/assets/` — `tokens-to-css.mjs`, `extract-styles.mjs`, `tokens.sample.json`, `readme-template.md`, `audit-template.md`.
