---
id: color-type-pairing
title: Paleta y tipografía
source: claude-design
medium: design-system
fallback: html
agent: ux-designer
skills: [design-system-builder]
---
## When

Use when the user wants to choose or refresh a colour palette and a type pairing for a brand or product, before or instead of a full design system. Signals: «paleta», «colores», «tipografía», «fuentes», «combinación de fuentes», «identidad visual».

Not for:
- a complete design system with components and guidelines → `ux-system`
- screens that apply the palette → `ui-mockups`
- a new look for an existing product → `redesign`
- several directions of one screen → `variants`

## Expect

- **Obtienes:** dos o tres propuestas de paleta y tipografía, con roles de color, escala tipográfica, modo claro y oscuro y la verificación de contraste de cada combinación.
- **No incluye:** componentes, pantallas ni guía de uso completa; para un sistema de diseño completo, `ux-system`.
- **Ideal si:** necesitas decidir la base visual de una marca o un producto antes de diseñar pantallas.

## Questions

1. ¿De qué se parte?
   - De la marca existente: logo y colores actuales (Recomendado)
   - De cero, con una dirección a elegir
   - De un sitio web que hay que auditar
2. ¿Cuántas propuestas?
   - Tres para comparar (Recomendado)
   - Dos
   - Una sola
3. ¿Dónde se usa sobre todo?
   - Interfaz de producto (Recomendado)
   - Marketing y comunicación
   - Ambos por igual

Infer instead of asking:
- Brand colours and logo from the supplied files or URL; never from another company's brand.
- Fonts: Google Fonts or system stacks only.
- Dark mode: always proposed, never asked.

## Medium

- Type: **Design System**.
- Run-time check: Artifact `action: "list", scope: "types"`. A Design System row → publish the chosen proposal from its `type_url`, following `design-system-builder`'s `design-system-artifact.md`.
- Fallback: no Design System row → one plain HTML artifact with every proposal side by side (swatches, type scale, sample interface, contrast table), built from each proposal's `tokens.css`. No Artifact tool → write it in the output dir and return its path and title.

## Structure

- Per proposal, colour roles mapped to the core tokens: `surface-*`, `text-*`, `border-*`, `accent`, `on-accent`, `status-*`, `series-1` to `series-5`, in light and dark.
- Type pairing: `sans`, plus `display` and `mono` when they earn their place; text styles display, title, heading, body, label and caption with size, line height and weight.
- A specimen: swatches with hex and role, the type scale, a sample card, form and table, and the contrast table per theme.
- A recommendation with its reason, and what each proposal is best for.

## Steps

1. Check the envelope: objective and starting point. A missing one → return the Questions above as `<outputDir>/questionnaire.json` and stop.
2. `design-system-builder`: follow the path the first answer picks (reuse, audit a web, or from scratch, whose reference covers directions, roles and type) and write one `tokens.json` per proposal, valid against its tokens contract.
3. Run `node ${CLAUDE_PLUGIN_ROOT}/skills/design-system-builder/assets/tokens-to-css.mjs <tokens.json> --check` per proposal; fix every error and fix or justify every warning.
4. Medium check (see Medium); publish the Design System artifact or the HTML fallback with all proposals.
5. Run Checks and return; marking a system as the account default is the user's action in claude.ai.

## Checks

- `tokens-to-css.mjs --check` exits 0 for every proposal.
- Text contrast 4.5:1 (3:1 from 24 px) in light and dark; `on-accent` on `accent` and each status pair at 4.5:1.
- Colours told apart by lightness, not by hue alone; no AI tropes (blue-to-purple gradients, emoji cards).
- Fonts only from Google Fonts or the system; licences noted.
- HTML fallback: zero console errors and no horizontal scroll at 390 px.

## Return

Compact, per the caller's task envelope (`skills/presentation-brief/references/task-envelope.md`), within its `returnBudget`:
- Summary: the proposals, the recommended one and why, and each decision with its source.
- The artifact URL, or the HTML path and title to publish, and the `tokens.json` paths.
- Verification: `<command>: <result>`, one line each.
- Questions: the questionnaire path and its first round (up to 4), starting with which proposal to keep.
- Open items, and the next recipe when it fits (`ux-system` to grow it into a full system).
