---
id: diagram
title: Diagrama
source: claude-design
medium: html
fallback: none
agent: ux-designer
skills: [ux-research, design-system-builder]
---
## When

Use when the user wants a picture of how things connect: a process or task flow, a sitemap or screen map, a system architecture, a sequence between actors. Signals: «diagrama», «flujo», «mapa del sitio», «arquitectura», «diagrama de secuencia», «proceso».

Not for:
- the screens of the flow, even rough ones → `wireframe`
- clicking through the flow → `app-prototype`
- measuring the cost of a flow in an existing app → `ux-audit`
- a long written explanation → `document`

## Expect

- **Obtienes:** un diagrama legible de flujo, mapa del sitio, arquitectura o secuencia, en una página HTML con los colores del sistema de diseño y su texto Mermaid editable.
- **No incluye:** pantallas ni la medición del flujo; para ver las pantallas del flujo, `wireframe`.
- **Ideal si:** necesitas explicar en una sola imagen cómo se conectan pasos, pantallas o sistemas.

## Questions

1. ¿Qué tipo de diagrama?
   - Flujo de un proceso o una tarea (Recomendado)
   - Mapa del sitio o de pantallas
   - Arquitectura de sistemas
   - Secuencia entre actores
2. ¿Dónde se presenta?
   - Página HTML con el diagrama (Recomendado)
   - Lienzo de Design, para editarlo a mano

Infer instead of asking:
- The source: a routes file or a `nav-graph.json` in the inputs → sitemap; otherwise the requirements.
- Direction: top to bottom for hierarchies and flows, left to right for pipelines and architecture.
- Language from the envelope's `language` (default neutral Spanish).

## Medium

- Type: a plain **HTML artifact** built from `${CLAUDE_PLUGIN_ROOT}/skills/ux-recipes/assets/starters/diagram.html`: Mermaid 11.17.2 from `cdn.jsdelivr.net` as an ES module, its base theme fed from the tokens; the raw text stays visible if the library cannot load.
- Design alternative (answer «Lienzo de Design»): Artifact `action: "list", scope: "types"`; a Design row → publish with its `type_url` and draw the diagram on one artboard; no Design row → the HTML page, said once.
- Fallback: none. No Artifact tool → write the HTML in the output dir and return its path and title.

## Structure

- One diagram per section, 15 nodes or fewer; bigger ones split into an overview and details.
- Mermaid kinds: `flowchart TD` for flows and sitemaps, `flowchart LR` with `subgraph` for architecture, `sequenceDiagram` for sequences.
- Every diagram keeps `accTitle` and `accDescr`; decisions are rhombuses with labelled exits; start and end are rounded.
- A one-line caption that explains the notation used.

## Steps

1. Check the envelope: objective, kind and source. A missing one → return the Questions above as `<outputDir>/questionnaire.json` and stop.
2. `ux-research`, for a sitemap only: run `sitemap.mjs` on the routes or the `nav-graph.json`; it emits the Mermaid tree and the orphan screens. For flows, architecture and sequences, write the Mermaid from the requirements and mark guesses «supuesto».
3. Copy `${CLAUDE_PLUGIN_ROOT}/skills/ux-recipes/assets/starters/diagram.html` to the output dir and replace the `<pre class="mermaid">` content.
4. `design-system-builder` (reuse path): with a design system, paste its `tokens.css` values over the starter's `:root` block; no system → the starter's tokens, said once.
5. Run Checks, publish the HTML artifact (or the Design artifact), and return.

## Checks

- Mermaid pinned to an exact version on `cdn.jsdelivr.net`; never `@latest`.
- Online: the diagram draws with zero console errors. With the CDN blocked: the raw text and the status line show.
- No horizontal page scroll at 390 px; a wide diagram scrolls inside its frame.
- Node and label text keeps 4.5:1 contrast in light and dark.
- Labels in the envelope's language, no voseo; no invented steps or systems.

## Return

Compact, per the caller's task envelope (`skills/presentation-brief/references/task-envelope.md`), within its `returnBudget`:
- Summary: kind, node count, source, and each decision with its source.
- The artifact URL, or the HTML path and title to publish.
- Verification: `<command>: <result>`, one line each.
- Questions: the questionnaire path and its first round (up to 4).
- Open items, such as steps marked «supuesto» that need confirmation.
