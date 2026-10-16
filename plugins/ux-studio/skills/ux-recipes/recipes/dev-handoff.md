---
id: dev-handoff
title: Handoff a desarrollo
source: own
medium: design-system
fallback: html
agent: ux-designer
skills: [design-system-builder, ux-content, prototype-showcase, implement-ui]
---
## When

- A decided design goes to developers: the prototype with every screen and state, the tokens, and an implementation plan for the product repository.
- Signals: «handoff», «pasar a desarrollo», «traspaso», «qué tiene que implementar el equipo», «especificación para desarrolladores».
- Not for: a design still open (`variants`); an existing screen to fix from evidence (`redesign`); implementing right away (type `implementacion`: `implement-ui` by `ui-developer`, with consent); a review of the whole UX (`ux-system`).

## Expect

- Obtienes: el prototipo con recorridos e inventario de pantallas y estados, los tokens publicados como sistema de diseño y un plan de implementación con archivos y rama exactos.
- No incluye: cambios en el código del producto: el plan se ejecuta solo con permiso explícito, en otra invocación.
- Ideal si: el diseño ya está decidido y el equipo de desarrollo necesita saber qué construir, con qué tokens y en qué archivos.

## Questions

Infer instead of asking: the product repository and its stack (`stack-detect.mjs`), platform and roles (design scope), the prototype when the inputs already hold one, the language. Ask only what is left, in one round:

1. **Tokens**: ¿De dónde salen los tokens? «Reutilizar el sistema existente (Recomendado)» · «Extraerlos del código del producto» · «Desde cero».
2. **Prototipo**: ¿Qué prototipo se entrega? «El publicado, con su inventario (Recomendado)» · «Uno nuevo desde las pantallas indicadas».
3. **Estados**: ¿Qué estados se documentan por pantalla? «Todos los estados (Recomendado)» · «Solo los que ya existen».

## Medium

The tokens: a Design System artifact. Check at run time with the `Artifact` tool (`action: "list", scope: "types"`) that a "Design System" type is listed, then publish per `design-system-builder` `references/design-system-artifact.md`. Not listed → fallback `html`: the system's cover and `tokens.css` usage as one plain HTML artifact. The prototype is a plain HTML artifact (`prototype-showcase`); the plan is a Markdown file in the `ui-developer` output dir. No `Artifact` tool → paths and titles go back to the caller.

## Structure

1. Tokens: the design system with every token in use, plus `tokens.css` in the output dir.
2. States: the inventory of required states per screen (empty, loading, error, success, partial, offline) with the copy of each.
3. Prototype: `LAYOUT = { mode: 'tour', sections: ['inventario'], platforms, roles }`, the app with its flows and the Inventario section (the development row of `presentation-brief/references/module-plan.md`).
4. Plan: exact files, branch, token mapping, tests and commands, returned with `consent: pending`.

## Steps

1. Tokens — `design-system-builder` by `ux-designer`: reuse, from code or from scratch per «Tokens»; `--check` exits 0; publish per Medium.
2. States — `ux-content` by `ux-designer`: `states-inventory.mjs` on the screens, then the copy of each state.
3. Prototype — `prototype-showcase` by `ux-designer`: `LAYOUT.mode = 'tour'` with the Inventario section; with «El publicado», reuse it and add only the inventory.
4. Plan — `implement-ui` by `ui-developer`, a separate invocation with `consent: pending` (inputs: repository path, prototype URL, `tokens.css`): it returns the plan and stops. Implementing is another invocation with `consent: granted`, after the user approves that plan; then `implementation-fidelity` measures it.

Steps 1 and 2 run in parallel, each with its own output dir; step 3 needs both; step 4 needs step 3.

## Checks

- `node ${CLAUDE_PLUGIN_ROOT}/skills/design-system-builder/assets/tokens-to-css.mjs <tokens.json> --check` exits 0.
- `node ${CLAUDE_PLUGIN_ROOT}/skills/ux-content/assets/states-inventory.mjs <screens.json> --out <outputDir>/states` exits 0; every screen has its states.
- `node ${CLAUDE_PLUGIN_ROOT}/skills/prototype-showcase/assets/preview.mjs <outputDir>/page.html <outputDir>/preview.html`: zero console errors; the Inventario lists every screen and state.
- The plan names exact files and the branch, following `node ${CLAUDE_PLUGIN_ROOT}/skills/implement-ui/assets/stack-detect.mjs <repo>`; nothing is written in the repository.
- Gráficos de datos → `data-viz` con su ficha: the «Ficha del gráfico» next to each chart, and `chart-check.mjs` exits 0 on their specs.

## Return

Design System artifact URL (or its HTML fallback), prototype URL, states inventory and plan paths, `<command>: <result>` per check, questions (path and first round), and the envelope to implement with `consent: granted`, pending the user's approval of the plan.
