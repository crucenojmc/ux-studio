# Decisions: when the implementation cannot reach the prototype

The prototype shows intent; it is not the final product. Some deviations are defects, some cannot or
should not be removed. Every deviation gets exactly one class, and every non-defect gets a logged
decision.

## 1. Classify each deviation

| Class | Test | Typical evidence |
|---|---|---|
| **Defect** | The prototype value is reachable with reasonable effort and nothing argues against it | A value in the code differs from the token; a framework default was never overridden (UI kit primary colour, inherited `font-feature-settings`, default chart bar width, axis label format) |
| **Technical constraint** | Reaching the value would break something real | Library cannot render it (chart engine, native control, OS picker); performance cost measured (layout thrash, bundle size); accessibility gets worse (contrast below WCAG, touch target under 24 × 24 CSS px, focus hidden); real data has another shape (long names, empty states, 10× more rows than the demo) |
| **Improvement** | Implementing revealed a better solution | Usability test, real data, accessibility gain, consistency with an existing pattern |

Rules:
- Default to **defect**. A constraint needs evidence: a link to the library documentation, a
  measurement, an axe or Lighthouse result, a sample of real data. Without evidence it stays
  "to be confirmed", not accepted.
- Never invent the meaning of data to justify a deviation; ask.

## 2. Options for a constraint or improvement

Present them with cost and impact; do not choose.

| Option | When it fits | Cost | Impact |
|---|---|---|---|
| **Adapt the prototype and the design system** | The implemented result is as good or better, or the constraint is permanent | Low: update token or component, regenerate the prototype | The new value becomes the standard everywhere; other screens may need the same change |
| **Accept and document** | The deviation is small, local, or temporary (library upgrade planned) | Minimal | Lives on as a known difference; revisit date recommended |
| **Invest in a custom solution** | The prototype detail carries product value (brand, comprehension, conversion) | Medium to high: custom component, own chart renderer, maintenance | Full fidelity at a recurring cost |

## 3. Who decides

- Defects: the implementer fixes; no decision needed.
- Purely visual constraints with no behaviour change: the designer/ux owner proposes, the product
  owner (or the user running the session) approves.
- Anything that changes product behaviour, content, data shown, flow or scope: **the product owner
  or the user decides, never the agent.** The agent stops, presents the options and waits.
- Ask one question at a time; record the answer before moving on.

## 4. Fidelity decisions log

Use `assets/decisions-log-template.md`, one file per product (`fidelity/decisiones.md`), next to
the measurements. Each row: what (values and measured delta), class, why (evidence), options with
cost/impact, chosen option, impact, who decided (name and role), date, design-system change,
finding IDs.

- A deviation without a row is not accepted; it returns to the corrections list.
- When a decision makes the deviation the new standard, change the token or component in the design
  system first, then regenerate the prototype, then re-measure. The design system stays the single
  source of truth; never keep "prototype says X, product says Y" as two truths.
- An accepted deviation is excluded from the threshold only by its log row. The next report lists
  it under "Desvíos que no se corrigen".

## 5. Closing

Fidelity is reached when the final all-states re-measurement (taken after the last fix) meets the agreed
threshold, and every remaining finding has a decision row. Say which of the two closed each finding.
