# Task envelope

How a caller (another agent, or the main conversation) invokes a ux-studio agent. The caller passes one compact block in the prompt; the agent works from it. BRIEF.md is optional: when the envelope carries what the task needs, the agent works without it.

## Fields

```yaml
ux-task:
  objective: <one sentence: what the result must achieve>
  type: grafico | investigacion | diseno-ux | implementacion | auditoria | presentacion
  recipe: <id>
  skills: [<skill>, ...]
  inputs: [<path or URL>, ...]
  scope:
    platforms: [web] | [phone] | [web, phone]
    roles: single | all | { focus: <roleId> }
  language: <language, variant and tone, e.g. es-AR, tuteo>
  constraints: [<constraint>, ...]
  outputDir: tmp/<topic>/<agent>-<slug>/
  returnBudget: <words>
  brief: <path to BRIEF.md>
  handoff: <path to a previous HANDOFF.md>
  answers: { Q-NN: <option id or text>, ... }
  consent: pending | granted
```

| Field | Required | When missing |
|---|---|---|
| `objective` | always | Questionnaire item |
| `type` | no | From `skills` or the objective, per `routing.md`; undecidable → questionnaire item |
| `recipe` | no | No recipe: the skills run as named. With one, `${CLAUDE_PLUGIN_ROOT}/skills/ux-recipes/SKILL.md` runs `recipes/<id>.md` and fixes the skills and steps; its fit check runs first and may return the «Receta» question |
| `skills` | no | The type's skills per `routing.md`, or the recipe's |
| `inputs` | when the skill needs them: repository path, prototype or app URL, a Playwright storage state per role, supplied files | Questionnaire item |
| `scope` | for work with screens: prototypes, wireframes, screen graphics, audits, fidelity, implementation | From the BRIEF's "Alcance del diseño"; otherwise the questions of `assets/design-scope.questions.json` |
| `language` | no | `es`, neutral Spanish |
| `constraints` | no | The plugin's hard rules always apply; the envelope only adds |
| `outputDir` | no | `tmp/<topic>/<agent>-<slug>/`, git-ignored (check with `git check-ignore`) |
| `returnBudget` | no | 200 words |
| `brief` | no | Work from the envelope alone |
| `handoff` | no | Fresh start. On resume the caller passes the `HANDOFF.md` a `status: partial` run returned (see Budget) |
| `answers` | no | Only on a re-invocation, with the answers to the agent's questionnaire |
| `consent` | `ui-developer` only | `pending`: the agent returns its plan (exact files and branch) and stops. `granted` only after the user approved that plan; it covers the plan's files and branch, nothing else |

## Agent rules

1. Envelope first: check the fields before any heavy reading. A critical field missing → return at once `<outputDir>/questionnaire.json` with only those items (the scope items copied from `assets/design-scope.questions.json`). Safe defaults apply and are labelled assumptions.
2. The envelope fixes this invocation; the BRIEF supplies what the envelope leaves out. A conflict between them is a question, never resolved silently.
3. Run only the skills the envelope names, the steps of its `recipe` in the agent's scope, or the BRIEF's "Plan de módulos" rows marked "ejecutar" in the agent's scope. Never add one; add a prerequisite only when its output is missing.
4. Agents never call `AskUserQuestion`: they return closed questions, valid against `ux-flow-audit/assets/questionnaire.schema.json`, and the caller asks them.
5. Parallel-safe: write only inside the output dir, which replaces any location a skill names (`tmp/ux-audit/`, `tmp/fidelity/`, `videos/`, `tmp/<topic>/`). Never edit a shared file (BRIEF.md, a decisions log, the `fidelity.config.json` or questionnaire of another run): write the change in `<outputDir>/proposed-changes.md` and return its path; the caller applies it.
6. Product code and data: only `ui-developer` edits a product repository, and only with `consent: granted` for the plan it returned. Every other agent proposes exact changes.
7. When `handoff` is given, read it first and do not redo the reads it records.

## Budget

Every agent obeys these; they cap cost without lowering the deliverable.

1. Bounded runs: one invocation does one bounded unit of work. After about 80 tool calls, or after several build→check cycles, stop at a clean point: write `<outputDir>/HANDOFF.md` (done, remaining, decisions, files, open checks) and return `status: partial` with its path. A fresh invocation resumes from `HANDOFF.md` and does not redo the reads it records.
2. Images: never Read a full-size screenshot. Downscale it first to at most 1000 px wide (JPEG), or capture it at that size. Prefer numeric checks (pixel diff, ΔE, DOM or computed styles, console errors); look only at the images a check flagged.
3. Large files: never Read whole a file over 50 KB (published artifact pages, the showcase template, logs). Locate the spot with `rg -n` and read line ranges. Edit the local source; never read back a published artifact page to check an edit.
4. Verify once: while iterating, check only what the last edit touched. Run the full verification pass once, at the end, on the final state.
5. Questions: read `questionnaire.schema.json` only when there are questions to return.

## Return

Compact, within `returnBudget` words, in the caller's language (Spanish by default):

1. `status`: `done | partial | blocked`. `partial` returns the `HANDOFF.md` path (see Budget); `blocked` says what is needed to go on.
2. Summary: what was done, and each decision with its source (envelope, BRIEF, default, user), the recipe included.
3. Artifacts: claude.ai URLs, or paths inside the output dir (with the title when the caller must publish).
4. Verification: `<command>: <result>`, one line each.
5. Questions: the questionnaire path and its first round (up to 4): header, question, option labels, recommended first.
6. Proposed changes: `<outputDir>/proposed-changes.md`, or none.
7. Open items: pending, unverified, blocked.

Never return file dumps, full reports or whole questionnaires: their paths are enough.

## Example

```yaml
ux-task:
  objective: Prototipo navegable del alta de pedidos para validarlo con supervisores
  type: diseno-ux
  recipe: app-prototype
  skills: [prototype-showcase]
  inputs: [apps/web/src/app/pedidos]
  scope: { platforms: [web], roles: { focus: supervisor } }
  language: es-AR, usted
  constraints: [datos de demostración]
  outputDir: tmp/pedidos/ux-designer-alta/
  returnBudget: 150
```
