# Implementation checklist

Run it on every screen or component before the commit. Each item is checked in code or with the
project's tools; what needs a real device stays pending in the note.

## Responsive

- Viewports from the envelope's design scope: Web → 1440 × 900, Mobile → 390 × 844, Web y mobile →
  both. Breakpoints are the project's (Tailwind screens, SCSS mixins, Flutter `LayoutBuilder`),
  never new ones.
- No horizontal scroll at the smallest width in scope; content reflows down to 320 CSS px wide.
- Touch targets at least 44 × 44 px on phone layouts (24 × 24 is the WCAG 2.5.8 floor).
- Long text, many items, no items: lists and tables keep their layout (use `break-ui` if present).
- Inputs on phones use the right `type` / `inputmode` / keyboard type and a font size that does not
  zoom the page.

## Accessibility basics

- Native semantics first: `button`, `a`, `label`, `table`, headings in order, one `main`.
- Every control has an accessible name (visible label, `aria-label` only when no text fits).
- Keyboard: every action reachable with Tab / Shift+Tab / Enter / Space / Escape; focus order
  follows the visual order; focus is visible (`--focus-ring`); dialogs and sheets trap focus and
  return it on close.
- Contrast from the tokens: 4.5:1 for text, 3:1 for large text, icons and borders that carry
  meaning. Never color alone for a status: add text or an icon.
- Images: meaningful `alt`, decorative `alt=""`. Icon-only buttons get a name.
- Async results and validation errors are announced (`aria-live="polite"`, `aria-describedby` on
  the field); in Flutter, `Semantics` and `liveRegion`.
- Angular Material, Ionic or another component library: use its accessible inputs and dialogs, never
  rebuild them with `div`s.

## States

Every view that loads data has all of these, built from the prototype or the design system:

| State | Shows | Notes |
|---|---|---|
| Loading | Skeleton or spinner in place; layout does not jump | `aria-busy="true"` on the region; no spinner for < 300 ms |
| Empty | A short message and the next useful action | Copy from the prototype or brief; missing → question |
| Error | What failed, in business language, and a retry | Keep the user's input; never a raw error or stack trace |
| Partial / offline | What is stale and since when | Only when the project supports it |
| Disabled / read-only | Why it is disabled when it is not obvious | Role-dependent actions follow the design scope's roles |

## Motion

- Every animation has a purpose (orientation, feedback, continuity); otherwise none.
- Durations and easings from tokens (`--duration-*`, `--ease-*`). Animate `transform` and `opacity`;
  never `width`, `height`, `top` or `left` for movement.
- `prefers-reduced-motion: reduce` removes non-essential motion:

  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
  ```

  Use the project's existing rule when it has one. Angular animations: bind `[@.disabled]` to the
  media query. Flutter: `MediaQuery.of(context).disableAnimations`.
- Interruptible: a second tap or Escape mid-animation leaves a consistent state.

## Before the commit

- No literal value that has a token (see `token-mapping.md`).
- No `console.log`, commented-out code or unused imports; the project's lint and format pass on the
  touched files.
- Copy and labels in the brief's language; no invented business text.
