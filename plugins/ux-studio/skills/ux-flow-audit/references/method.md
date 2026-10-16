# UX flow audit: method

Seven checks, run on whatever exists: a brief or requirements (paper), a prototype (`window.SHOWCASE`), or a
running app. Every check produces findings with evidence, and every gap produces a question
(`references/questionnaire.md`). Formulas and thresholds live in `references/metrics.md`.

## 1. Task inventory

Goal: know which tasks each role performs, how often, how critical they are, and the path they take today.
Fill `assets/task-inventory-template.md`.

| Field | How to get it |
|---|---|
| Role | Brief, requirements, permission matrix. One row per role and task, for the roles in scope (BRIEF "Alcance del diseño": every role, or only the role in focus). |
| Task | A user goal in business words ("Registrar una recepción"), not a screen name. |
| Frequency | `count` per `hour`/`day`/`week`/`month`, per person. |
| Source of frequency | `medido` (route logs, analytics, DB event counts), `entrevista`, `brief`, or `pendiente`. |
| Criticality | `alta`: blocks operation, money, safety or legal duty. `media`: delays work. `baja`: convenience. Confirm with the business. |
| Volume | Records per execution (lines, items, readings). Drives keyboard paths and bulk actions. |
| Current / proposed path | Ordered steps from the role's home, as `flow-cost.mjs` steps. |

Source priority: measured data > interviews > brief or requirements > nothing. Measured sources: route or page
view logs per role, analytics events, rows created per user per day in the database. Reading a table or column
requires knowing what it means: never infer the meaning of a field, a status value or an acronym. Ask.

Never invent a frequency or a volume. Unknown → `frequency: null` in the tool input (the tool flags
`unknown-frequency` and leaves the weekly cost empty) and a `frequency` question with ranges as options.

## 2. Placement rules

Place each task by frequency and criticality (tiers in `metrics.md`):

- Frequent or critical tasks: reachable from the role's home in **at most one interaction**, and their trigger
  is **visible without scrolling** on the smallest key viewport. NN/g eyetracking found about 57% of
  page-viewing time above the fold and 74% within the first two screenfuls (Fessenden 2018).
- Weekly tasks: at most two interactions. Monthly or administrative tasks may live deeper (settings, menus),
  but more than three interactions is always a finding: deep hierarchies hide content and need shortcuts
  (Whitenton 2013).
- **Fitts's law**: movement time grows with distance and shrinks with target size, T = a + b·log₂(2D/W).
  Make frequent targets large, put the action where the task ends (Submit next to the last field), keep
  contextual menus near their trigger, and order menus by frequency. Screen edges help mouse users, not touch
  (Budiu 2022).
- **Keyboard paths** for heavy data entry: logical Tab order, Enter to submit, no mouse needed between fields,
  and optional accelerators for frequent actions shown next to the command; they must never be the only way
  (Krause & Harley 2024; heuristic 7). Model a scanner or autofocus field as `type` with `focus: "none"`.
- **Context persistence**: the selected site, period, filters and sort survive navigation and return visits.
  Re-selecting context on every screen is redundant input (section 4).
- Complex apps: flexible paths (skip ahead, go back), staged disclosure of advanced options, secondary
  information without leaving the screen (Kaplan 2020).

## 3. Flow cost (Keystroke-Level Model)

Estimate expert, error-free execution time per task and compare current vs proposed. KLM by Card, Moran and
Newell (CACM 23(7), 1980; *The Psychology of Human-Computer Interaction*, 1983). Operator values as reported
by Kieras (1993) and the Wikipedia summary of the original tables:

