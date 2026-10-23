---
id: app-prototype
title: App simulada
source: own
medium: html
fallback: none
agent: ux-designer
skills: [prototype-showcase]
---
## When

- The team's most common request: one screen or one flow people click through as if it were the real app, at full viewport.
- Signals: «prototipo», «simula la pantalla», «maqueta navegable», «quiero probar el flujo», a live demo, a test with users.
- Not for: several alternatives to choose from (`variants`); the whole UX with principles and system (`ux-system`); static screens with no navigation (`ui-mockups`); an existing screen that works badly (`redesign`); a handoff to developers (`dev-handoff`).

## Expect

- Obtienes: la app simulada a pantalla completa, navegable de punta a punta, con datos de demostración rotulados, publicada como artifact.
- No incluye: portada, secciones ni recorridos guiados; tampoco código del producto ni alternativas para comparar.
- Ideal si: hay que mostrar o probar una pantalla o un flujo concreto, en vivo o con usuarios.

## Questions

Infer instead of asking: the screen or flow (objective and inputs), platform and roles (the design scope, from the repository), the styles (an existing `tokens.css` or design system is reused without asking), the language. Ask only what is left, in one round:

1. **Alcance**: ¿Qué simulamos? «Un flujo completo (Recomendado)» · «Una sola pantalla con sus estados».
2. **Estados**: ¿Qué estados se pueden ver? «Normal, vacío, carga y error (Recomendado)» · «Solo el estado normal».
3. **Datos**: ¿De dónde salen los datos de demostración? «Realistas y rotulados como demo (Recomendado)» · «Un ejemplo que aporta el equipo».

## Medium

A plain HTML artifact: the `prototype-showcase` template, published with the `Artifact` tool. No Artifact type is involved, so there is no type check. No `Artifact` tool → fallback `none`: the page stays in the output dir and its path and title go back to the caller to publish.

## Structure

`LAYOUT = { mode: 'app', sections: [], platforms, roles, webMinWidth }`: the app at full viewport, nothing else.

- The screens of the flow and their sheets, linked with `data-go` and `data-act="sheet"`.
- The states chosen in «Estados», reachable from their screen.
- `FLOWS` still declared: fidelity and video read them through `window.SHOWCASE`, even though `app` shows no flow cards.

## Steps

1. Scope — `prototype-showcase` (`references/adapting.md`): map the flow to screens and sheets; `LAYOUT.mode = 'app'`, no sections.
2. Build — `prototype-showcase`: copy the template, then replace the tokens (an existing `tokens.css`, otherwise the template's, said once), roles, demo data, screens, sheets and `FLOWS` (`references/blueprint.md` checklist).
3. Preview and publish — `prototype-showcase` (`assets/preview.mjs`, then `references/publishing.md`); republishing the same path keeps the URL.

## Checks

- `node ${CLAUDE_PLUGIN_ROOT}/skills/prototype-showcase/assets/preview.mjs <outputDir>/page.html <outputDir>/preview.html`, then the page at each declared width (1440 web, 390 phone), in the themes the brief or product declares, checked once at the end: zero console errors.
- Every `data-go` opens its screen; every flow step's `target` resolves in every declared frame.
- No cover, no sections, no flow player; the demo data is labelled.

## Return

Artifact URL (or path and title), platforms and roles with their source, screen and flow counts, screenshot paths, `<command>: <result>` per check, questions (path and first round), open items.
