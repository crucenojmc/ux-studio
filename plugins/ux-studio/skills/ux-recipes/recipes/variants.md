---
id: variants
title: Exploración de variantes
source: own
medium: design
fallback: html
agent: ux-designer
skills: [graphic-assets]
---
## When

- The direction is still open: 2 to 4 alternatives of a screen, component or flow, side by side, to choose one before building.
- Signals: «variantes», «alternativas», «opciones de diseño», «propuestas para elegir», «no sé cómo debería verse».
- Not for: building the chosen direction (`app-prototype`, after this recipe); a single graphic piece (`print-piece`); a palette or a type pairing alone (`color-type-pairing`).

## Expect

- Obtienes: de 2 a 4 alternativas lado a lado en un lienzo, cada una con su idea en una línea, y una pregunta cerrada para elegir una.
- No incluye: la app navegable ni el sistema de diseño completo; la variante elegida se construye después.
- Ideal si: la dirección todavía no está decidida y conviene comparar antes de construir.

## Questions

Infer instead of asking: the screen or component (objective and inputs), the platform (design scope), the tokens (an existing `tokens.css` is reused), the language. Ask only what is left, in one round:

1. **Cantidad**: ¿Cuántas alternativas comparamos? «Tres (Recomendado)» · «Dos» · «Cuatro».
2. **Eje**: ¿En qué se diferencian las alternativas? «Disposición y jerarquía (Recomendado)» · «Estilo visual» · «Recorrido de la tarea».

## Medium

A claude.ai Design artifact, one artboard per alternative. Check at run time with the `Artifact` tool (`action: "list", scope: "types"`) that a Design type is listed, then build it per `graphic-assets` `references/pieces.md` §1. Not listed → fallback `html`: one HTML page with the alternatives side by side, published as a plain artifact. No `Artifact` tool → its path and title go back to the caller.

## Structure

- One artboard per alternative, all the same size (the platform's frame: 1440 × 900 web, 390 × 844 phone) and with the same demo data, so only the chosen axis differs.
- Each artboard: a short name, its idea in one line, what it favours and what it costs.
- A closing note with the recommendation and its reason.

## Steps

1. Medium — `graphic-assets` (`references/pieces.md` §1): run the type check; Design artifact or the HTML fallback.
2. Alternatives — `graphic-assets`: build each one with the design-system tokens only (`var(--token)`) and the same data; when listed in the session, `huashu-design`, `prototype` or `frontend-design` may speed up the directions.
3. Choice — write the item «Variante» in `<outputDir>/questionnaire.json`: one option per alternative, the recommended first with its reason; the caller asks it.
4. Export, only when the caller needs images — `graphic-assets` (`assets/export.mjs`).

## Checks

- Every artboard has the same size and data; text contrast is at least 4.5:1 (3:1 for large text).
- With the fallback: `node ${CLAUDE_PLUGIN_ROOT}/skills/graphic-assets/assets/export.mjs --input <outputDir>/variants.html --out <outputDir>/png/ --size 1440x900` and look at the PNG before returning it.
- The «Variante» item is valid against `${CLAUDE_PLUGIN_ROOT}/skills/ux-flow-audit/assets/questionnaire.schema.json`.

## Return

Artifact URL (or path and title), each alternative in one line, the recommendation, the «Variante» question (path and the question itself), `<command>: <result>` per check, open items. The chosen alternative is the input of `app-prototype`.
