# Decision questionnaire

The core output of the audit, and the format every ux-studio phase uses to return its open questions (brief,
design system, showcase, fidelity, video). Every gap (unknown frequency, volume, device, meaning of a field or
status, business rule) and every pending decision (a proposed change that alters behavior) becomes one closed
question. No phase fills a gap by guessing.

Files: `questionnaire.json`, valid against `assets/questionnaire.schema.json` (example:
`assets/questionnaire.example.json`), plus `questionnaire.md` rendered from it for people who prefer to fill a
document.

## Question fields

| Field | Rule |
|---|---|
| `id` | `Q-01`, `Q-02`… stable across rounds; new questions continue the numbering. |
| `topic` | `frequency`, `redundancy`, `reachability`, `space`, `heuristic`, `accessibility`, `business-rule`, `data-meaning`, `scope`. |
| `priority` | `high` / `medium` / `low`: highest priority of the findings it unblocks (`metrics.md`). |
| `header` | ≤ 12 characters; the chip shown in the question UI ("Frecuencia", "Patente"). |
| `question` | One decision, plain business language, neutral Spanish by default (the brief's language wins), ends with "?". No screen ids, finding ids, field names or jargon. |
| `why` | One or two sentences: what the evidence shows and what it costs. Plain words, no internal ids. |
| `options` | 2–4. Each has `id`, `label` (1–5 words), `description` (what it means) and `consequence` (what changes). |
| recommended | The **first** option, its label ends with ` (Recomendado)`. Exactly one in a single-select question; a `multiSelect` question may recommend several, all of them before the rest. |
| `multiSelect` | Several options can be chosen. `exclusive: true` on an option (e.g. «Saltear») means it cannot be combined with others. |
| `unblocks` | Finding ids (`F-01`…) that stay open until this is answered. |
| `defaultIfUnanswered` | The option (or, in a `multiSelect` question, the options) applied if nobody answers, and how it is labelled as an assumption. Required, except for `business-rule` and `data-meaning`, which have none. |
| `updates` | Where the answer is written; targets per phase in the table below. |
| `rerun` | Checks to run again; checks per phase in the table below. |
| `answer` | `{status: pending|answered|defaulted, option, text, by?, at?}`. `option` is an id, or a list of ids in a `multiSelect` question. |

Targets and checks per phase:

| Phase | `updates[].target` | `rerun` |
|---|---|---|
| `presentation-brief` | `BRIEF.md` | — |
| `design-system-builder` | `design-system` (tokens and README), `brand-audit` (KEEP/CHANGE/ADD/DROP audit), `design-decisions`, `BRIEF.md` | `extract-styles`, `tokens-check` |
| `prototype-showcase` | `prototype`, `design-decisions`, `BRIEF.md` | `showcase-check` (blueprint self-check) |
| `ux-flow-audit` | `BRIEF.md`, `task-inventory`, `design-decisions`, `prototype`, `report` | `task-inventory`, `flow-cost`, `nav-graph`, `space-audit`, `a11y-audit`, `heuristics` |
| `implementation-fidelity` | `decisions-log`, `fidelity-config`, `design-system`, `report` | `capture-states`, `compare` |
| `prototype-to-video` | `storyboard`, `BRIEF.md` | `capture-flows` |
| `data-viz` | `chart-spec` (the chart's spec and its card), `report` | `chart-check` |

Choosing the recommendation:

- Design decisions: the option with the best impact for the frequent tasks, at acceptable effort.
- Factual questions (frequency, volume, devices): the option the current evidence supports most; say which
  evidence in its `description`. Options are ranges, never a single invented number.
- `data-meaning` and `business-rule`: options are hypotheses backed by observed values. They have **no default**:
  omit `defaultIfUnanswered`; unanswered, the finding stays blocked and the question repeats next round.
- `business-rule`: each option's `consequence` states the cost and the risk of choosing it: what changes in the API,
  the web or the data, and who is affected. Shape: «Cambia: … Afecta a … Costo: … Riesgo: …». The person must be
  able to decide without asking for more research.

Writing rules:

- Before writing a question, check whether the code, the docs or the brief already answer it. A data question the
  code answers is not a question: read the code and state the answer as a finding.
- State every premise about the app from the app's own code. Never from an older prototype, mockup or report: a
  prototype may show behavior the app never had.
- One decision per question; do not ask what a measurement already answers.
- Do not ask two questions whose answers depend on each other in the same round (ask the first, then derive or ask
  the second).

## How it is asked

Subagents cannot ask the user. The `ux-designer` agent **returns** the questionnaire; the main conversation asks
it.

1. Sort pending questions by `priority`, then by the number of findings they unblock.
2. Build rounds of up to **4** questions. Before each round, one line of context (what was audited, how many
   rounds remain).
3. Ask each round with one `AskUserQuestion` call: `header` → chip, `question` → question text, each option
   `label` → option label and `description` + " " + `consequence` → option description, `multiSelect` as set.
   The UI adds a free-text "Other" answer.
4. Map each reply back: a label → that option `id` (status `answered`); several labels in a `multiSelect`
   question → the list of ids; "Other" → `text` (status `answered`, `option` null). Record `by` and `at`. An
   `exclusive` option chosen together with others is not a valid answer: ask that question again.
5. If the user prefers a document, hand over `questionnaire.md`; read the filled file back and validate it
   against the schema before using it.
6. A question skipped in a round stays `pending` and is asked again in the next one. When the audit must close
   with questions still pending, apply `defaultIfUnanswered` (status `defaulted`) except for `data-meaning` and
   `business-rule`, and list every default as an assumption in the report.

## After the answers

1. Write each answer where `updates` says: decisions and glossary in `BRIEF.md` (sections "Decisiones",
   "Glosario", "Pendientes"), frequencies and volumes in the task inventory, layout and navigation choices in the
   design decisions or the prototype.
2. Re-run the checks in `rerun` and refresh the affected findings: close, re-prioritize or reopen them with a
   reason.
3. New gaps found by the re-run become new questions (next ids) for the next round.
4. Stop when no `high` question is pending and every P1 finding is closed or explicitly accepted.

## questionnaire.md layout (for filling by hand)

```markdown
## Q-02 · Patente  (prioridad alta)

¿El técnico debe volver a escribir la patente del vehículo al cerrar la orden, o la tomamos de la orden abierta?

Por qué importa: la patente se escribe dos veces en el mismo proceso: 7 caracteres y 4 s extra por orden.

- [ ] **Precargar el dato (Recomendado)**: se muestra la patente de la orden; el técnico puede corregirla. → Ahorra el tipeo y evita errores de transcripción.
- [ ] **Pedirla otra vez**: se mantiene el reingreso como control. → Sigue el costo; solo se justifica si es un control exigido.
- [ ] Otra respuesta: ______

Si no se responde: se aplica «Precargar el dato» y se marca como supuesto.
```

A `business-rule` or `data-meaning` question ends instead with: «Si no se responde: el hallazgo queda bloqueado y la
pregunta se repite en la próxima ronda.»
