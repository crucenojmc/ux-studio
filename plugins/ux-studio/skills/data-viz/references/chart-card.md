# The «Ficha del gráfico»

Every chart of statistical or mathematical data carries this card. Its job: the viewer can check the chart instead of trusting it blindly. The card lives in the spec (`card`), so `chart-check.mjs` checks it and the page renders it from the same JSON as the chart.

## Where it goes

- Visible next to its chart: beside it on wide screens, right below it on narrow ones. A collapsible panel is fine when it starts open, or at least shows its «Ficha del gráfico» line next to the chart.
- Never only in an appendix or a methodology page. An appendix may repeat it at length; it never replaces it.
- HTML: `assets/chart-card.html` renders the card from the spec that passed `chart-check.mjs`, so card and chart never drift apart.
- Slides: the six fields on the same slide as the chart, one or two compact lines each, beside or below it; the speaker notes may expand them.
- Documents: right below the chart, before the next paragraph.

## The six fields

| Label shown | Spec path | What to write | Not this |
|---|---|---|---|
| «Pregunta que responde» | `card.question` | The one question the chart answers, as a sentence ending in «?», in the reader's words | The title repeated |
| «Por qué este gráfico» | `card.why` | The kind of question and data that led to this chart, and the channel that carries the main value (position, length) | «Se ve claro», «es el habitual» |
| «Alternativas descartadas y por qué» | `card.alternatives` | At least one other chart that could answer, and why it lost | An empty list |
| «Fuente de los datos» | `card.source` | Origin, extraction, period, filters, cut-off date and n (below) | «La base de datos», «interno» |
| «Matemática» | `card.math` | Formula, aggregation, units, transformations, uncertainty, outliers and assumptions (below) | Code or a query pasted as is |
| «Limitaciones y cómo leerlo» | `card.limitations` | What the chart does not show, and how to read it correctly | A disclaimer that fits any chart |

### «Fuente de los datos»

| Shown as | Spec path | Write |
|---|---|---|
| Origen | `card.source.origin` | The system, file or report the rows come from. Demo data starts with «Datos de demostración:» |
| Consulta o extracción | `card.source.extraction` | How the rows were obtained, in plain words; the query name or file path when there is one |
| Período | `card.source.period` | First and last date covered |
| Filtros | `card.source.filters` | What was included and excluded; «Sin filtros» when none |
| Fecha de corte | `card.source.cutoff` | When the data were extracted or frozen |
| n | `card.source.n` | Records or observations behind the chart, as an integer |

### «Matemática»

| Shown as | Spec path | Write |
|---|---|---|
| Fórmula | `card.math.formula` | Plain notation, each symbol named: «tasa de demora = pedidos con demora ÷ pedidos entregados × 100» |
| Agregación | `card.math.aggregation` | Count, sum, mean, median…, and over which grain (day, branch) |
| Unidades | `card.math.units` | The unit of every axis and of the result |
| Transformaciones | `card.math.transformations` | Log scale, index (base 100), moving average and its window, normalisation; «Ninguna» when none |
| Incertidumbre | `card.math.uncertainty` | The interval, its level and method; or why none applies («No aplica: es el conteo completo, no una muestra») |
| Valores atípicos | `card.math.outliers` | What was excluded or capped and why; «No se excluye ningún valor» when none |
| Supuestos | `card.math.assumptions` | What must hold for the chart to be right |

## Writing rules

- The envelope's language; Spanish by default, neutral, no voseo. Plain business words; a technical term is explained once.
- Formulas in plain notation: words and ×, ÷, Σ, √. No code, no query text.
- Numbers as observed, with their units. No rounding that changes the reading.
- Fillers fail `chart-check.mjs`: a blank, «TBD», «N/A», «…», «Pendiente», «<campo>», «{{campo}}». A field that does not apply says why.

## Demo data

When the data are not real (`data.demo: true`), «Origen» starts with «Datos de demostración:», the chart shows the same label, and `chart-card.html` shows its badge. `chart-check.mjs` fails a demo spec whose origin does not say so (`demo-label`).

## Unknown meanings

Never invent what a field, a value, a unit, a filter or an acronym means, nor a formula the inputs do not give. Each unknown is one questionnaire item: topic `data-meaning`, no `defaultIfUnanswered`, options that are hypotheses backed by observed values, `updates: [{ "target": "chart-spec", "section": "card.source.filters" }]` (the field it fills) and `rerun: ["chart-check"]`. The chart that depends on it waits for the answer. Example: `assets/questionnaire.example.json`.

## A filled card (fictional)

- «Pregunta que responde»: ¿En qué meses del primer semestre se cerraron más pedidos?
- «Por qué este gráfico»: columnas sobre una escala común que empieza en cero; la posición y el largo permiten comparar seis meses con precisión.
- «Alternativas descartadas y por qué»: línea, porque sugiere una evolución continua; torta, porque los meses no son partes de un todo que interese.
- «Fuente de los datos»: Datos de demostración: archivo ficticio de pedidos · conteo de pedidos con estado «cerrado» por mes de cierre · enero a junio · sin anulados · corte al cierre del semestre · n = 782.
- «Matemática»: pedidos(mes) = cantidad de pedidos con fecha de cierre dentro del mes · conteo por mes calendario · pedidos por mes · sin transformaciones · no aplica incertidumbre: conteo completo · no se excluye ningún valor · la fecha de cierre registrada es la real.
- «Limitaciones y cómo leerlo»: muestra cantidad, no importe; los meses tienen distinta cantidad de días hábiles.
