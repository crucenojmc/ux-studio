# Accessibility variant («Accesibilidad»)

Read on demand, only when the request or the brief's module plan asks for an accessibility audit. The audit is
**automatic and partial**: it finds defects a script can decide and lists what needs a person. It never claims
WCAG conformance; every report carries «verificación automática parcial». Target: WCAG 2.2 level AA.

## Run

```bash
node "${CLAUDE_SKILL_DIR}/assets/a11y-audit.mjs" --url <url> [--url <url2>] [--storage-state role=auth.json] \
  [--platform web|phone|both] [--scope <css>] --out <dir>
node "${CLAUDE_SKILL_DIR}/assets/a11y-audit.mjs" --showcase <url> [--role <id>] [--screen <id>] --platform web --out <dir>
```

- `--out` is given by the caller and unique per invocation; the script writes only `<out>/a11y.json` and
  `<out>/a11y.md`. Default `tmp/ux-audit/`. Two invocations never share an output dir.
- Inputs come from the caller's task envelope (see `presentation-brief/references/task-envelope.md`): objective,
  URLs or showcase, platform and roles, output dir. `BRIEF.md` is optional; without it, ask the caller for the platform.
- Viewports follow the platform: web 1440×900, phone 390×844 (touch). A showcase must declare the platform in
  `LAYOUT.platforms`; otherwise the script prints the page's reason in one line and stops.
- `--showcase` audits every screen for each role that may see it, inside the app frame (`--scope` overrides).
- Needs `playwright-core` and an installed Chromium-family browser (exit 2 otherwise: run `ux-studio:ux-env-setup`).
  Usage errors exit 64. Local or test environments only, never production; it loads only the given pages.
- If `axe-core` resolves like `playwright-core`, its violations are merged and labelled `axe` (`--no-axe` skips it);
  otherwise the report says «axe no disponible» and continues with the native checks.

## Criteria covered (native checks)

| Rule | WCAG | How it is decided |
|---|---|---|
| `contrast-text` | 1.4.3 | Computed colour vs effective background (transparent layers resolved up the tree, element opacity applied). 4.5:1 normal text, 3:1 large (≥24 px, or ≥18.66 px bold). Disabled controls skipped. Background images, gradients and colour formats Chrome returns as authored (`oklch()`, `lab()`) cannot be measured: reported as human review. |
| `contrast-ui` | 1.4.11 | Border or fill of inputs, selects, textareas and outline-only buttons vs the adjacent background, 3:1. Filled buttons are identified by fill and label; a boundary drawn by a box-shadow goes to human review. |
| `kbd-unreachable` | 2.1.1 | Visible interactive controls that a real Tab walk never reaches custom controls without `tabindex`. Native controls with `tabindex="-1"` go to human review (may be intentional); roving-tabindex widgets and radios are skipped. |
| `kbd-trap` | 2.1.2 | Tab does not leave an element, or the focus cycles without reaching the rest of the page. |
| `kbd-focus-invisible` | 2.4.7 | Computed outline, box-shadow and border before and after focus show no visible change; a change of background only goes to human review. |
| `button-name`, `link-name`, `input-label`, `img-alt` | 4.1.2, 2.4.4, 1.3.1, 1.1.1 | Simplified accessible-name computation: `aria-labelledby`, `aria-label`, `<label>`, `alt`, `<title>` in SVG, text content, `title`. Icon-only buttons are called out. |
| `html-lang` | 3.1.1 | `lang` on `<html>`. |
| `heading-order` | 1.3.1 | A heading level that jumps more than one down. |
| `duplicate-id` | 4.1.2 | Repeated ids (they break ARIA references). |
| `aria-invalid-role`, `aria-invalid-attr`, `aria-ref-missing`, `aria-required-attr`, `aria-hidden-focusable` | 4.1.2 | A small subset: unknown role or `aria-*` attribute, references to missing ids, required state for checkbox/switch/radio/slider/scrollbar, focusable content inside `aria-hidden`. |
| `target-size` | 2.5.8 | Interactive targets under 24×24 CSS px whose 24 px circle touches another target. Inline links in text are exempt. |
| `reduced-motion` | 2.2.2, 2.3.3 | Animations still running with `prefers-reduced-motion: reduce`; `reduced-motion-transition` flags transitions kept (minor). |

Severity: `serious` blocks a task for some users, `moderate` degrades it, `minor` is polish. Each finding carries the
criterion, selector, evidence (measured value and threshold) and, for a showcase, the screen and role.

## What needs a human

Never mark these as verified; list them as pending in the report (`needsHuman` in the JSON):

- Screen-reader experience (NVDA, JAWS, VoiceOver, TalkBack): reading order, announcements of dynamic changes, name quality.
- Cognitive load and clear language: number of steps, vocabulary, error messages (3.3.x, 3.1.5).
- Captions, transcripts and audio description quality (1.2.x) when the page has video or audio.
- Meaning conveyed only by colour or shape (1.4.1), meaningful focus order (2.4.3), zoom to 200 % and 400 % and reflow (1.4.4, 1.4.10).
- Anything that only a real device or real assistive technology can validate.

## How findings feed the questionnaire

Findings are facts; they do not need a question. A question (topic `accessibility`, rerun `a11y-audit`) exists
only for a decision or a gap:

- A fix that changes the design (colour that fails contrast and belongs to the brand, a tiny target that the layout needs).
- A check only a person can do (assistive-technology session, caption review): ask who runs it and when.
- Unknown semantics (what an icon-only control does, what a field means): never invent a name; ask.

Options are closed, the recommended one first. Unanswered, a design change stays pending and the finding stays open.

## Return to the caller

Compact: a three-line summary (screens and viewports audited, findings by severity, axe on or off), the P1 findings
with criterion and selector, the paths of `a11y.md`, `report.md` and `questionnaire.json`, and the first questionnaire
round. Never paste the whole report.
