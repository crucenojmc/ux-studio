# Metrics, formulas and thresholds

Thresholds below are **conventions** of this skill, not research results. Calibrate them with the client and
record any change in the report. Sources for the underlying models are in `method.md`.
Charts of these numbers in the report (flow cost per task, findings per priority) follow `data-viz`: each chosen by its question and data type, with its «Ficha del gráfico» next to it.

## Flow cost (`assets/flow-cost.mjs`)

Input per task: `{id, role, title?, variant?: current|proposed, actors?, frequency: {count, per} | null, steps}`;
optional top-level `operators` (override K, P, B, H, M) and `calendar` `{hoursPerDay, daysPerWeek}`.

Step expansion (hands start on the mouse; `H` is inserted whenever the hand must move):

| Step | Operators | Clicks | Notes |
|---|---|--:|---|
| `click`, `navigate`, `confirm` | M P B B | 1 | `navigate` counts a context switch; `confirm` is flagged |
| `select` | M P B B M P B B | 2 | open the list, then find and pick |
| `type`, `focus: "click"` (default) | M P B B H K×chars | 1 | |
| `type`, `focus: "tab"` | M K K×chars | 0 | Tab key counts as one K |
| `type`, `focus: "none"` | M K×chars | 0 | scanner, autofocus |
| `wait` | W(seconds) | 0 | any step may add `seconds` of W |

Formulas:

- `seconds` = ΣK·tK + ΣP·tP + ΣB·tB + ΣH·tH + ΣM·tM + ΣW
- `fields` = distinct `field` values in `type`/`select` steps (+1 per entry step without a field)
- `perWeek`: hour → count × hoursPerDay × daysPerWeek; day → count × daysPerWeek; week → count;
  month → count × 12 / 52. A defaulted calendar (8 h, 5 days) is listed in `assumptions` and becomes a question.
- `weeklySeconds` = seconds × perWeek (per person); `weeklySecondsAllActors` = × actors when known.
- `potentialSavingSeconds` = Σ seconds of entry steps flagged `repeated-in-task`, `derivable` or
  `known-by-system`. Cross-task repetition and confirmations are flagged but not counted: removing them is a
  decision (questionnaire).
- Comparison: `deltaSeconds` = current − proposed (same task id), `weeklyDeltaSeconds` = delta × perWeek of the
  current variant.

## Placement tiers (convention)

| Tier | Rule of thumb | Max interactions from role home | Trigger visible without scrolling |
|---|---|--:|---|
| A | several times per day per person, or criticality `alta` | 1 | yes, on the smallest key viewport |
| B | daily to weekly | 2 | preferably |
| C | monthly, administrative, configuration | 3 | no |

Anything deeper than 3 is a finding regardless of tier.

## Reachability (`assets/nav-graph.mjs`)

- **depth**: interactions from the role's home (home = 0). Following a link or clicking a control costs 1; a
  redirect costs 0. A feature matched by a control label on a screen at depth d has depth d + 1.
- **reachable**: found by breadth-first search from the role's home over edges whose target the role may
  access (showcase: `screen.access`; crawl: what the role's session could load).
- **onlyByUrl**: accessible to the role but not reachable through the UI.
- **orphan**: a screen or page with no inbound edge from any role, and not a role home.
- **dead end**: a reachable screen with no edge to another screen or page (sheets, dialogs, files and
  external links do not count as exits).
- **deep**: depth > 3.
- **roleLocked**: roles listed for a feature that cannot reach it while at least one other listed role can.
- **flow step not backed** (showcase): a tour step that changes screen with no UI edge between the two screens.
- **broken** (crawl): a linked page that answered ≥ 400 or failed to load.
- Feature status: `OK`, `Profunda (> 3)`, `Bloqueada para <roles>`, `Solo por URL`, `Inalcanzable`.

## Screen space (`assets/space-audit.mjs`)

All measured at scroll position 0 on the given viewport (CSS px; phones run as mobile devices).

| Metric | Formula |
|---|---|
| `contentPct` | area(content ∖ chrome) ∩ viewport / viewport area × 100 |
| `chromePct` | area(⋃ header, sidebar, footer) ∩ viewport / viewport area × 100 (chrome inside the content element ignored) |
| `otherPct` | 100 − contentPct − chromePct (background, gutters, empty area below short content) |
| `whitespacePct` | 1 − area(⋃ text boxes, images, media, controls) / visible content area, × 100 |
| `textDensity` | visible characters in the content / (visible content area / 10 000 px²) |
| `primary.aboveFold` | primary action fully inside the first viewport; `scrollPx` = how far below it ends |
| `contentStartPx` / `contentStartPct` | top of the first text, image or control in the content / viewport height |
| `pageScreens` | document height / viewport height |
| `horizontalOverflow` | document scroll width > viewport width |
| table `emptyColumns` | columns whose body cells are empty in ≥ 90% of rows |
| table `widthPct`, `overflowX` | table width / content width; table scrolls or exceeds the viewport horizontally |

Flags (convention thresholds, overridable with `thresholds` in the config):

| Flag | Default rule |
|---|---|
| `primary-below-fold` | primary action not fully visible on the first screen |
| `primary-not-found` | a primary selector was given but nothing visible matched |
| `chrome-heavy` | chromePct > 30 (viewport ≥ 600 px wide) or > 20 (narrower) |
| `viewport-underused` | otherPct > 50 |
| `content-starts-low` | contentStartPct > 50 |
| `sparse-content` | whitespacePct > 90 |
| `dense-content` | whitespacePct < 40 |
| `horizontal-overflow`, `table-overflow`, `table-empty-columns` | as measured |
| `content-selector-not-found` | the content selector matched nothing; body was used |

Read flags with judgment: a sparse login screen is fine; a sparse list of the most frequent task is not.

## Findings: impact and priority (convention)

- **Impact** = executions per week × seconds lost per execution × people doing it. For findings without a time
  cost (unreachable feature, role-locked, broken), impact is `bloqueante` when a tier A task is affected.
- Unknown frequency → impact `pendiente` and a frequency question; never estimate it silently.
- **Effort**: S (copy, layout, default value), M (one screen or component), L (new flow, backend change).
- **Priority**: P1 = blocking, or tier A with impact ≥ 30 min per person per week; P2 = impact ≥ 5 min per
  person per week, or any tier A finding; P3 = the rest. Effort breaks ties (S before L).
