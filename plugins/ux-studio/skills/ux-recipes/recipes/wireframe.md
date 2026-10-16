---
id: wireframe
title: Wireframes
source: claude-design
medium: design
fallback: html
agent: ux-designer
skills: [ux-research]
---
## When

Use when the user wants the structure of one or more screens before any visual design: layout, content hierarchy, what goes where and how the screens connect. Signals: «wireframe», «boceto», «baja fidelidad», «estructura de la pantalla», «qué va en cada pantalla».

Not for:
- the final look, with colour, type and brand → `ui-mockups`
- clicking through the screens of a flow → `app-prototype`
- several design directions of one screen → `variants`
- a sitemap or flow drawn as boxes and arrows, with no screens → `diagram`

## Expect

- **Obtienes:** pantallas en escala de grises con bloques, jerarquía y textos reales del dominio, sobre un lienzo de Design, más el mapa de pantallas cuando son varias.
- **No incluye:** colores, tipografía de marca ni estética final; para pantallas con estética final, `ui-mockups`.
- **Ideal si:** quieres acordar qué va en cada pantalla y en qué orden antes de diseñarla.

## Questions

1. ¿Para qué plataforma son los wireframes?
   - Web (Recomendado)
   - Mobile
   - Web y mobile
2. ¿Qué cubren?
   - Las pantallas de un flujo principal (Recomendado)
   - Una sola pantalla
   - Todo el producto, con su mapa de pantallas
3. ¿Qué textos llevan?
   - Textos reales o verosímiles del dominio (Recomendado)
   - Marcadores genéricos

Infer instead of asking:
- Platform from the envelope's `scope.platforms` or the wording («app», «celular» → mobile).
- The screens from the requirements, the product's routes or an existing `nav-graph.json`.
- Roles from the BRIEF's design scope; default: the main role.

## Medium

- Type: **Design**, a canvas of artboards.
- Run-time check: Artifact `action: "list", scope: "types"`. A Design row → publish with its `type_url` and a `title`; ignore the design system's colours on purpose (greyscale).
- Fallback: no Design row → one plain HTML artifact of grey boxes (`wireframes.html`), one frame per screen at the platform's width (390 mobile, 1440 web), stacked in flow order. No Artifact tool → write it in the output dir and return its path and title.

## Structure

- One artboard per screen, named `NN · Nombre de la pantalla`, in flow order.
- Greyscale only: three or four greys, one stroke weight, no brand colour; crossed boxes for images and media.
- Real hierarchy: title, main content, one primary action per screen; secondary actions visibly lighter.
- Annotations in a side note: purpose, data shown, open decisions.
- A last artboard with the screen map when there are three or more screens.

## Steps

1. Check the envelope: objective, platform, screens. A missing one → return the Questions above as `<outputDir>/questionnaire.json` and stop.
2. `ux-research`: run its information architecture step (`sitemap.mjs` from routes or a `nav-graph.json`, or from the requirements marked «supuesto») and then its wireframes step; skip the research templates.
3. Medium check (see Medium); create the Design artifact from its `type_url`, or the HTML fallback.
4. Draw the artboards per Structure, with the screen map last.
5. Run Checks, publish or update the artifact, and return.

## Checks

- Every screen in scope has its artboard and appears in the screen map.
- No hue anywhere: greys only, so nobody reviews colour at this stage.
- Each screen has one primary action and a title that says what the user does there.
- Labels in the envelope's language, no voseo; data meanings never invented.
- HTML fallback: zero console errors and no horizontal scroll at 390 px.

## Return

Compact, per the caller's task envelope (`skills/presentation-brief/references/task-envelope.md`), within its `returnBudget`:
- Summary: platform, screens, sitemap depth and orphans, and each decision with its source.
- The artifact URL, or the HTML path and title to publish.
- Verification: `<command>: <result>`, one line each.
- Questions: the questionnaire path and its first round (up to 4).
- Open items, and the next recipe when it fits (`ui-mockups` for the final look).
