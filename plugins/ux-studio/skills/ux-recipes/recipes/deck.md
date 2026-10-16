---
id: deck
title: Presentación en diapositivas
source: claude-design
medium: slides
fallback: html
agent: ux-designer
skills: [graphic-assets]
---
## When

Use when the user wants a slide deck to present in front of an audience: a pitch, a project update, a training session, a research readout. Signals: «presentación», «diapositivas», «slides», «deck», «PowerPoint», «para exponer».

Not for:
- a document to read rather than present → `document`
- a single poster or social piece → `print-piece`
- presenting a navigable prototype → `app-prototype`

## Expect

- **Obtienes:** una presentación en el tipo Slides con el sistema de diseño por defecto, una idea por diapositiva y notas del orador; se puede descargar como PPTX o PDF.
- **No incluye:** un documento para leer de corrido; para un informe escrito, `document`.
- **Ideal si:** vas a exponer frente a una audiencia y necesitas un apoyo visual claro.

## Questions

1. ¿Para qué audiencia es?
   - Dirección o clientes: decisiones y resultados (Recomendado)
   - Equipo de trabajo: avance y detalle
   - Capacitación
2. ¿Qué extensión tiene?
   - De 8 a 12 diapositivas (Recomendado)
   - Hasta 5 diapositivas
   - Más de 15 diapositivas
3. ¿Lleva notas del orador?
   - Sí (Recomendado)
   - No

Infer instead of asking:
- The content and numbers from the envelope's `inputs`; a missing figure is a question, never invented.
- The design system: the account default from the publish result.
- Language and tone from the envelope's `language` (default neutral Spanish).

## Medium

- Type: **Slides**.
- Run-time check: Artifact `action: "list", scope: "types"`. A Slides row → publish with its `type_url` and a `title`; the result carries the design systems: use the default one.
- Fallback: no Slides row → one plain HTML artifact deck: one 16:9 section per slide, keyboard navigation (← and →), a print stylesheet with one slide per page, slides scaled to the width at 390 px. A `.pptx` file only when the user asks for that format. No Artifact tool → write the HTML in the output dir and return its path and title.

## Structure

- A title slide; an agenda only from ten slides up; a closing slide with the decision asked or the next steps.
- One message per slide, written as a full sentence in the title; three bullets at most, or one visual.
- Charts as real charts: the choice and the card come from `data-viz`; the optional `dataviz` skill, when listed, only styles them. Never a number without a source.
- Speaker notes per slide when the answer asked for them.

## Steps

1. Check the envelope: objective, audience and content. A missing one → return the Questions above as `<outputDir>/questionnaire.json` and stop.
2. Write the outline: one sentence title per slide, in order, from the inputs; gaps in the data become questions.
3. Medium check (see Medium); create the deck from the Slides type with the default design system.
4. `graphic-assets`: the icons, spot illustrations and exported images the slides need, in the system's tokens.
5. Fill the slides and the notes, run Checks, and return.

## Checks

- Every title is a sentence with one message; no slide has more than three bullets.
- Design system styles only; text contrast 4.5:1.
- Every number traced to an input; demo figures labelled as such.
- HTML fallback: zero console errors, no horizontal scroll at 390 px, keyboard navigation works.
- Gráficos de datos → `data-viz` con su ficha: the «Ficha del gráfico» next to each chart, and `chart-check.mjs` exits 0 on their specs.
- Copy in the envelope's language, no voseo.

## Return

Compact, per the caller's task envelope (`skills/presentation-brief/references/task-envelope.md`), within its `returnBudget`:
- Summary: audience, slide count, design system, and each decision with its source.
- The artifact URL, or the HTML path and title to publish.
- Verification: `<command>: <result>`, one line each.
- Questions: the questionnaire path and its first round (up to 4).
- Open items, such as figures waiting for a source.
