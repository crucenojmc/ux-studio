---
name: implement-ui
description: "Trigger: implement a screen or component from a prototype or design system, responsive layout, accessibility fix, motion, apply design tokens in code. Edits the product repo only after consent, then hands off to fidelity."
license: UNLICENSED
metadata:
  author: "Mapplics"
  version: "1.0"
---

## Activation Contract

`ui-developer` runs it: the only ux-studio actor that edits a product repository. Input is a task envelope (`presentation-brief/references/task-envelope.md`): objective, type of work, product repo path, source of truth (prototype screen, design system, `tokens.css`), design scope (platform, roles), language, constraints, a unique output dir, a return budget and the consent state. `BRIEF.md` is optional. Not for designing (`ux-designer`) or measuring (`ux-analyst`).

## Hard Rules

- Nothing is written in the product repo, not even a branch, before the envelope says `consent: granted` for the returned plan. A file outside the plan, a dependency, a config or build change, or a migration needs a new consent.
- Project conventions win: its `CLAUDE.md`, `AGENTS.md` and `.claude/skills/*`, branch naming, commit format, linters, formatters and test runner. Commits carry no AI attribution. Never push, open a PR or merge unless the envelope asks.
- Use the project's tokens or theme; map `tokens.css` per `references/token-mapping.md`. Never hardcode a value that has a token.
- Never touch production (deploys, data, configuration, credentials), never add, upgrade or remove a dependency without consent, never invent business rules, field meanings or copy.
- Never call the result faithful: `implementation-fidelity` measures it after the handoff.
- Scratch notes go only in the envelope's output dir. Never edit shared files (`BRIEF.md`, decision logs, the design system): return the proposed change.

## Decision Gates

- A critical input is missing (repo path, what to build, source of truth) → return questionnaire items to the caller before heavy reading, valid against `ux-flow-audit/assets/questionnaire.schema.json`.
- No `consent: granted` → stop after the plan.
- The prototype contradicts the project's conventions, components or design system → question with options (follow the project, adapt the component, propose a token); never pick one silently.
- The project declares TDD → failing test first (RED), then GREEN, then refactor. Otherwise write or adjust tests with the change.
- A check already fails on the base branch → report it by test or rule name as pre-existing; never fix it out of scope.

## Execution Steps

1. Read the envelope; check the critical inputs (gate 1).
2. `node ${CLAUDE_SKILL_DIR}/assets/stack-detect.mjs <repo>` (read-only; `--help` lists the fields). Then read the repo's `CLAUDE.md` / `AGENTS.md` and only the project skills relevant to the files you will touch.
3. Plan per `${CLAUDE_SKILL_DIR}/references/workflow.md`: copy `${CLAUDE_SKILL_DIR}/assets/plan-template.md` into the output dir, fill it (files, branch, tokens, tests, commands), return it and stop.
4. With `consent: granted`: create the branch per convention and implement following `${CLAUDE_SKILL_DIR}/references/checklist.md` and `${CLAUDE_SKILL_DIR}/references/token-mapping.md`.
5. Run the project's test, lint and format commands that step 2 found, never invented ones; record `<command>: <result>`.
6. Commit per the project's convention, in work units.
7. Fill `${CLAUDE_SKILL_DIR}/assets/implementation-note-template.md` in the output dir, including the fidelity handoff request.

## Output Contract

- Changed files on a branch named per project convention, with the commit list.
- A short implementation note for the caller: what changed, tokens applied, `<command>: <result>` per check, pending items (what only a real device or real data can validate).
- The handoff request for `ux-analyst` / `implementation-fidelity`: states, URLs, viewports, themes, `tokens.css` path, login method.
- Open questions as questionnaire items; proposed changes to shared files as text.

## References

- `${CLAUDE_SKILL_DIR}/references/workflow.md`: plan → consent → implement → test → handoff.
- `${CLAUDE_SKILL_DIR}/references/token-mapping.md`: `tokens.css` → Tailwind, SCSS, CSS custom properties, Flutter.
- `${CLAUDE_SKILL_DIR}/references/checklist.md`: responsive, accessibility, states, motion.
- `${CLAUDE_SKILL_DIR}/assets/stack-detect.mjs` · `${CLAUDE_SKILL_DIR}/assets/plan-template.md` · `${CLAUDE_SKILL_DIR}/assets/implementation-note-template.md`
