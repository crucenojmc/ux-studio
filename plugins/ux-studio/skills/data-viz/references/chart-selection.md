# Chart selection: by question and data type

Choose in this order: the question the chart answers → the data type of each variable → the channel that carries the most important variable. Write the result in the spec (`question`, `type`, `encodings`) and the reasons in the card («Por qué este gráfico», «Alternativas descartadas y por qué»).

## Sources and conventions

Two sources are cited, and only for what they say. Every other rule here is labelled **convention**: common practice, not a cited result.

- Cleveland, W. S., and McGill, R. (1984). Graphical perception: theory, experimentation, and application to the development of graphical methods. *Journal of the American Statistical Association*, 79(387), 531–554.
- Munzner, T. (2014). *Visualization Analysis and Design*. CRC Press, A K Peters Visualization Series.

## Perceptual accuracy

Cleveland and McGill (1984) ranked the elementary perceptual tasks people use to decode quantities, from most to least accurate: position along a common scale; position along non-aligned scales; length, direction and angle; area; volume and curvature; shading and colour saturation. In their experiments, judgments of position (bar charts) were more accurate than judgments of angle (pie charts).

Munzner (2014) ranks channels by effectiveness. For magnitudes: position on a common scale, position on unaligned scales, length, tilt or angle, area, depth, colour luminance and saturation, curvature, volume. For categories: spatial region, colour hue, motion, shape. She also states the expressiveness principle (encode all of, and only, the information in the data: no ordered channel for unordered categories) and the effectiveness principle (the most important attribute gets the most effective channel), and the rules of thumb «no unjustified 3D» and «get it right in black and white».

Working order of this skill: **position on a common scale > length > angle and area > colour and saturation**. The main value goes on position; colour is for telling categories apart or for a heatmap, never for the main comparison.

## Data types

| Type | What it is | Channels that fit |
|---|---|---|
| quantitative | Counted or measured amounts where differences mean something: orders, minutes, amounts | Position, length; luminance only in a heatmap |
| temporal | Dates and times: ordered and spaced | Position on the horizontal axis, left to right |
| ordinal | Ordered categories: low, medium, high; ranges | Position in their order; a luminance ramp |
| nominal | Unordered categories: channel, branch, product | Separate positions or panels; hue; shape |

Also profile, before choosing: the grain (one row per what), n, whether the rows are a sample or the full count, whether values are observed or estimated, the period, the filters and the cut-off date. Each one goes to the card.

## By question

Each section gives the spec `type` ids that fit, when not to use them, and the common traps.

### Comparison (`comparison`)

Compare amounts across categories.

- Recommended: `column` (few categories, short labels), `bar` (long labels or many categories), `grouped-column` or `grouped-bar` (two categorical dimensions), `dot` or `lollipop` (many categories), `dumbbell` (two values per category), `table` (exact values to look up).
- Not when: the categories are parts of one whole that matters (composition); the axis is time with many points (change over time).
- Traps: a bar axis that does not start at zero (enforced); categories in random order when order means nothing (sort by value: convention); more than three groups side by side (convention: use small multiples); one colour per bar that encodes nothing.

### Ranking (`ranking`)

Order items by a value.

- Recommended: `bar` sorted from largest to smallest, `lollipop`, `dot`; `slope` for the change of rank between two moments.
- Not when: the differences are within the noise (show uncertainty, or a table with the values).
- Traps: ranks without the gap between them; reading a rank as meaningful when n is small (show n); ties hidden by sorting.

### Distribution (`distribution`)

How values spread: centre, spread, shape, extreme values.

- Recommended: `histogram` (one variable), `boxplot` (several groups), `violin` or `density` (shape, large n), `strip` (small n: every point visible), `ecdf` (percentiles and thresholds).
- Not when: the reader needs one number (say the median and the range in text); n is very small (show the points).
- Traps: the bin width changes the story (state it in «Matemática»); a bar of the mean hides the spread; a boxplot hides two peaks; a smoothed density shows values beyond the data range.

### Composition (`composition`)

Parts of a whole.

- Recommended: `stacked-bar` or `stacked-column` (several wholes), `pie` or `donut` (one whole, few parts, shares that matter), `treemap` (many parts in a hierarchy), `waterfall` (how a total is built up or down), `stacked-area` (composition over time).
- Not when: the parts do not add up to a meaningful whole; the parts must be compared precisely across wholes (grouped bars or small multiples).
- Traps: parts that do not sum to the whole (enforced, ±0.5 %); more than five slices (enforced; convention); only the segment on the baseline of a stacked bar can be compared; percentages that hide very different totals (show the totals and n).

