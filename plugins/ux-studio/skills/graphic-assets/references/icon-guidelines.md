# Icon guidelines

Read this only when the deliverable is an icon set. The spec format is `assets/icons.spec.example.json`;
`icon-set.mjs --check` enforces the rules marked *(checked)*.

## 1. Grid and live area

- Default grid 24×24 px (`grid`). Every point stays inside it *(checked: error)*; curves and arcs are
  sampled, so a bulging arc fails too.
- Padding 2 px (`padding`, default grid/12) leaves a 20×20 **live area**. Geometry outside the live area
  warns *(checked: warning)*: use it only for a deliberate overshoot.
- The stroke extends half its width beyond the geometry: a 2 px stroke on a line at x = 21 reaches 22.
- Draw at 1× on whole pixels. With an even stroke width (2 px) put lines on whole coordinates; with an
  odd width (1 px, 3 px) on half coordinates (x.5), so edges fall on the pixel grid and stay crisp.

## 2. Keylines

Keyline shapes give icons of different silhouettes the same visual weight on the 24 px grid:

| Keyline | Size | For |
| --- | --- | --- |
| Circle | Ø 20 | round icons (clock, user, info) |
| Square | 18×18 | square icons (calendar, inbox) |
| Portrait rectangle | 16×20 | tall icons (file, phone) |
| Landscape rectangle | 20×16 | wide icons (card, image, mail) |

Scale the table with the grid for other sizes (a 32 px grid multiplies by 4/3).

## 3. Stroke, corners and gaps

- One stroke width, one line cap and one line join for the whole set (`stroke`) *(checked: per-shape
  overrides are errors)*. Default 2 px, round caps, round joins.
- One corner radius for rectangles (`cornerRadius`, default 2 px); a shape may set its own `rx` only
  for a deliberate pill or sharp corner.
- Keep at least one stroke width of empty space between parallel strokes, or they merge at 1×.
- Fill (`"fill": true`) only small details such as a dot; a set is either outline or filled, not mixed.
- Colour is never in the spec: icons draw with `currentColor` and take the `colorToken` *(checked:
  hardcoded colours are errors)*.

## 4. Optical balance

- Circles and triangles look smaller than squares of the same box: that is why the circle keyline (Ø 20)
  is larger than the square (18).
- Pointed shapes (arrows, play, chevrons) overshoot the keyline slightly so their tips do not look short.
- Asymmetric shapes look off-centre when centred on their box: shift a play triangle about 1 px right,
  centre arrows on their visual mass.
- Dense icons (many details) look heavier: simplify before shrinking the stroke.
- Judge at 1× (16, 20 and 24 px) on light and dark surfaces, not only enlarged. `preview.html` shows 4×
  over the pixel grid with the live area dashed, plus 2× and 1×, in every theme of `tokens.css`.

## 5. Naming

- kebab-case, unique *(checked)*: `arrow-left`, `alert-circle`, `user-plus`.
- Name what the icon depicts, not one meaning: `trash`, not `delete-order`; put meanings in `keywords`.
- Variants as suffixes: `-filled`, `-off`, `-small`; no sizes or colours in names.
- `title` is the accessible name used when the icon carries meaning ("Close", "Next").
- Symbols in the sprite get `prefix` + name (`icon-close`) so they cannot clash with other page ids.

## 6. Accessibility

- **Decorative** (next to visible text that says the same): hide it.
  `<svg aria-hidden="true" focusable="false"><use href="icons.svg#icon-close"/></svg>`
- **Meaningful inside a control** (an icon-only button): name the control, hide the icon.
  `<button aria-label="Close"><svg aria-hidden="true" focusable="false">…</svg></button>`
- **Meaningful on its own** (a status icon with no text): `role="img"` and a `<title>` as the first
  child, referenced by `aria-labelledby` for the widest support. Put the `<title>` in the referencing
  `<svg>`, not inside the `<symbol>`: titles inside symbols are not reliably announced.
  `<svg role="img" aria-labelledby="t1"><title id="t1">Overdue</title><use href="icons.svg#icon-alert-circle"/></svg>`
- A meaningful icon needs **3:1** contrast against its background (non-text contrast); never convey
  meaning by colour alone.
- Icon buttons need a target of at least 24×24 px, 44×44 px on touch screens.

## 7. Review checklist

- [ ] `icon-set.mjs --check` passes with no warnings, or each warning is a deliberate overshoot.
- [ ] Every icon sits on its keyline and matches the others in weight at 1×.
- [ ] Names are descriptive kebab-case; every meaningful icon has a `title`.
- [ ] `preview.html` reviewed in every theme; 1× rendering crisp.
- [ ] No third-party trademark or logo in the set.
