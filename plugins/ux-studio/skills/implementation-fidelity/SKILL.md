---
name: implementation-fidelity
description: "Trigger: implementation fidelity, does the build match the prototype, visual QA, design drift, pixel diff, colour ΔE, re-measure after fixes. Measures the real product against the prototype and design system and drives fix/accept decisions."
license: UNLICENSED
metadata:
  author: "Mapplics"
  version: "1.0"
---

## Activation Contract

Runs when the `BRIEF.md` module plan sets fidelity to "Ahora" or on a direct request; a mini brief (language, scope) suffices. Run AFTER the real product implements screens from `ux-studio:prototype-showcase`, or to re-measure after fixes; `ux-analyst` runs it. Needs the prototype, the implementation URL and its login method, `tokens.css` (config `tokensCss`: measures each side against the declared token values), and `BRIEF.md` for language. Works in a measurement workspace OUTSIDE the product's source tree (default: git-ignored `tmp/fidelity/` at the workspace root, or the session scratchpad).

## Hard Rules

- Numbers decide (ΔE2000, px, % pixels). Images and Claude vision only show where to look.
- Compare paired states only: same data, viewport, DPR, theme, frozen time, motion off, fonts loaded, one machine and browser for both sides.
- Never ask for, type or store credentials: the user runs `--save-auth`, or measure in the user's browser.
- Never edit product code or data; propose exact changes (token, property, value).
- Never call it faithful without a re-measurement after the last fix.
- Behaviour-changing decisions belong to the product owner or user. Log every unfixed deviation; when one becomes the standard, update the design system (single source of truth).
- No real client names, personal data or production credentials in outputs.
- Measurement code, dependencies and captures never enter the product repository (no `package.json` changes, no committed scripts or images); only the final report and decisions log may be kept where the team stores documentation.

## Decision Gates

- Choose capture path and tools with `references/tool-selection.md`.
- Closing threshold is a team decision: score ≥ 95 % per state, pixel diff ≤ 2 %, no A findings. Ask (one question, then STOP) only when `BRIEF.md` requires a different bar.
- For each non-defect finding, present the options in `references/decisions.md` with cost and impact, then STOP for the owner.

## Execution Steps

1. Create the measurement workspace (`tmp/fidelity/`, git-ignored). List states from the showcase registry/flows (they hold only the roles in scope); copy `assets/fidelity.config.example.json` there as `fidelity.config.json` (viewports from the BRIEF's platform: web 1440, phone 390, or both; every theme; element map with tokens). See `references/method.md`.
2. If missing, propose one of two installs and run it after the user consents: inside that workspace (`npm init -y && npm i -D playwright-core pixelmatch pngjs`, per project) or once for every project (`npm i -g playwright-core pixelmatch pngjs`); the scripts find both. Never in a product's package.json. Use an existing Chromium; never download a browser unasked.
3. `node ${CLAUDE_SKILL_DIR}/assets/capture-states.mjs --config fidelity.config.json` (`--save-auth --wait-for <selector>` for logins, `--print-snippet <state>` for the manual path; `--help` lists the options). Unbuilt screens are `pending: true` states with a reason; API data comes from `implementation.routes`.
4. `node ${CLAUDE_SKILL_DIR}/assets/compare.mjs --config fidelity.config.json`.
5. Review each side-by-side image; add semantic findings; if pixels differ unexplained, extend the element map, repeat 3–4.
6. Classify findings (defect, technical constraint, improvement); hand corrections A–D to the implementer.
7. Re-measure into a new folder with `--previous <old>/fidelity.json` until the threshold is met or each remaining deviation has a logged decision.
8. When a capture looks wrong, read `references/gotchas.md`.

## Output Contract

- `fidelity.md` (neutral Spanish template; translate if `BRIEF.md` says so): score per state, side-by-side and diff images, findings, corrections A tokens / B components / C layout / D details with exact values, delta vs previous, warnings, limits.
- `fidelity.json` and the captures of every measurement.
- `decisiones.md` in the workspace (copied with the report to the team's documentation when the cycle closes): what, why, impact, who decided, date.
- Closing line: score before → after, open findings, pending decisions and their owners.

## References

- `${CLAUDE_SKILL_DIR}/references/tool-selection.md` · `method.md` · `decisions.md` · `gotchas.md`
- `${CLAUDE_SKILL_DIR}/assets/fidelity.config.example.json` · `capture-states.mjs` · `compare.mjs` · `delta-e.mjs` · `tokens-css.mjs` · `report-template.md` · `decisions-log-template.md`
