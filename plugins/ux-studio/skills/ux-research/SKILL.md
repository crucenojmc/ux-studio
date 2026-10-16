---
name: ux-research
description: "Trigger: research plan, interview guide, survey, usability test, proto-personas, journey map, information architecture, sitemap, wireframes. Produces the research and architecture deliverables the caller asks for."
license: UNLICENSED
metadata:
  author: "Mapplics"
  version: "1.0"
---

## Activation Contract

Runs when the caller's task envelope asks for one or more research or architecture deliverables. Used by `ux-designer`. The envelope (objective, inputs, platform and roles, language, constraints, output dir, return budget) is described in `presentation-brief/references/task-envelope.md`; `BRIEF.md` is optional and, when present, supplies language, scope and design scope (platform and roles). Inputs: requirements, the product's routes or a `nav-graph.json` from `ux-flow-audit`, existing research, and the roles. Write every output under the caller's `--out <dir>` (a git-ignored `tmp/<topic>/`, unique per invocation), or to a claude.ai Docs or Design artifact when asked. Never write to the product's source tree.

## Hard Rules

- Never invent users, frequencies, business rules, data meanings or quotes. Unknowns become questions.
- Proto-personas, journeys and any claim not backed by evidence are labelled «supuesto» until validated.
- Subagents never ask the user: return the questionnaire (valid against `ux-flow-audit/assets/questionnaire.schema.json`) to the caller.
- Do not recruit, contact or record people; plans describe how, the team runs them. Examples stay fictional, no client names.
- Method choice and sample size are conventions (`methods.md`); state the convention and the risk of going below it.

## Decision Gates

- Deliverables come from the envelope; if none is named or the objective, roles or language are missing, return a closed-option questionnaire before heavy work.
- Load only the template of each requested deliverable; a sitemap-only request reads no template.
- Sitemap source: a routes file as JSON, or a `nav-graph.json`; with neither, build the tree from the requirements and mark it «supuesto».
- Wireframes: claude.ai Design artifact if available and requested, otherwise the HTML fallback.
- Findings that need real users are written as research questions, never answered from imagination.

## Execution Steps

1. Read the envelope; list the requested deliverables and the unknowns.
2. Choose methods per `${CLAUDE_SKILL_DIR}/references/methods.md` (only when a plan or method choice is requested).
3. Per deliverable, fill only the template of each requested deliverable (listed in References).
4. Information architecture: `node "${CLAUDE_SKILL_DIR}/assets/sitemap.mjs" --routes routes.json --out <dir>` or `--nav-graph nav-graph.json --out <dir>`; read depth, orphans and screens per role.
5. Wireframes: one low-fidelity Design artifact (one artboard per screen, grey boxes, real labels from the requirements), or a single HTML of grey boxes at `<dir>/wireframes.html`.
6. Write `questionnaire.json` for every unknown; after answers, update the affected deliverables.

## Output Contract

In `<dir>`: the requested deliverables (`research-plan.md`, `interview-guide.md`, `survey.md`, `usability-test.md`, `personas.md`, `journey.md`, `sitemap.json|mmd|md`, `wireframes.html`) and `questionnaire.json`. Return to the caller within its budget: a three-line summary, the paths, the assumptions made and the first round of questions (up to 4, recommended option first). Never paste full documents into the reply.

## References

Load each only when that deliverable is requested.

- `${CLAUDE_SKILL_DIR}/references/methods.md`: when to use each method, sample sizes as conventions
- `${CLAUDE_SKILL_DIR}/assets/sitemap.mjs`: navigation tree, Mermaid and orphans
- Templates, in neutral Spanish:
  - `${CLAUDE_SKILL_DIR}/assets/research-plan-template.md`
  - `${CLAUDE_SKILL_DIR}/assets/interview-guide-template.md`
  - `${CLAUDE_SKILL_DIR}/assets/usability-test-template.md`
  - `${CLAUDE_SKILL_DIR}/assets/persona-template.md`
  - `${CLAUDE_SKILL_DIR}/assets/journey-template.md`
