---
id: redesign
title: Rediseño de pantalla existente
source: own
medium: html
fallback: none
agent: ux-designer
skills: [ux-flow-audit, design-system-builder, graphic-assets, prototype-showcase, implement-ui, implementation-fidelity]
---
## When

- An existing screen of the product works badly and must be redesigned from evidence: audit it, explore alternatives, prototype the chosen one, plan its implementation and measure the result.
- Signals: «rediseñar», «mejorar esta pantalla», «la pantalla actual es confusa», «hay que rehacerla», the URL or route of a screen that exists.
- Not for: a new screen with no current version (`app-prototype` or `variants`); measuring without redesigning (`ux-audit`); a design already decided that goes to developers (`dev-handoff`).

## Expect

- Obtienes: un camino de cinco pasos sobre la pantalla actual: auditoría de utilidad y accesibilidad, variantes, el prototipo elegido, el plan de implementación y, una vez implementado, la medición de fidelidad.
- No incluye: cambios en el producto sin la aprobación explícita del plan; cada paso se entrega y se revisa antes del siguiente.
- Ideal si: la pantalla ya existe, tiene problemas concretos y el rediseño tiene que llegar al código.

## Questions

Infer instead of asking: the screen (URL or route in the inputs), platform and roles (design scope, from the repository), the product repository and its stack (`implement-ui` detects it), the language. Ask only what is left, in one round:

1. **Auditoría**: ¿Qué auditamos de la pantalla actual? «Utilidad y accesibilidad (Recomendado)» · «Solo utilidad» · «Solo accesibilidad».
2. **Hasta dónde**: ¿Hasta qué paso llegamos ahora? «Hasta el plan de implementación (Recomendado)» · «Hasta el prototipo elegido» · «Hasta la medición de fidelidad».
3. **Cambios** (Q-16): ¿Cómo se entregan los cambios en el producto? «Rama nueva, sin push (Recomendado)» · «Solo un parche para revisar». No answer → «Solo un parche»: a permission is never assumed.

## Medium

The chosen prototype is a plain HTML artifact (`prototype-showcase`), with no type check. The variants step takes the `variants` medium: a Design artifact when the run-time check with the `Artifact` tool (`action: "list", scope: "types"`) lists a Design type, otherwise its HTML fallback. The audits and the plan are files in each step's output dir. No `Artifact` tool → fallback `none`: paths and titles go back to the caller.

## Structure

Five steps. Each one is a separate invocation with its own envelope (`recipe: redesign`) and output dir; its output is the next step's input.

| Step | Agent | Skill | Output | Runs |
|---|---|---|---|---|
| 1. Audit of the current screen | `ux-analyst` | `ux-flow-audit`: 1a usefulness, 1b «Accesibilidad» | Reports and questionnaires | 1a and 1b in parallel |
| 2. Variants | `ux-designer` | `graphic-assets`, as the `variants` recipe | 2–4 alternatives and the «Variante» question | After 1 |
| 3. Chosen prototype | `ux-designer` | `prototype-showcase`, as the `app-prototype` recipe | Artifact | After the user picks |
| 4. Implementation plan | `ui-developer` | `implement-ui`, `consent: pending` | Plan: exact files and branch | After 3 |
| 5. Fidelity | `ux-analyst` | `implementation-fidelity` | Score per state, corrections | After the implementation |

Parallel: 1a and 1b run together; a missing `tokens.css` can be built alongside step 1. Every other step waits for the one before. «Hasta dónde» sets the last step.

## Steps

1. Audit — `ux-flow-audit` by `ux-analyst`: 1a usefulness on the existing app (`--crawl` with a storage state per role), 1b the «Accesibilidad» variant (`a11y-audit.mjs`), two parallel invocations. Tokens — `design-system-builder` by `ux-designer`, alongside, only when no `tokens.css` exists.
2. Variants — `graphic-assets` by `ux-designer`, following the `variants` recipe; the P1 findings of step 1 are the brief of every alternative. Return the «Variante» question and stop.
3. Prototype — `prototype-showcase` by `ux-designer`, the chosen alternative built as the `app-prototype` recipe.
4. Plan — `implement-ui` by `ui-developer` with `consent: pending`: it returns the plan and stops. Only after the user approves that plan does the caller re-invoke it with `consent: granted`.
5. Fidelity — `implementation-fidelity` by `ux-analyst`, once the implementation exists: the app against the step 3 prototype.

Each agent runs only its own steps and returns the next step's envelope; invoked first without the audit, `ux-designer` returns the two step 1 envelopes.

## Checks

- Step 1: a `report.md` and a `questionnaire.json` per audit, valid against `${CLAUDE_PLUGIN_ROOT}/skills/ux-flow-audit/assets/questionnaire.schema.json`; the accessibility report says «verificación automática parcial».
- Steps 2 and 3: the checks of the `variants` and `app-prototype` recipes.
- Step 4: the plan names exact files and the branch; `git -C <repo> status --short` shows nothing written before `consent: granted`.
- Step 5: score ≥ 95 % per state, pixel diff ≤ 2 % and no A findings, or a logged decision per remaining deviation.
- Gráficos de datos → `data-viz` con su ficha: the «Ficha del gráfico» next to each chart, and `chart-check.mjs` exits 0 on their specs.

## Return

Per invocation: the step done, its artifact URL or paths, `<command>: <result>` per check, its questions (path and first round) and the next step's envelope (agent, skills, inputs, `recipe: redesign`) for the caller. At the last step: the path walked, with each step's output.