| Operator | Meaning | Default (s) | Notes |
|---|---|--:|---|
| K | key press | 0.28 | average non-secretarial typist, 40 wpm. Skilled 55 wpm: 0.20; expert 90 wpm: 0.12; unfamiliar with keyboard: 1.2. |
| P | point with the mouse | 1.1 | 0.8–1.5 depending on distance and size (Fitts). |
| B | mouse button press or release | 0.1 | a click is BB = 0.2. |
| H | home hands between mouse and keyboard | 0.4 | |
| M | routine mental preparation | 1.35 | Card, Moran & Newell; Kieras recommends 1.2 after Olson & Olson (1989). |
| W | waiting for the system | measured | never guess: measure it or ask. |

Use `assets/flow-cost.mjs` (step expansion in its header and in `metrics.md`). Conventions after Kieras:
apply the same M rules to every design ("consistency is more important than absolute accuracy"); pointing is
preceded by an M to locate the target; values typed are obtained in an M. If the decision depends on novices
(who verify every step), model a novice variant with an extra `wait` of one M after each screen change and check
that the conclusion holds for both.

Counts per task: steps, clicks, typed characters, fields, context switches (screen changes), waits. Weekly cost
= time × executions per week; impact for prioritization = weekly seconds lost × people doing it.

## 4. Redundant input

Look for each pattern in every task path; the tool flags the first four from the step data.

| Pattern | Tool flag | Typical fix |
|---|---|---|
| Same datum entered twice in one task | `repeated-in-task` | carry it forward, prefill |
| Same datum entered in several tasks of a role (often context) | `repeated-across-tasks` | persist context, defaults |
| Datum derivable from context (date, user, site, totals) | `derivable` | compute it, show it read-only |
| Datum the system already has (master data, last value) | `known-by-system` | default to it, let the user override |
| Confirmation that protects nothing irreversible | `confirmation` | remove, or replace with undo |
| Free text where a closed list exists | (manual) | select, autocomplete |
| Manual totals or counts | (manual) | compute |

WCAG 2.2 SC 3.3.7 Redundant Entry (Level A): information previously entered or provided in the same process
must be auto-populated or available to select, except when re-entry is essential, required for security, or
the earlier value is no longer valid (W3C). Defaults should carry the most common value, chosen from user needs,
not alphabetical order (Nielsen 2005). Keep forms short: drop fields that can be derived or collected later
(Whitenton 2016). Whether a re-entry is an intended control is a business rule: ask, never assume.

## 5. Reachability

Build a navigation graph per role (nodes: screens, sheets, states; edges: links, buttons, menu items) and check
it against the feature list.

- Feature list sources: requirements and user stories, router configuration or sitemap, backend endpoints (an
  endpoint without a UI caller is a feature reachable only by API: ask if it should be), permission matrix.
  Write `features.json`: `[{id, name, roles, match: {screen | url | text}}]`.
- Prototype: `nav-graph.mjs --showcase <url>` reads the SHOWCASE registry and the links rendered inside the app
  frame. Real app: `nav-graph.mjs --crawl <url> --storage-state role=auth.json --routes routes.json` (one storage
  state per role; never type credentials; ask the parent for an authorized test account).
- Findings: unreachable feature; orphan screen (exists, nothing links to it); reachable only by URL; dead end (no
  navigational exit); depth > 3; role-locked feature (a role that needs it cannot reach it while another can);
  flow step without a UI link (the prototype tour teleports); broken links.
- Crawl safety: the crawler never clicks submit, destructive, committing or session-ending controls and aborts
  every non-GET request; review `skipped` to see what was not explored and audit those paths by hand.

## 6. Screen space

Measure the first screen of each key screen at the viewports of the BRIEF's platform at minimum (Web 1440×900, Mobile 390×844, Web y mobile both), plus the client's real devices
(ask for them: model, resolution, browser zoom, OS scaling). Use `space-audit.mjs` with selectors for header,
sidebar, content and primary action. Read together:

- content vs chrome vs empty share of the viewport; primary action above the fold and scroll needed;
- whitespace and text density inside the content: expert B2B users benefit from density, since it reduces
  navigation and raises the chance of seeing what they need, but overload overwhelms (Nielsen 2011). Judge
  density against the task, not against consumer layouts;
