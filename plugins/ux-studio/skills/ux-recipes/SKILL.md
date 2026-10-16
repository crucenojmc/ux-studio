---
name: ux-recipes
description: "Trigger: receta, recipe, plantilla, template, app simulada, sistema UX completo, variantes, rediseño, handoff a desarrollo, auditoría UX, mockups, wireframes. Picks a ux-studio recipe, checks that it fits the intent and runs it, loading only the chosen recipe."
license: UNLICENSED
metadata:
  author: "Mapplics"
  version: "1.0"
---

## Activation Contract

A recipe is a starting prompt plus a focus: a known path from a request to a deliverable (questions, medium, structure, steps, checks, return). Some keep the paths the team used as Claude Design templates (`source: claude-design`); the rest come from the team's own work (`source: own`). The agent a recipe names runs it from a task envelope (`${CLAUDE_PLUGIN_ROOT}/skills/presentation-brief/references/task-envelope.md`) whose `recipe` field names it; in the main conversation, `presentation-brief` recommends one after classifying the type of work. `BRIEF.md` is optional.

## Hard Rules

- Load only the chosen recipe: `${CLAUDE_SKILL_DIR}/recipes/<id>.md`. The index is enough to pick one; never read another recipe file.
- Each step names its skill: read that skill's SKILL.md only at its step, never up front.
- A recipe adds a path, never a permission: the envelope rules (output dir, closed questions, consent) and every skill's hard rules still apply.
- Charts of statistical or mathematical data, in any recipe: `data-viz`, with its «Ficha del gráfico» next to each chart (`${CLAUDE_PLUGIN_ROOT}/skills/data-viz/SKILL.md`).
- Artifact types vary per account: check them at run time with the `Artifact` tool (`action: "list", scope: "types"`) and use the recipe's medium only when its type is listed. Otherwise its fallback: `html` → one plain HTML artifact; `markdown` → a Markdown file in the output dir; `none` → the files in the output dir, as the recipe's Medium says. No `Artifact` tool → return the file path and title; the caller publishes.
- Never refuse a recipe the user keeps after the fit check.

## Decision Gates

- The envelope's `recipe: <id>` → that recipe, then the fit check.
- No `recipe` → match the objective and the type of work against the signals in the «cuándo» column of `${CLAUDE_SKILL_DIR}/recipes/index.md`. One match → it. Several → one closed question «Receta» with up to 4, the best first with «(Recomendado)», each described by its «qué obtienes». None → no recipe: the type's skills per `routing.md`.
- An unknown id → the «Receta» question with the closest recipes; never guess.

## Fit Check

Whenever a recipe is chosen, by the user or by the caller's envelope, and before any step:

1. Compare the stated intent (objective, request, BRIEF) with the recipe's `## When` (including when not to use it) and `## Expect`.
2. It fits → run it. Another recipe fits better → run nothing yet and return one closed question (questionnaire item, topic `scope`, shaped as in `${CLAUDE_SKILL_DIR}/references/fit-check.md`):
   - header «Receta»; `why`: one line on why the chosen recipe may not fit;
   - option 1: the better recipe, label ending in «(Recomendado)», described by its «Obtienes»;
   - option 2: «Seguir con <título elegido>», described by its «Obtienes», its consequence saying what will be missing.
3. The answer keeps the chosen recipe → run it and record it as the user's decision in the return («Receta: <id>, decisión del usuario»). Never ask again in the same invocation and never refuse. The answer picks the better recipe → run that one.
4. Agent to agent: the item goes in `<outputDir>/questionnaire.json`; the caller asks it and re-invokes with `answers`. Main conversation: `presentation-brief` shows the recipe and its Expect bullets before starting and asks the same question with `AskUserQuestion`.

## Execution Steps

1. Read the chosen recipe file; nothing else from `recipes/`.
2. Questions: skip what the envelope, the BRIEF or the repository answers (the recipe says what to infer); return the rest as one closed round, recommended option first, then stop.
3. Medium: run the type check; when the type is missing, apply the fallback and say so once.
4. Steps in order, only those the running agent owns. A step owned by another agent is a separate invocation: return its envelope (agent, skills, inputs, `recipe`) for the caller, never do it in-line. Steps the recipe marks parallel go out together, each with its own output dir.
5. Checks: run each command and record `<command>: <result>`; what only a device or real data can validate stays pending.
6. Return per the recipe's `## Return`, within the envelope's budget.

## Output Contract

Compact, per the envelope's Return: the recipe id and how it was chosen (envelope, index match, or the user's decision after the fit check); artifact URLs or output paths; `<command>: <result>` per check; questions (path and first round); for a chained recipe, the next invocation's envelope.

## References

- `${CLAUDE_SKILL_DIR}/recipes/index.md`: one row per recipe (id, título, cuándo, qué obtienes, medio, agente)
- `${CLAUDE_SKILL_DIR}/recipes/<id>.md`: the chosen recipe only
- `${CLAUDE_SKILL_DIR}/references/fit-check.md`: the «Receta» questionnaire item and common mismatches
- `${CLAUDE_PLUGIN_ROOT}/skills/presentation-brief/references/routing.md`: type of work → recipes, skills and agents
