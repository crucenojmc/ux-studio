# Path: from code (a repo that already has styles)

Real styles beat screenshots: the repo is the source of truth for color, type, spacing, radius and
shadow. This path needs only read access to a local checkout. It never needs GitHub, a remote
or a published artifact; publishing is a separate, later step (`design-system-artifact.md`).

Read-only on the repo: never edit product code, never add files to it. Work and write under
`<dir>` (see SKILL.md, Output folder).

## 1. Find the sources

Search the checkout (not `node_modules`, `dist`, `build`, `.next`, vendored code) for, in this order:

| Source | Where | Gives |
| --- | --- | --- |
| CSS custom properties | `:root`, `[data-theme="…"]`, `.dark`, `@media (prefers-color-scheme: dark)` in `*.css` | Colors, spacing, radius, shadow, type, per theme |
| Tailwind v4 | `@theme { --color-… }` in the main CSS | Same, with Tailwind's prefixes (`--color-`, `--radius-`, `--shadow-`, `--font-`, `--text-`) |
| Tailwind v3 | `tailwind.config.{js,ts,cjs,mjs}`: `theme` and `theme.extend` (`colors`, `spacing`, `borderRadius`, `boxShadow`, `fontFamily`, `fontSize`) | Values by name; `darkMode` says how dark is switched |
| SCSS / Less | `$variables`, maps (`$colors: (…)`), mixins in `_variables`, `_tokens`, `_theme` files | Values by name; resolve nested references by hand |
| JS/TS themes | `theme.ts`, `tokens.ts`, MUI/Chakra/Mantine theme objects, `design-tokens/*.json` | Values by name, sometimes per mode |
| Fonts | `@font-face`, `<link>` to Google Fonts, `next/font`, `font-family` on `body` | Families, weights, files |

Record each source path. Components (`*.tsx`, `*.vue`) only confirm which tokens are really used:
if a value appears in components but in no token file, it is a hard-coded value; list it as a
finding, do not promote it silently.

## 2. Inventory before naming

Make one table: source token, resolved value, theme, where it is used. Resolve `var()` chains,
SCSS references and `theme()` calls to literals. Merge duplicates (same value under several names
becomes one token plus aliases, only when the code already treats them as the same role).
Normalize values to the contract (`tokens-contract.md`):

- Colors: hex, `rgb()`, `hsl()`, `oklab()` or `oklch()`. Named colors, `var()` and `color-mix()` are
  not allowed: compute the literal.
- Lengths: px or rem numbers. Shadows: a plain box-shadow string.
- Dark mode: one `{"light": …, "dark": …}` value per token. A token with no dark value in the code
  keeps its light value in dark only if the code really does that; otherwise note the gap.

## 3. Map to the contract

The contract requires a fixed set of names (`surface-page`, `text-primary`, `accent`,
`status-*`, `series-1..5`, `space-1..8`, `radius-sm|md|lg|pill`, and the six text styles). For each
required name pick the repo token that plays that role, by usage and not by color. When the repo
has no equivalent, do not invent a brand decision: derive it from neighbours (a hover is a
step of the accent) and mark it in the README as derived, or ask the user, one question at a time.

Keep the repo's own extra tokens as additional tokens: they are allowed on top of the contract.

## 4. Naming and uniqueness

- Use the names as written in the code (kebab-case, no spaces, no `/`, at most 64 characters from
  `A-Z a-z 0-9 _ . -`). Strip only the framework prefix that carries no meaning (`--color-`,
  `--tw-`).
- **Names are unique across every family but `type`.** A name that exists in two families
  (`home-tip` as a radius and as a shadow) clashes. Keep the written name when it is unique and,
  on a collision, prefix each side with its family: `radius-home-tip`, `shadow-home-tip`. Do the
  same for a name that equals a required one (`accent` as both a color and a spacing step).
- Never rename to "improve" a name that does not collide: others grep for it.
- `usage` on every token: one sentence saying where it goes. Cite the source file in the README's
  sources section, not in `usage`.

## 5. Write and check

1. `<dir>/project/tokens.json` in the shape of `assets/tokens.sample.json` (lists of
   `{name, value, usage}`, never a name to value map).
2. `node ${CLAUDE_SKILL_DIR}/assets/tokens-to-css.mjs <dir>/project/tokens.json --check` until it
   exits 0. A name used twice reports both families and the prefixed names to use; a contrast
   failure means the code itself fails the contract: report it, do not hide it.
3. `README.md` from `assets/readme-template.md`: sources, derived tokens, gaps (hard-coded
   values, missing dark values), contrast findings.

Output: the tree under `<dir>/project/`, the inventory table, assumptions and open questions.
Publishing it as an artifact is optional and handled by `design-system-artifact.md`; without it, the
tree is already the deliverable. React component libraries: mention `/design-sync` for
components; this path covers tokens and styles.