- tables: columns that are almost always empty, width used, horizontal overflow; first column a readable
  identifier, columns by importance, frozen headers, batch actions (Laubheimer 2022);
- horizontal page overflow on phones;
- empty states: open each key screen with no data (prototype `set` state or an empty account) and check it
  explains why it is empty and offers the next action.

## 7. Heuristics

Nielsen's 10 usability heuristics (1994, reviewed 2024). Record each as pass, finding or not applicable, always
with evidence (screen, step, tool output). Probes for operations apps:

| # | Heuristic | Probe |
|---|---|---|
| 1 | Visibility of system status | sync, save and queue states visible; long waits show progress |
| 2 | Match between system and real world | business vocabulary, units and formats of the client |
| 3 | User control and freedom | undo, cancel, back without losing data |
| 4 | Consistency and standards | same action, same place and label across screens |
| 5 | Error prevention | closed lists, validation before submit, defaults |
| 6 | Recognition rather than recall | context and last values visible, no codes to memorize |
| 7 | Flexibility and efficiency of use | keyboard paths, accelerators, bulk actions |
| 8 | Aesthetic and minimalist design | nothing competes with the primary task |
| 9 | Help users recognize, diagnose, and recover from errors | specific messages, input preserved |
| 10 | Help and documentation | contextual help where tasks are rare |

### Navigation markup

The audits and the capture scripts read navigation from the markup, so a prototype must keep it:

- Screens: `data-go="<screenId>"`, with an optional `data-arg="<recordId>"` for the record (`data-go="orden" data-arg="OT-4821"`).
- Sheets: `data-act="sheet" data-arg="<sheetId>"`.
- Every other `data-act` value (filter, toggle, approve, ...) is an in-screen action and is not navigation.

Any custom prototype must keep this markup, otherwise the reachability audit reports its screens as reachable only by URL and the videos cannot find the flow targets.

## Sources (opened while writing this skill)

- Card, Moran & Newell, KLM operators and citation, via Wikipedia "Keystroke-level model": https://en.wikipedia.org/wiki/Keystroke-level_model
- Kieras, D. (1993). *Using the Keystroke-Level Model to Estimate Execution Times*. University of Michigan: https://www.cs.umd.edu/~golbeck/INST631/KSM.pdf
- Nielsen, J. (1994, reviewed 2024). 10 Usability Heuristics for User Interface Design. NN/g: https://www.nngroup.com/articles/ten-usability-heuristics/
- Budiu, R. (2022). Fitts's Law and Its Applications in UX. NN/g: https://www.nngroup.com/articles/fitts-law/
- W3C. Understanding SC 3.3.7 Redundant Entry (WCAG 2.2): https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html
- Whitenton, K. (2016). Website Forms Usability: Top 10 Recommendations. NN/g: https://www.nngroup.com/articles/web-form-design/
- Nielsen, J. (2005). The Power of Defaults. NN/g: https://www.nngroup.com/articles/the-power-of-defaults/
- Laubheimer, P. (2022). Data Tables: Four Major User Tasks. NN/g: https://www.nngroup.com/articles/data-tables/
- Kaplan, K. (2020). 8 Design Guidelines for Complex Applications. NN/g: https://www.nngroup.com/articles/complex-application-design/
- Fessenden, T. (2018). Scrolling and Attention. NN/g: https://www.nngroup.com/articles/scrolling-and-attention/
- Whitenton, K. (2013). Flat vs. Deep Website Hierarchies. NN/g: https://www.nngroup.com/articles/flat-vs-deep-hierarchy/
- Nielsen, J. (2011). Utilize Available Screen Space. NN/g: https://www.nngroup.com/articles/utilize-available-screen-space/
- Krause, R. & Harley, A. (2024). Accelerators Maximize Efficiency in User Interfaces. NN/g: https://www.nngroup.com/articles/ui-accelerators/
