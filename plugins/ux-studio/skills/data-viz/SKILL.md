---
name: data-viz
description: "Trigger: chart, graph, gráfico de datos, data visualization, statistical chart, dashboard chart, explain data, ficha del gráfico. Chooses each data chart by question and data type, checks it and shows its card: why, source and math."
license: UNLICENSED
metadata:
  author: "Mapplics"
  version: "1.0"
---

## Activation Contract

Runs whenever a ux-studio deliverable shows a chart of statistical or mathematical data that explains a phenomenon: the `data-story` recipe, and data charts inside a deck, a document, an audit report, a prototype dashboard or a handoff. Used by `ux-designer` and `ux-analyst`. Inputs come from the caller's task envelope (`${CLAUDE_PLUGIN_ROOT}/skills/presentation-brief/references/task-envelope.md`): the data (files, extracts, query results) and what its fields mean, the decision it supports, language, output dir; `BRIEF.md` is optional. Write every output under the caller's `--out <dir>`, unique per invocation; never in the product's source tree. Decorative graphics without data are `graphic-assets`, not this skill.

## Hard Rules

- Every data chart carries its «Ficha del gráfico», visible next to it (a collapsible panel that starts open is fine), never only in an appendix: the question it answers, why this chart, the alternatives discarded, the data source, the math, the limitations.
- Choose by the question and the data type (`${CLAUDE_SKILL_DIR}/references/chart-selection.md`), never by looks. A spec that fails `chart-check.mjs` is not built.
- Never invent data, field meanings, units, filters, periods or formulas. An unknown meaning is a questionnaire item (topic `data-meaning`, no default), never a guess.
- Demo data is labelled as such in the card and on the chart. Observed values are shown as they are; no qualitative names for data states that the data does not carry.
- Subagents never ask the user: questions go to `<outputDir>/questionnaire.json`, valid against `${CLAUDE_PLUGIN_ROOT}/skills/ux-flow-audit/assets/questionnaire.schema.json`.
- The optional `dataviz` skill, when listed, may style marks and palettes; this skill owns the choice and the card, and wins any conflict.

## Decision Gates

- No question stated, or a field's meaning unknown → questionnaire first; build nothing that depends on it.
- A table answers better (few values, exact lookups) → a table, with the same card.
- `chart-check.mjs` errors → change the spec (type, scale, palette, card), never the rule. A dual-axis warning stays only with its justification repeated in «Por qué este gráfico».
- The medium comes from the caller (recipe, deck, document, prototype); this skill adds the chart and its card.

## Execution Steps

1. Define the question: one sentence the chart answers, and the decision it supports.
2. Profile the data: grain, each field's type (quantitative, temporal, ordinal, nominal), n, sample or full count, observed or estimated, period, filters, cut-off date. Unknown meanings → questionnaire.
3. Choose with `${CLAUDE_SKILL_DIR}/references/chart-selection.md`; keep the alternatives discarded and why.
4. Write the spec per `${CLAUDE_SKILL_DIR}/assets/chart-spec.schema.json` (example: `${CLAUDE_SKILL_DIR}/assets/chart-spec.example.json`), card included, following `${CLAUDE_SKILL_DIR}/references/chart-card.md`.
5. Run `node "${CLAUDE_SKILL_DIR}/assets/chart-check.mjs" <spec.json> [...] --out <dir>`; fix every error and re-run.
6. Build the chart from the spec in the caller's medium, with the design system's tokens.
7. Place the card next to each chart: in HTML with `${CLAUDE_SKILL_DIR}/assets/chart-card.html`, which renders it from the same spec; in slides and documents, the six fields beside or right below the chart, on the same slide or page.

## Output Contract

In `<dir>`: one `<chart-id>.spec.json` per chart, `chart-check.json` and `chart-check.md`, and `questionnaire.json` when something is unknown. Return to the caller within its budget: each chart with its type and the question it answers, `chart-check.mjs: <result>`, and the first round of questions (up to 4, recommended option first). Never paste specs or reports into the reply.

## References

Load each only when its step needs it.

- `${CLAUDE_SKILL_DIR}/references/chart-selection.md`: chart by question and data type, perceptual order, traps, reading rules
- `${CLAUDE_SKILL_DIR}/references/chart-card.md`: the «Ficha del gráfico», field by field
- `${CLAUDE_SKILL_DIR}/assets/chart-spec.schema.json` and `${CLAUDE_SKILL_DIR}/assets/chart-spec.example.json`: the spec
- `${CLAUDE_SKILL_DIR}/assets/chart-check.mjs`: run it with `--help`; never read it whole
- `${CLAUDE_SKILL_DIR}/assets/chart-card.html`: the card for HTML pages
- `${CLAUDE_SKILL_DIR}/assets/questionnaire.example.json`: an unknown data meaning as a closed question