### Relationship and correlation (`relationship`)

How two or more quantities vary together.

- Recommended: `scatter` (two quantities), `bubble` (a third quantity as area, sparingly), `heatmap` (two categorical or binned dimensions and one quantity).
- Not when: one variable is time (change over time); there are only a handful of points (a table).
- Traps: correlation read as cause (say so in «Limitaciones y cómo leerlo»); overplotting hides where points pile up (transparency or binning); a fitted line without its formula and fit in «Matemática»; bubbles scaled by diameter instead of area.

### Change over time (`change-over-time`)

How a quantity evolves.

- Recommended: `line` (continuous series, many points), `column` (few periods of discrete counts), `area` (one total series, from zero: convention), `stacked-area` (composition over time), `slope` (two moments), `sparkline` (a small trend next to a figure).
- Not when: there are only two points (a slope or a sentence); the periods are uneven and the axis would hide it.
- Traps: uneven intervals on an even axis; an incomplete last period drawn as a drop (mark it or leave it out: convention); a second axis to put two series together (enforced); an unlabelled log scale (enforced); more than five lines (convention: highlight one, grey the rest).

### Deviation from a target (`deviation`)

The gap between actual values and a target, a budget or an average.

- Recommended: `diverging-bar` (signed gaps from a reference), `bullet` (actual against target, with ranges), `line` with a reference line, `dot` or `dumbbell` (actual and target per item).
- Not when: the target itself is undefined or unknown (ask for it).
- Traps: «good» and «bad» colours for thresholds the business did not define; percentages of very small targets; the reference value not stated on the chart.

### Uncertainty (`uncertainty`)

How sure an estimate is.

- Recommended: `interval` (a point and its interval per category), `line` with a band (an estimate over time), `fan` (several coverage levels of a forecast), `density` or `ecdf` (a distribution of possible outcomes).
- Not when: the values are a full count with no estimation (the card says why no uncertainty applies).
- Traps: an interval without its level (80 %, 95 %) and method in «Matemática»; error bars that mix standard deviation with a confidence interval; a forecast drawn as a single line (enforced: estimates show uncertainty).

### Flows (`flow`)

Movement of quantities between stages, states or places.

- Recommended: `sankey` (quantities between stages), `alluvial` (how category membership changes over time), `table` (an origin–destination matrix with exact values).
- Not when: there are many stages or nodes (convention: more than three stages or about fifteen nodes, aggregate or split); the quantity is not conserved and the losses are not their own flow.
- Traps: link widths that do not add up at a node; colouring by origin and by destination at once.

## Reading rules (checked by `chart-check.mjs`)

| Rule | What it requires | Basis |
|---|---|---|
| `schema` | The spec is valid against `chart-spec.schema.json`; the rules run only on a valid spec | This skill |
| `bar-zero` | Bars, columns, lollipops, histograms, waterfalls and bullets include zero; no log scale on them | Length encoding (Cleveland and McGill 1984); the rule is a convention |
| `pie-slices` | Pie and donut: at most five slices | Convention, grounded in angle and area ranking below position |
| `pie-sum` | The parts add up to the whole, ±0.5 % | Arithmetic: a pie only shows parts of one whole |
| `dual-axis` | A second vertical axis is a warning with a justification and an error without one | Convention |
| `log-label` | A log scale says so in its axis label | Convention |
| `sample-n` | A sample shows n on the chart, not only in the card | Convention |
| `estimate-uncertainty` | Estimates show their uncertainty | Convention |
| `no-3d` | No 3D rendering of two-dimensional data | Munzner 2014, «no unjustified 3D» |
| `palette-size` | At most seven category colours | Convention |
| `color-only` | Categories never told apart by colour alone: a legend or direct labels | Convention; Munzner 2014, «get it right in black and white» |
| `card-field` | Every card field holds real text: no blanks, fillers or template slots | This skill |
| `demo-label` | Demo data says so in «Fuente de los datos» | This skill |

## When a table is better (convention)

A table beats a chart when the reader looks up exact values, when each item has several measures in different units, or when there are only a few numbers. A table answers a question too, so it carries the same card.
