---
id: ux-audit
title: Auditoría UX y de accesibilidad
source: own
medium: docs
fallback: markdown
agent: ux-analyst
skills: [ux-flow-audit]
---
## When

- Measure how useful and how accessible a product, a prototype or a brief is, with evidence, without changing anything.
- Signals: «auditar», «medir la utilidad», «accesibilidad», «WCAG», «contraste», «cuántos clics», «qué tan usable es».
- Not for: comparing an implementation with its prototype (`implementation-fidelity`, type `auditoria`, no recipe); redesigning the screen after the audit (`redesign`, which starts with this audit).

## Expect

- Obtienes: un informe con hallazgos priorizados y su evidencia (costo de las tareas, alcance por rol, uso del espacio, barreras de accesibilidad) y un cuestionario de decisiones de opciones cerradas.
- No incluye: cambios en el producto ni un rediseño: las correcciones quedan propuestas, y la verificación de accesibilidad es automática y parcial.
- Ideal si: hay que decidir con números qué mejorar primero, antes de rediseñar o de implementar.

## Questions

Infer instead of asking: the target (a URL is the app or the prototype; documents are paper), platform and roles (design scope), the language. Ask only what is left, in one round:

1. **Medición** (multiple, from Q-17): ¿Qué medimos? «Utilidad de los flujos (Recomendado)» · «Accesibilidad (Recomendado)».
2. **Objeto** (Q-18): ¿Sobre qué medimos? «La app existente (Recomendado)» · «El prototipo» · «El papel».

A URL needs an authorized local or test environment and a Playwright storage state per role: each missing one is a questionnaire item; never production.

## Medium

The report: a Docs document when the run-time check with the `Artifact` tool (`action: "list", scope: "types"`) lists a Docs type; start it from that type and follow its instructions (or the host's first-party document connector, when the type says so). Not listed, or no `Artifact` tool → fallback `markdown`: `report.md` stays in the output dir as Markdown and its path is returned. The questionnaire is always `questionnaire.json` in the output dir.

## Structure

The `ux-flow-audit` report, in this order:

1. Summary: three lines and the P1 findings.
2. Usefulness: task inventory per role, flow cost, reachability, screen space and heuristics, each finding with its evidence.
3. Accessibility («Accesibilidad» variant): barriers by criterion, «verificación automática parcial», what needs a human.
4. Prioritised corrections: impact (frequency × cost; unknown frequency stays pending) and effort.
5. Decision questionnaire: its path and the first round, up to 4 closed questions.

## Steps

1. Envelope — check the target, the authorized environment and the storage states before any heavy reading; anything missing → return the questionnaire with only those items.
2. Usefulness — `ux-flow-audit`: task inventory, `flow-cost.mjs`, `nav-graph.mjs`, `space-audit.mjs` and heuristics on the chosen target.
3. Accessibility — `ux-flow-audit`, «Accesibilidad» variant: `references/accessibility.md`, then `a11y-audit.mjs`. Steps 2 and 3 may be two parallel invocations, each with its own output dir.
4. Report and questionnaire — `ux-flow-audit`: `report.md` from the template and `questionnaire.json`; publish the report per Medium.

## Checks

- `node ${CLAUDE_PLUGIN_ROOT}/skills/ux-flow-audit/assets/flow-cost.mjs <outputDir>/tasks.json --out <outputDir>` exits 0.
- `node ${CLAUDE_PLUGIN_ROOT}/skills/ux-flow-audit/assets/a11y-audit.mjs --url <url> --platform <web|phone|both> --out <outputDir>` exits 0, or exit 2 (no browser) is reported and the paper checks still run.
- Every finding cites evidence; no frequency is estimated; `questionnaire.json` is valid against `${CLAUDE_PLUGIN_ROOT}/skills/ux-flow-audit/assets/questionnaire.schema.json`.
- Gráficos de datos → `data-viz` con su ficha: the «Ficha del gráfico» next to each chart, and `chart-check.mjs` exits 0 on their specs.

## Return

Docs URL or `report.md` path, the P1 findings in one line each, `<command>: <result>` per check, questionnaire path and first round (up to 4, recommended first), proposed changes path, open items (device or data checks pending).
