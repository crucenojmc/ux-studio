---
name: ux-content
description: "Trigger: microcopy, UX writing, empty/error/loading states, confirmations, voice and tone, glossary, content spec. Inventories required UI states and writes the copy for each."
license: UNLICENSED
metadata:
  author: "Mapplics"
  version: "1.0"
---

## Activation Contract

Runs when the caller's task envelope asks for microcopy, state copy, a glossary or a content spec. Used by `ux-designer`. The envelope (objective, inputs, platform and roles, language, constraints, output dir, return budget) is described in `presentation-brief/references/task-envelope.md`; `BRIEF.md` is optional and, when present, supplies language, variant, tone and design scope. Inputs: the screens (prototype `window.SHOWCASE` registry, route and component templates, or a list the caller gives), tone, and a domain glossary if one exists. Write every output under the caller's `--out <dir>` (a git-ignored `tmp/<topic>/`, unique per invocation), or to a claude.ai Docs artifact when asked. Never write to the product's source tree.

## Hard Rules

- Never invent business rules, field or status meanings, acronyms, limits or quotes. Unknown meaning means a questionnaire item, never a guessed term.
- Subagents never ask the user: return the questionnaire (valid against `ux-flow-audit/assets/questionnaire.schema.json`) to the caller.
- Copy follows the envelope's language; Spanish defaults to neutral, no voseo, unless the brief sets a variant.
- One term per concept; reuse glossary terms verbatim. No tracking references or client names in copy. Examples stay fictional.
- Every text carries its key, screen, state and character limit; a limit not given by the design is marked «supuesto».

## Decision Gates

- Missing critical input (no screen list, no language, no platform): return a closed-option questionnaire before any heavy work.
- Caller asked only for the inventory: stop after step 2. Only for copy of given states: skip step 2.
- Glossary needs domain meaning: ask, do not infer from code names.
- Mobile in scope: offline state is required; web only: it is not.

## Execution Steps

1. Normalize the screens and components to `screens.json` (see the header of `assets/states-inventory.mjs`); copy already in the inputs goes in `copy`.
2. Run `node "${CLAUDE_SKILL_DIR}/assets/states-inventory.mjs" screens.json --out <dir>` for the required states and the gaps.
3. Read `${CLAUDE_SKILL_DIR}/references/voice-and-tone.md` and `${CLAUDE_SKILL_DIR}/references/patterns.md` only when writing copy; build the glossary per `${CLAUDE_SKILL_DIR}/references/glossary.md` only when terms need unifying.
4. Fill `${CLAUDE_SKILL_DIR}/assets/content-spec-template.md` for each missing state, using glossary terms.
5. Collect unknown meanings and write `questionnaire.json` (example: `${CLAUDE_SKILL_DIR}/assets/questionnaire.example.json`).
6. After answers, update the spec and glossary and re-run step 2.

## Output Contract

In `<dir>`: `content-inventory.json|md`, `content-spec.md`, `glossary.md`, `questionnaire.json`. Return to the caller within its budget: a three-line summary, the paths, counts of required and missing states, and the first round of questions (up to 4, recommended option first). Never paste full documents into the reply.

## References

Load each only when that deliverable is requested.

- `${CLAUDE_SKILL_DIR}/references/voice-and-tone.md`: neutral Spanish, applying the brief's tone, consistency
- `${CLAUDE_SKILL_DIR}/references/patterns.md`: empty, error, confirmation, destructive, buttons, formats
- `${CLAUDE_SKILL_DIR}/references/glossary.md`: building the glossary from code and docs
- `${CLAUDE_SKILL_DIR}/assets/content-spec-template.md`: the spec table
- `${CLAUDE_SKILL_DIR}/assets/questionnaire.example.json`: a valid example
