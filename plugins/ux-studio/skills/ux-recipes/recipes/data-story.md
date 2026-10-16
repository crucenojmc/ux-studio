---
id: data-story
title: Datos explicados
source: own
medium: dashboard
fallback: html
agent: ux-designer
skills: [data-viz]
---
## When

- Charts that explain a phenomenon with statistical or mathematical data: why a figure changed, how a forecast was built, where the delays pile up. The viewer has to be able to check each chart.
- Signals: «explicar con datos», «gráficos», «tablero», «por qué pasó», «evolución», «distribución», «correlación», «pronóstico», a data file or an extract in the inputs.
- Not for: decorative graphics with no data (`print-piece`, or `graphic-assets` for icons and illustrations); a written report where the charts are secondary (`document`); slides to present (`deck`). Those recipes use `data-viz` for their own data charts.

## Expect

- Obtienes: gráficos elegidos con fundamento y, junto a cada uno, su ficha con la fuente de los datos y la matemática, en un tablero que se puede revisar.
- No incluye: el análisis de datos que no se entregaron ni definiciones que no se pueden verificar: lo que falta vuelve como pregunta.
- Ideal si: quien mira el gráfico tiene que poder comprobarlo sin confiar a ciegas.

## Questions

Infer instead of asking: the data, their period and their source (inputs), the language, the platform (a dashboard is web unless the design scope says phone), whether the data are real (inputs) or demo (the envelope's constraints). Ask only what is left, in one round:

1. **Decisión**: ¿Qué decisión tienen que apoyar estos datos? «La que nombra el objetivo del pedido (Recomendado)» · «Explicar qué pasó, sin una decisión pendiente» · «Otra decisión, que el equipo describe».
2. **Detalle**: ¿Cuánto detalle de la matemática muestra cada ficha? «Fórmula y supuestos en palabras (Recomendado)» · «Fórmula completa, paso a paso» · «Ficha breve y la derivación completa en un anexo».

Every field whose meaning, unit, period or filter is unknown is one more question (topic `data-meaning`, no default), never a guess.

## Medium

A dashboard: check at run time with the `Artifact` tool (`action: "list", scope: "types"`) whether a dashboard type is listed; if it is, start from it and follow its instructions. Not listed → fallback `html`: one plain HTML artifact with the charts, each with its card from `${CLAUDE_PLUGIN_ROOT}/skills/data-viz/assets/chart-card.html`. No `Artifact` tool → write the HTML in the output dir and return its path and title. The specs, `chart-check.md` and `questionnaire.json` stay in the output dir.

## Structure

- Header: the question the page answers and the decision it supports, the period and the cut-off date; «Datos de demostración» when they are.
- One section per question: the chart, with a title that says what it shows and when, and its «Ficha del gráfico» beside it (below it on a phone).
- A short reading per chart, in observed numbers; no claim beyond the data.
- Pending: the data meanings still unanswered, with the questionnaire path.
- An annex with the full derivation only when «Detalle» asks for it; the card stays next to each chart.

## Steps

1. Question — the decision the data support and one question per chart. Missing → return the Questions above as `<outputDir>/questionnaire.json` and stop.
2. Profile the data — `data-viz`: grain, field types, n, sample or full count, observed or estimated, period, filters, cut-off date. Every unknown meaning becomes a `data-meaning` question, and the charts that depend on it wait.
3. Choose — `data-viz` `references/chart-selection.md`: chart by question and data type; record the alternatives discarded.
4. Spec — one `<chart-id>.spec.json` per chart, valid against `data-viz` `assets/chart-spec.schema.json`, card included (`references/chart-card.md`).
5. Check — `data-viz` `assets/chart-check.mjs` on every spec; fix each error in the spec and re-run.
6. Build — the page per Medium, each chart drawn from its spec with the design system's tokens.
7. Card — `data-viz` `assets/chart-card.html` next to each chart, rendered from the same spec; then Checks and Return.

## Checks

- `node ${CLAUDE_PLUGIN_ROOT}/skills/data-viz/assets/chart-check.mjs <outputDir>/*.spec.json --out <outputDir>` exits 0.
- Every chart shows its «Ficha del gráfico» next to it, never only in the annex; demo data labelled on the chart and in the card.
- Every number on the page traces to an input; `questionnaire.json`, when present, is valid against `${CLAUDE_PLUGIN_ROOT}/skills/ux-flow-audit/assets/questionnaire.schema.json`.
- HTML: zero console errors, no horizontal scroll at 390 px, light and dark themes.
- Copy in the envelope's language, no voseo.

## Return

Compact, per the caller's task envelope (`skills/presentation-brief/references/task-envelope.md`), within its `returnBudget`: the artifact URL, or the HTML path and title to publish; per chart, its type and the question it answers; `<command>: <result>` per check; questions (path and first round, up to 4, recommended first); open items, such as data meanings waiting for an answer.
