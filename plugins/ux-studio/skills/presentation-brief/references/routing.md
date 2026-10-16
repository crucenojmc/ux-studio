# Routing by type of work

The first step of the brief classifies the request by type of work. The type picks the path, the skills, the agent and where the output goes. A caller agent uses the same table to choose which agent and skill to invoke (see "For callers").

## Types

Default output dir: `tmp/<topic>/<agent>-<slug>/`, git-ignored (`task-envelope.md`). Paths: **full** = work type → design scope → module plan → format; **short** = work type → design scope → the type questions, in one round.

| Type (id) | Skills | Agent | Path | Type questions | Output |
|---|---|---|---|---|---|
| Diseño gráfico (`grafico`) | `graphic-assets`; Slides and Design artifact types | `ux-designer` | short | Q-10 Piezas, Q-11 Estilo | Assets in the output dir; slides and canvases as claude.ai artifacts |
| Investigación y arquitectura UX (`investigacion`) | `ux-research` | `ux-designer` | short | Q-12 Entregables, Q-13 Evidencia | Plan, personas, sitemap and wireframes in the output dir |
| Diseño UX y prototipos (`diseno-ux`) | `prototype-showcase`, `design-system-builder`, `ux-content` | `ux-designer` | short | Q-14 Entregables; Q-04 Diseño when the prototype or the design system is chosen; Q-08 Formato when the prototype is chosen | Prototype and design system as claude.ai artifacts; `tokens.css` and interface texts in the output dir |
| Implementación frontend (`implementacion`) | `implement-ui` | `ui-developer` | short | Q-15 Origen, Q-16 Cambios | A new branch in the product repository after the user's explicit OK, never pushed, or a patch in the output dir; report in the output dir |
| Auditoría y medición (`auditoria`) | `ux-flow-audit` (incl. the «Accesibilidad» variant), `implementation-fidelity` | `ux-analyst` | short | Q-17 Medición, Q-18 Objeto | Reports, measurements and questionnaire in the output dir |
| Presentación de un producto (`presentacion`) | The module plan: `design-system-builder`, `ux-flow-audit`, `prototype-showcase`, Slides and Design artifact types, `prototype-to-video`, `implementation-fidelity` | Per module: `ux-designer`, `ux-analyst`, `video-producer` | full | Module plan (Q-04 to Q-07) and format (Q-08, Q-09) | `BRIEF.md`, then each module's output |

`ui-developer` is the only agent that edits a product repository. Q-16 only chooses how changes are delivered («Rama nueva, sin push» or «Solo un parche para revisar»); it is not consent to edit. `ui-developer` first returns its plan (exact files and branch), and edits only after the user approves that plan and the caller re-invokes it with `consent: granted`. Every other agent proposes changes and never edits product code or data.

## Classify

Infer the type from the request and the repository first. Ask the router question only when two or more types match, or none.

| Type | Signals in the request |
|---|---|
| `grafico` | icon, illustration, graphic, banner, a standalone deck or canvas |
| `investigacion` | research, interviews, personas, sitemap, information architecture, wireframes |
| `diseno-ux` | prototype, navigable mockup, new screen or flow, design system, tokens, microcopy, error or empty-state texts |
| `implementacion` | implement, turn into code, build the screen in the product, apply the design system to the app |
| `auditoria` | audit, measure, usefulness, accessibility, WCAG, contrast, fidelity, compare the implementation with the prototype |
| `presentacion` | present or demo a product to named audiences (client, sponsor, operators), pitch, video per audience |

A deck or canvas that presents a product to audiences is `presentacion`; a standalone one is `grafico`. Several types in one request: one invocation per type, in dependency order (research before design, design before implementation, implementation before fidelity).

## Router question

Source: `assets/work-type.questions.json`, header "Trabajo", single-select. `AskUserQuestion` takes at most 4 options, so the question shows the 4 most likely types, the recommended one first, and the context line before it names the types not shown, which the user picks with «Otro» (added by `AskUserQuestion`). With no signal the file's default set applies: Presentación de un producto (recommended), Diseño UX y prototipos, Diseño gráfico, Auditoría y medición; Investigación y arquitectura UX and Implementación frontend go to «Otro» because their requests carry explicit verbs and rarely reach the question. A swapped-in option uses its exact texts:

