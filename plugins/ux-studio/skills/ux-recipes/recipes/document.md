---
id: document
title: Documento o informe
source: claude-design
medium: docs
fallback: markdown
agent: ux-designer
skills: [ux-research]
---
## When

Use when the user wants a written document to read, share, comment on or approve: a report, a proposal, a guide, a specification, a UX research report. Signals: «informe», «documento», «reporte», «propuesta», «guía», «resultados de la investigación».

Not for:
- slides to present in front of an audience → `deck`
- a diagram as the main content → `diagram`
- auditing the usability or accessibility of an app → `ux-audit`
- screen specifications for developers → `dev-handoff`

## Expect

- **Obtienes:** un documento en el tipo Docs con una estructura clara, el resumen primero y tablas o gráficos donde ayudan, listo para compartir y comentar; incluye informes de investigación UX.
- **No incluye:** diapositivas para exponer; para presentar frente a una audiencia, `deck`.
- **Ideal si:** necesitas un texto que otras personas lean, comenten o aprueben.

## Questions

1. ¿Qué tipo de documento es?
   - Informe o reporte (Recomendado)
   - Informe de investigación UX
   - Propuesta o especificación
   - Guía o manual
2. ¿Quién lo lee?
   - Quien decide: el resumen y la recomendación primero (Recomendado)
   - El equipo que ejecuta: el detalle completo

Infer instead of asking:
- The sources from the envelope's `inputs`; every fact comes from them.
- The structure from the kind of document (see Structure).
- Language and tone from the envelope's `language` (default neutral Spanish).

## Medium

- Type: **Docs**.
- Run-time check: Artifact `action: "list", scope: "types"`. A Docs row → create the document from its `type_url`. When the host attaches a first-party docs connector, write through it instead; it starts from the same Docs type.
- Fallback: `markdown`. No Docs row or no Artifact tool → write `<outputDir>/<slug>.md` in Markdown and return its path; never a plain HTML page instead.

## Structure

- Title, date and author; then a summary of three to five lines: what was done, what was found, what is asked.
- Sections that each answer one question, in the order the reader needs them; tables for comparisons, charts only with data.
- Research report: method, participants (anonymised), findings with their evidence and severity, recommendations, open questions.
- Sources and assumptions at the end; assumptions labelled «supuesto».

## Steps

1. Check the envelope: objective, kind and sources. A missing one → return the Questions above as `<outputDir>/questionnaire.json` and stop.
2. Medium check (see Medium); create the document with its headings first, so the user can watch it fill.
3. `ux-research`, for a research report only: its templates give the method and the structure (research plan, usability test, personas, journey); findings come only from the supplied evidence.
4. Write each section; check every number and quote against the inputs.
5. Run Checks and return.

## Checks

- The summary comes first and stands on its own.
- Every number and quote traces to an input; assumptions labelled «supuesto».
- Participants anonymised; no real client names without approval.
- Gráficos de datos → `data-viz` con su ficha: the «Ficha del gráfico» next to each chart, and `chart-check.mjs` exits 0 on their specs.
- Copy in the envelope's language, no voseo.

## Return

Compact, per the caller's task envelope (`skills/presentation-brief/references/task-envelope.md`), within its `returnBudget`:
- Summary: kind, length, sources, and each decision with its source.
- The document URL, or the Markdown path in the output dir.
- Verification: `<command>: <result>`, one line each.
- Questions: the questionnaire path and its first round (up to 4).
- Open items, such as claims waiting for a source.
