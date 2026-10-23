# Method: paired states, element map, tolerances, cycle

## 1. Inputs

| Input | Source | Required |
|---|---|---|
| Prototype | `prototype-showcase` file or URL; its registry and FLOWS list the screens, roles, sheets and demo data | yes |
| Implementation | URL of the built product (local, staging, demo tenant) and how to log in | yes |
| Design system | `tokens.css` (config `tokensCss`, see section 3) and the Design System artifact from `design-system-builder` | yes |
| States to compare | Start from the showcase registry/flows: one state per screen × role × sheet the flows visit | yes |
| Viewports | The BRIEF's platform ("Alcance del diseño"): `web` 1440 × 900, `phone` 390 × 844, or both; DPR as the real devices. The prototype side captures only the platforms its showcase declares | yes |
| Themes | Only the themes the product ships (`light`, `dark`) | yes |
| Agreed threshold | For example: score ≥ 95 % per state, pixel diff ≤ 2 %, zero A findings | ask once |

Write them into `fidelity.config.json` (copy `assets/fidelity.config.example.json`).

## 2. Paired states: the same state on both sides

A comparison only means something when both sides show the same thing. For every state fix:

- **Same data.** The prototype uses its demo data; the implementation must load the same records
  (fixture, seed, demo tenant or a mocked API). Without a backend that serves them, answer the
  app's requests with the prototype's data: `implementation.routes` (below). When data still
  cannot match, mask the data-bearing areas and say so under "Límites" in the report. Verify by
  content (the same names and figures appear on both sides), never by dates.
- **Same viewport, DPR, theme, locale, time zone.** One browser context per viewport × theme,
  shared by both sides.
- **Frozen time.** `frozenTime` sets `Date.now()` and `new Date()` in the implementation (Playwright
  clock). The prototype keeps its own fixed demo clock (the showcase does not read the real time),
  so the setting changes nothing there: mask a clock that still differs.
- **No motion.** Reduced motion, a stylesheet that disables CSS transitions and animations,
  `animations: 'disabled'` on the screenshot, caret hidden.
