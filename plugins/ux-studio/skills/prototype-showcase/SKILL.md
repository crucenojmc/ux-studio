---
name: prototype-showcase
description: "Trigger: prototype showcase, presentar prototipo, prototipo navegable, demo de flujos, scroll story. Builds one claude.ai artifact: a navigable prototype in the format the brief chose (app only, app with guided tours, or the complete UX system)."
license: UNLICENSED
metadata:
  author: "Mapplics"
  version: "1.0"
---

## Activation Contract

Runs when the `BRIEF.md` module plan selects "Presentación del prototipo" or on a direct request. Use when an app design must become a page people navigate: showcase, navigable prototype, flow demo, or a copy of a reference showcase. Inputs: scope, the BRIEF at the path the parent gives (`ux-studio:presentation-brief`), `tokens.css` (`ux-studio:design-system-builder`), any reference page. Output feeds `ux-studio:prototype-to-video` through `window.SHOWCASE`.

## Hard Rules

1. Preflight the Artifact tool before building; if it is off, stop and explain how to enable it. Never switch medium.
2. The format comes from the BRIEF section "Formato de la presentación": `LAYOUT.mode` (`app`, `tour`, `ux-system`) and `LAYOUT.sections`. The design scope comes from "Alcance del diseño": `LAYOUT.platforms` (`['web']`, `['phone']`, `['web', 'phone']`) and `LAYOUT.roles` (`'single'`, `'all'`, `{ focus: '<roleId>' }`). Render only what they list; never add a section, frame or role they do not choose.
3. A reference page is an example unless the BRIEF asks to replicate it. When it does, read its source (Artifact `read`, or the HTML) and replicate it; never drop a part on your own: ask.
4. One file, one DOM. No iframes, no scripts gluing HTML files.
5. One direction. Explore alternatives before, as quick variants, never inside the showcase.
6. Experience first. Methodology only in the collapsed Anexo of the `ux-system` format.
7. Use the project's `tokens.css` when it exists; never invent a palette over it. Showing the tokens is the «Sistema» section, only when chosen.
8. Demo data is realistic, coherent (derive totals) and labelled as demo in every format.
9. Keep `window.SHOWCASE`, `?capture=` for each declared platform, the `#screen=&role=&sheet=` hash and the `data-go` / `data-act="sheet"` markup exactly as specified, in every format; fidelity and video depend on them.
10. Copy follows the brief's language (`lang`), in neutral Spanish by default. No real client names.

## Decision Gates

- No Artifact tool: stop with enable steps (a sub-agent builds and returns the path instead).
- BRIEF without "Formato de la presentación": build nothing; return a questionnaire item built from `${CLAUDE_PLUGIN_ROOT}/skills/presentation-brief/assets/presentation-format.questions.json`. Never assume `ux-system`.
- BRIEF without "Alcance del diseño": build nothing; return the questions of `${CLAUDE_PLUGIN_ROOT}/skills/presentation-brief/assets/design-scope.questions.json`, recommended from the product's code. Never assume a platform or a role scope.
- `tokens.css` exists: paste it between `TOKENS:START`/`TOKENS:END`; otherwise (plan skips the design system) keep template tokens and state it once; do not offer `design-system-builder` again.
- Product shape: follow `adapting.md` (multi-role, single dashboard, mobile-only, desktop-only).
- Reference to replicate: map it to the blueprint; confirm every difference before building.

## Execution Steps

1. Preflight; read brief, tokens, reference.
2. Copy `${CLAUDE_SKILL_DIR}/assets/showcase-template.html` into the project.
3. Set `LAYOUT` from the BRIEF (`mode`, `sections`, `platforms`, `roles`). Replace tokens, `ROLES`, `DATA`, the `screen()`/`sheet()` registry, `FLOWS`, the data of the chosen sections (`PRINCIPLES`, `DEFINITIONS`/`DECISIONS`, Sistema notes), hero and, in `ux-system`, the Anexo; keep shell, player and API (`blueprint.md` checklist).
4. Give each flow step a `to` state, a `target` present in every declared frame and a `say` line.
5. Preview with `node ${CLAUDE_SKILL_DIR}/assets/preview.mjs page.html tmp/showcase/preview.html`; check 1440 and 390 px, the themes the product ships (not always both), zero console errors, blueprint self-check. Run the check once, at the end.
6. Publish per `publishing.md`; republishing the same path keeps the URL.

## Output Contract

Report the artifact URL (or file path), the format, sections, platforms and roles used (with their BRIEF source), screen, sheet and flow counts, screenshot paths (1440 per theme checked, 390), console status, what stayed unverified, and deviations from the reference or brief.

## References

- `${CLAUDE_SKILL_DIR}/references/blueprint.md`: formats, architecture, data shapes, replacement checklist.
- `${CLAUDE_SKILL_DIR}/references/adapting.md`: format per product shape and audience.
- `${CLAUDE_SKILL_DIR}/references/publishing.md`: Artifact preflight, fragment rules.
- `${CLAUDE_SKILL_DIR}/references/capture-contract.md`: `window.SHOWCASE`, `?capture=`.
- `${CLAUDE_SKILL_DIR}/references/tokens-contract.md`: required token names.