| Option | Description | Consequence |
|---|---|---|
| «Presentación de un producto» | Mostrar un producto a públicos concretos con un prototipo presentable, diapositivas o video. | Brief completo: públicos, plan de módulos y formato de la presentación; es el camino más largo. |
| «Diseño UX y prototipos» | Un prototipo navegable, un sistema de diseño o los textos de la interfaz. | Brief mínimo y hasta 3 preguntas propias; el resultado se publica como artifact. |
| «Diseño gráfico» | Íconos, ilustraciones, piezas gráficas, diapositivas o un lienzo de diseño. | Brief mínimo y 2 preguntas propias: qué piezas y de dónde sale el estilo. |
| «Auditoría y medición» | Medir la utilidad de los flujos, la accesibilidad o la fidelidad de lo implementado. | Brief mínimo y 2 preguntas propias: qué se mide y sobre qué; el producto no se toca. |
| «Investigación y arquitectura UX» | Un plan de investigación, personas, el mapa del sitio o wireframes. | Brief mínimo y 2 preguntas propias: qué entregables y con qué evidencia sobre los usuarios. |
| «Implementación frontend» | Llevar el diseño al código del producto: pantallas y componentes reales. | Brief mínimo y 2 preguntas propias; el repositorio del producto se edita solo con el permiso explícito del usuario. |

Record the type in BRIEF.md "Tipo de trabajo" with its signal, or «supuesto» when the recommendation was applied without an answer.

## Type questions

Source: `assets/work-types/<type>.questions.json`, asked in one round after the design scope. Skip a question the request already answers. Each answer fills a row of the mini brief's "Plan de módulos":

| Type | Answer → plan row |
|---|---|
| `grafico` | Piezas: Íconos and Ilustraciones → `graphic-assets` with those variants; Diapositivas → Slides artifact; Lienzo de diseño → Design artifact. Estilo → the variant of every row. |
| `investigacion` | Entregables → `ux-research` with those variants. Evidencia → recorded in its "Por qué"; with «Ninguna todavía» every output is labelled a hypothesis. |
| `diseno-ux` | Prototipo navegable → `prototype-showcase` + Q-08 (and Q-09 only when the format rules recommend a section); Sistema de diseño → `design-system-builder` + Q-04; Textos de la interfaz → `ux-content`. The prototype alone also asks Q-04, for its tokens. |
| `implementacion` | Origen → `implement-ui` variant. Cambios: delivery mode only («Rama nueva, sin push» or, with no answer, «Solo un parche»); consent to edit is given later, on `ui-developer`'s plan. Repository path and branch go to "Restricciones". |
| `auditoria` | Utilidad → `ux-flow-audit`; Accesibilidad → `ux-flow-audit`, «Accesibilidad» variant; Fidelidad → `implementation-fidelity` (always the app against the prototype). Objeto → the variant of the first two. |

## Recipes

A recipe (`ux-recipes`) is a ready path inside a type of work: its questions, medium, steps and checks already chosen. After classifying, recommend the recipe whose «cuándo» matches (`ux-recipes/recipes/index.md`) and show it with its Expect bullets before starting; the user's pick goes through the fit check. None matches → the type's skills, as above.

| Type | Recipes |
|---|---|
| `grafico` | `print-piece`, `deck`, `document`, `diagram`, `html-email`, `object-3d`, `color-type-pairing` |
| `investigacion` | `wireframe`, `diagram`, `document`, `data-story` |
| `diseno-ux` | `app-prototype`, `variants`, `ui-mockups`, `ux-system`, `animation`, `color-type-pairing`, `data-story` |
| `implementacion` | `dev-handoff`, `redesign` |
| `auditoria` | `ux-audit`, `redesign`, `document`, `data-story` |
| `presentacion` | `ux-system`, `deck`, `document`, `data-story` |

## For callers

A caller agent (or the main conversation acting for the user) skips the brief: it picks the row for the type of work, invokes `subagent_type: "ux-studio:<agent>"` with a task envelope (`task-envelope.md`) naming the skill(s) or a `recipe`, the inputs, the design scope and a unique output dir, and gets back a compact summary, artifact paths and closed questions. It asks those questions to the user, or answers them from its own context only when it holds the answer, and re-invokes with the answers.

- Invoke several agents in parallel only when each has its own output dir and none needs another's output: `ux-research` with `graphic-assets`, or an accessibility audit with a usefulness audit, run together; `prototype-showcase` before an audit on that prototype does not.
- `implementacion` needs the user's explicit OK before `ui-developer` edits the product repository; a caller never grants it on the user's behalf.
- `presentacion` needs the user's audiences and decisions: run this skill in the main conversation, then invoke the agents per module with the resulting BRIEF.md path in the envelope.