- **Fonts loaded.** Wait for `document.fonts.ready`, then two animation frames.
- **Prototype side.** `capture-states.mjs` opens `<prototype>?capture=<web|phone>#<hash>&theme=<t>&motion=reduced`
  (the showcase's deterministic capture mode). Use `hash` (`screen=…&role=…&sheet=…`) or
  `open` (passed to `window.SHOWCASE.open(to)`), plus optional `steps`. Hash parameters beyond
  `screen`, `role` and `sheet` are not dropped: they stay in the hash and reach
  `SHOWCASE.open`, so a prototype that supports more (a tab, a filter) can be driven the same way.
- **Implementation side.** `path` plus `steps`; `themeSteps` per theme when the app does not follow
  `prefers-color-scheme`.

Steps vocabulary: `{click}`, `{fill, value}`, `{hover}`, `{press}`, `{waitFor}`, `{wait}` (ms, last
resort), `{goto}`, `{scroll}` (scroll an element into view, also inside inner scroll containers),
`{open}` (showcase), `{evaluate}` (expression string). Selector steps (`click`, `fill`, `hover`,
`waitFor`, `scroll`) act on the first VISIBLE match, so a screen rendered twice (web frame and phone
frame) is driven through the copy that is on screen.

**Request fixtures** (`implementation.routes`). When the app reads its data from an API, answer
those requests with the prototype's demo data instead of masking:

```json
"implementation": {
  "url": "https://staging.example.com",
  "routes": [
    { "url": "**/api/orders*", "fulfill": "fixtures/orders.json", "status": 200 }
  ]
}
```

`url` is a Playwright glob or URL, `fulfill` a JSON file relative to the config, `status` optional
(default 200). The routes are installed on every implementation page before it navigates and never
touch the prototype. Write the JSON from the prototype's own data, then check by content that the
same names and figures show on both sides. A missing file or a route without `url` stops the run
with exit 64.

**Pending states.** A screen that is not built yet is a state with `"pending": true` and a
`"reason"`. It is not captured; `fidelity.json` lists it under `pending` and `fidelity.md` under
"Estados pendientes" as not verified, and it never counts towards the score. A pending state
without a reason is rejected. Use this field instead of ad-hoc keys such as `$pendingStates`
(keys starting with `$` are ignored and never reach the report).

## 3. Element map

`elements` maps one name to a prototype selector and an implementation selector, plus:

- `properties`: what to measure. Without it, the default set: colour, background, top border colour
  and width, top-left radius, font family, size, weight, line-height, letter-spacing,
  feature settings, the four paddings, width, height, box-shadow, opacity. Measuring
  `font-family` also measures `rendered-font` (the platform font Chromium actually used).
  Motion: add `transition-duration`, `transition-timing-function`, `animation-duration`,
  `animation-timing-function`. Position: `x`, `y` (page coordinates; one shift moves everything
  below, so use them sparingly).
- `tokens`: property → design-system token (`"--accent"`), so the correction names the token, not a
  raw value. Add `tokensCss` (path to the `tokens.css`, relative to the config) and the token's
  declared value is resolved for the theme of each pair (base `:root`, then
  `[data-theme="dark"]`, `.dark` or `prefers-color-scheme: dark` overrides; `var()` aliases are
  followed; `rem` counts as 16 px). Every measurement and finding that names a token then carries
  `tokenValue` and `vsToken`: how far the prototype and how far the implementation are from the
  token (ΔE2000 for colours, px for lengths), with the same tolerances. That tells apart "the
  implementation drifted from the token" from "the prototype never used the token". Colour tokens
  written as `oklch()`, `hsl()` and the like are reported as not comparable (use hex or `rgb()`),
  and a token missing from the file gives a warning. Without `tokensCss` the tokens are only
  labels.
- `level: "component"`: size properties of this element count as component findings (B), not layout (C).
- `priority`: force a priority for every finding of this element.

The first visible match of each selector is measured. Map the elements that carry the design: page
title, primary and secondary buttons, inputs, table header and cell, chip/badge, card, navigation
item, chart axis label, chart mark, dialog. Grow the map whenever the pixel diff shows an area no
measured property explains (the report warns about it).

## 4. Tolerances (defaults, configurable)

| Measure | Default | Note |
|---|---|---|
| Colour | ΔE2000 ≤ 2 and alpha ± 0.02 | ≈ 1 is the commonly cited limit of perception; 2–10 is visible at a glance (rule of thumb, see tool-selection.md) |
| Sizes, spacing, radii, borders, line-height | ± 1 px | |
| Font size | exact | |
| Font weight | exact | |
| Font family, rendered font, feature settings, other strings | equal | |
| Durations | exact (ms) | |
| Pixel diff | ≤ 2 % of the unmasked pixels; pixelmatch threshold 0.1 | Reported apart from the score |

**Score** = properties within tolerance ÷ properties measured, per state × viewport × theme and
overall. A missing element counts all of its properties as failed.

**Priority of a finding**: A tokens (colour, typography, radius, shadow), B components (padding,
border widths, missing elements, sizes of `level: component` elements), C layout (width, height,
position, margin, gap, display, flex/grid), D details (everything else, motion included).

## 5. Capture paths

1. **Automated** (default): `node capture-states.mjs --config fidelity.config.json`. Needs
   `playwright-core` with the Clock API (introduced in 1.45 per its release notes; tested with
   1.64.1) and a Chromium-family binary: `CHROME_PATH`, `~/.cache/hyperframes/chrome/**/chrome-headless-shell`,
   `~/.cache/ms-playwright/**/chrome`, `google-chrome`, `chromium`, then standard install paths.
   Both sides always run in the same browser instance; the report warns if versions differ.
   `--help` prints every option; a wrong argument prints one line and exits 64 (`--debug` adds the stack).
2. **Saved session**: `auth.method: "storageState"`; the user runs `--save-auth` and logs in.
   Without a terminal (an agent runs the command) add `--wait-for <css-selector>`, or set
   `implementation.auth.readySelector`: the session is saved by itself as soon as that selector is
   visible, so pick one that only exists once logged in (the app shell, the user menu). The
   Enter prompt is used only on a terminal when no selector is given; without a terminal and
   without a selector the command stops with exit 64. The wait ends after 600 s by default
   (`--timeout <seconds>` or `auth.timeoutSeconds`) and saves nothing when it times out.
3. **Manual, user's own browser**: `auth.method: "manual"`. Capture the prototype with
   `--side prototype`. The only browser step is the `--print-snippet <stateId>` expression: for each
   implementation state × viewport × theme the user puts their tab in that state, viewport and
   theme, then you run the expression (Claude in Chrome `javascript_tool`, or DevTools MCP
   `evaluate_script` wrapped as `() => <expression>`) and save the returned JSON as
   `captures/implementation/<state>__<viewport>__<theme>.json`. No resize, screenshot or other
   browser call: the snippet records the window size and pixel ratio, and `compare.mjs` warns when
   they differ from the prototype's. Without a PNG, `compare.mjs` compares styles only and says so.

Then `node compare.mjs --config fidelity.config.json`.

## 6. Cycle

1. Measure (capture + compare) → `fidelity.md`, `fidelity.json`.
2. Triage with vision: look only at the side-by-side images of the states the comparison flagged
   under the threshold, downscaled to at most 1000 px wide (JPEG); add semantic findings (wrong
   chart type, missing state, wrong copy) as human-readable rows under "Hallazgos". Vision never
   changes a number.
   A data chart is also triaged against its `data-viz` spec: same chart type, same scales, and its «Ficha del gráfico» still next to it.
3. Classify each finding: defect, technical constraint or improvement (`references/decisions.md`).
4. The implementer fixes defects. The agent proposes the exact change: token, property, value.
5. Re-measure only the failing states into a new `outDir`: `capture-states.mjs --only <stateId>`, then
   `compare.mjs --only <stateId> --previous <old>/fidelity.json` (a comma list or a repeated `--only`
   takes several). The report warns that it is partial and lists resolved, still open, new and not
   re-measured findings, and the score before and after.
6. Repeat until the failing states meet the agreed threshold, or each remaining deviation has a
   logged decision.
7. Final confirmation: one measurement of all states (no `--only`; `--previous` the last full
   measurement), numerical; look at images only where it flags.

Never write "faithful" or close the cycle without the final all-states re-measurement taken after the last fix.
Keep every measurement folder: the deltas are the audit trail.
