---
id: ux-system
title: Sistema UX completo
source: own
medium: html
fallback: none
agent: ux-designer
skills: [prototype-showcase, design-system-builder]
---
## When

- The whole UX of a product in one page, for a UX or design review: a presentation with a cover and controls, navigable mockups, replayable UX flows, the principles, the system and the inventory, with a method annex.
- Signals: «sistema UX», «revisión de UX» or «de diseño», «principios y sistema», «todo el UX en una página», the «Sistema UX completo» format of the brief.
- Not for: one screen or flow to try out (`app-prototype`); comparing alternatives (`variants`); a handoff to developers (`dev-handoff`); slides for executives (`deck`).

## Expect

- Obtienes: una página publicada con portada y controles (rol, vista, tema, movimiento), las maquetas navegables, los recorridos UX reproducibles y las secciones elegidas, con un anexo de método.
- No incluye: código del producto, videos ni la medición de utilidad o accesibilidad.
- Ideal si: un equipo de UX o de diseño revisa el producto entero y necesita ver principios, sistema e inventario junto a la app.

## Questions

Infer instead of asking: platform and roles (the design scope rules of `presentation-brief/references/module-plan.md`, from the repository), the flows (routes and frequent tasks in the code), the language and tone (envelope or BRIEF). Ask only what is left, in one round:

1. **Secciones** (multiple, Q-09): ¿Qué secciones acompañan a las maquetas? «Principios (Recomendado)» · «Sistema (Recomendado)» · «Inventario (Recomendado)» · «Definiciones y decisiones».
2. **Diseño**: ¿De dónde salen los estilos? «Reutilizar el sistema existente (Recomendado)» · «Desde el código del producto» · «Tokens de la plantilla».
3. **Recorridos**: ¿Qué recorridos UX se reproducen? «Las tareas frecuentes de cada rol (Recomendado)» · «Solo el flujo principal».

## Medium

A plain HTML artifact: the `prototype-showcase` template, published with the `Artifact` tool; no Artifact type is involved, so the page needs no type check. Tokens built in step 2 follow `design-system-builder`, which checks the "Design System" type at run time (`action: "list", scope: "types"`). No `Artifact` tool → fallback `none`: the page stays in the output dir and its path and title go back to the caller to publish.

## Structure

`LAYOUT = { mode: 'ux-system', sections: [<chosen>], platforms, roles, webMinWidth }`, in this order:

1. Hero: title, lede and controls (role, view, theme, motion).
2. Stage: the navigable mockups, one frame per declared platform.
3. Flujos: one card per flow, replayable step by step.
4. The chosen sections, in the chosen order: Principios, Sistema (the tokens in use), Inventario (every screen and state), Definiciones y decisiones.
5. Anexo, collapsed: method, data assumptions, what is out of scope.

## Steps

1. Format — `prototype-showcase` (`references/adapting.md` for the product shape): `LAYOUT.mode = 'ux-system'` and the sections from «Secciones».
2. Tokens — `design-system-builder`, only for «Reutilizar» or «Desde el código» when no `tokens.css` exists; «Tokens de la plantilla» skips it and says so once.
3. Build — `prototype-showcase`: copy the template, replace tokens, roles, demo data, screens, sheets, `FLOWS`, the chosen sections' data, the hero and the Anexo (`references/blueprint.md` checklist).
4. Preview and publish — `prototype-showcase` (`assets/preview.mjs`, then `references/publishing.md`).

## Checks

- `node ${CLAUDE_PLUGIN_ROOT}/skills/prototype-showcase/assets/preview.mjs <outputDir>/page.html <outputDir>/preview.html`, then the page at 1440 and 390 px, light and dark: zero console errors.
- «Reproducir» plays every flow; a click inside a frame pauses it; every step's `target` resolves in every declared frame.
- Only the chosen sections render; the demo data is labelled.
- With tokens: `node ${CLAUDE_PLUGIN_ROOT}/skills/design-system-builder/assets/tokens-to-css.mjs <tokens.json> --check` exits 0.

## Return

Artifact URL (or path and title), the `LAYOUT` used with the source of each value, screen, sheet and flow counts, screenshot paths, `<command>: <result>` per check, questions (path and first round), open items.
