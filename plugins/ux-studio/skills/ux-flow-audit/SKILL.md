---
name: ux-flow-audit
description: "Trigger: ux flow audit, user flows, redundant input, frequent tasks, reachability, orphan screens, screen space, heuristics, decision questionnaire. Measures task cost, reachability and space; returns closed decision questions."
license: UNLICENSED
metadata:
  author: "Mapplics"
  version: "1.0"
---

## Activation Contract

Runs when the `BRIEF.md` module plan selects it (variant: paper, prototype or existing app) or on a direct request (mini brief); the brief always proposes it. Used by `ux-analyst` to prove a product is useful, not only coherent: on a brief or requirements, on a `ux-studio:prototype-showcase` prototype, or on an existing or newly implemented app. Inputs come from the caller's task envelope (objective, inputs, platform and roles, output dir; see `presentation-brief/references/task-envelope.md`); `BRIEF.md` is optional. Also: requirements or feature list; when available, the prototype or app URL, an authorized session per role, route logs or event counts. Write outputs to the `--out` dir the caller gives, unique per invocation (default git-ignored `tmp/ux-audit/` at the workspace root; never the product's source tree, never `/tmp`); parallel invocations never share one. Only `report.md` and the answered questionnaire go to the team's documentation.

## Hard Rules

- Never invent frequencies, volumes, devices, field or status meanings, data semantics or business rules: unknown → questionnaire item.
- Subagents never ask the user: return the questionnaire; the main conversation asks it in rounds of up to 4.
- Every finding cites evidence (tool output, screen, step, measured count); without evidence it is a question.
- Impact = frequency × cost. Unknown frequency → impact pending, never estimated.
- Crawl only local or test environments and accounts the user authorized. Never crawl production, not even read-only; never `--allow-post` outside a disposable environment.
- What only a real device or real data can validate is reported as pending, never as verified.
- Thresholds are conventions (`metrics.md`); report any calibration. Examples stay fictional.

## Decision Gates

- Brief only: steps 1–3 and 7–9 on paper (`flow-cost.mjs` needs no browser). Prototype: add `--showcase`, `space-audit` and heuristics. Implementation: add `--crawl`; send visual drift to `ux-studio:implementation-fidelity`.
- Variant «Accesibilidad» (module plan or request about accessibility): read `${CLAUDE_SKILL_DIR}/references/accessibility.md` first, then run step 10 and steps 7–9; the other scripts are optional.
- Script exit 2 (no `playwright-core` or browser): run `ux-studio:ux-env-setup`, continue the paper checks.
- Scope from the BRIEF's "Alcance del diseño": only the roles in scope (all, or the one in focus); viewports by platform (Web 1440×900, Mobile 390×844, Web y mobile both).
- Login needed: ask the parent for a Playwright storage state per role in scope; never type credentials.
- Real devices unknown: ask, and still measure the platform's viewports.

## Execution Steps

1. Fill `${CLAUDE_SKILL_DIR}/assets/task-inventory-template.md` per role in scope (`method.md` §1).
2. Check placement rules for every task (§2): frequent or critical at most 1 interaction from home, visible without scrolling.
3. Model current and proposed paths; run `node "${CLAUDE_SKILL_DIR}/assets/flow-cost.mjs" tasks.json --out ux-audit` (KLM time, redundant input, weekly cost).
4. Write `features.json` from requirements, routes, endpoints and permissions; run `node "${CLAUDE_SKILL_DIR}/assets/nav-graph.mjs" --showcase <url> --features features.json --out ux-audit`, or `--crawl <url> --storage-state role=auth.json --routes routes.json`.
5. Run `node "${CLAUDE_SKILL_DIR}/assets/space-audit.mjs" --config space.json --out ux-audit` on key screens.
6. Check the 10 heuristics with evidence (§7).
7. Merge findings with impact, effort and priority; write `report.md` from `${CLAUDE_SKILL_DIR}/assets/report-template.md`.
8. Write `questionnaire.json` per `${CLAUDE_SKILL_DIR}/references/questionnaire.md`, valid against `${CLAUDE_SKILL_DIR}/assets/questionnaire.schema.json`.
9. After answers: update `BRIEF.md` and decisions, re-run each question's `rerun` checks, turn new gaps into the next round.
10. «Accesibilidad»: `node "${CLAUDE_SKILL_DIR}/assets/a11y-audit.mjs" --url <url> | --showcase <url> --platform web|phone|both --out <dir>`. Automatic and partial: the report says «verificación automática parcial» and never claims conformance; what needs a human becomes questionnaire items (topic `accessibility`).

Browser scripts need `playwright-core`, found in the current folder or a parent, in `NODE_PATH` or in the global npm root: install it in the git-ignored `tmp/ux-audit/` workspace (`npm init -y && npm i -D playwright-core`) or once for every project (`npm i -g playwright-core`), only after the user consents and never in a product's package.json, and an installed Chromium (`CHROME_PATH`); they never download one.

## Output Contract

`tmp/ux-audit/`: `task-inventory.md`, `flow-cost.json|md`, `nav-graph.json|md`, `space-audit.json|md`, `a11y.json|md`, `report.md`, `questionnaire.json|md`. Return to the parent a compact answer: a three-line summary, the P1 findings, the report and questionnaire paths and the first round (up to 4 questions, recommended option first); never the whole report.

## References

- `${CLAUDE_SKILL_DIR}/references/method.md`: the seven checks and their sources
- `${CLAUDE_SKILL_DIR}/references/metrics.md`: formulas, tiers, thresholds
- `${CLAUDE_SKILL_DIR}/references/questionnaire.md`: question rules and how the parent asks
- `${CLAUDE_SKILL_DIR}/references/accessibility.md`: «Accesibilidad» variant: criteria, limits, questionnaire feed
- `${CLAUDE_SKILL_DIR}/assets/questionnaire.example.json`: a valid example
