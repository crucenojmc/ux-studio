# UX Studio core tokens — the contract

Every design system this skill builds MUST produce these tokens. `prototype-showcase`'s template
uses exactly these CSS names. Brand-specific extra tokens are allowed on top.

## Required tokens

| Family | Names |
| --- | --- |
| `color` | `surface-page` `surface-raised` `surface-overlay` `surface-sunken` `text-primary` `text-secondary` `text-tertiary` `border-subtle` `border-strong` `accent` `accent-hover` `on-accent` `focus-ring` `status-ok` `status-ok-bg` `status-warn` `status-warn-bg` `status-danger` `status-danger-bg` `status-info` `status-info-bg` `series-1` `series-2` `series-3` `series-4` `series-5` |
| `spacing` | `space-1` … `space-8` (default 4, 8, 12, 16, 24, 32, 48, 64 px) |
| `radius` | `radius-sm` `radius-md` `radius-lg` `radius-pill` |
| `shadow` (optional family) | `shadow-raised` `shadow-overlay` |
| `type.families` keys | `sans` (required), `display`, `mono` |
| `type` text styles | `display` `title` `heading` `body` `label` `caption` |

## tokens.json shape (what the Design System page reads)

- Every family except `type` is `{"tokens":[{"name","value","usage"}]}` — a LIST. Never a DTCG / W3C
  name→value map: the page cannot read maps.
- `color` also has `"themes":[{"id":"light","name":"Light"},{"id":"dark","name":"Dark"}]`, primary
  theme FIRST. Values are `{"light":"#…","dark":"#…"}` or a plain string (= every theme). A theme
  missing from a value inherits the first theme's.
- Names match `[A-Za-z0-9][A-Za-z0-9_.-]{0,63}` and are unique across all families but `type`.
  Keep names as written in the source; when one name appears in two families (a radius and a
  shadow both called `home-tip`) prefix each with its family (`radius-home-tip`, `shadow-home-tip`).
- Color values: hex, `rgb()`, `rgba()`, `hsl()`, `hsla()`, `oklab()`, `oklch()` with plain numeric
  arguments, or an alias `"{other-token}"` of an existing color token. Named colors, `var()` and
  `color-mix()` are dropped.
- `type` = `{"fonts":[{"family","file","weight"}], "families":{"sans":"…"}, "groups":[{"name","family","styles":[{"name","fontSize","lineHeight","fontWeight"}]}]}`.
  Hosted Google fonts go only in `families` (no `fonts[]` entry, no file).
- `shadow` values are box-shadow strings, plain or per theme like colors.
- Motion is NOT a supported family (see CSS mapping).
- Optional top-level `name` (the system's name) and `version`.

## CSS mapping (implemented by `assets/tokens-to-css.mjs`)

- Each token → `--<name>`.
- `color-scheme: light` and `color-scheme: dark` are declared in the matching theme blocks (the
  default block, `[data-theme="dark"]` and the `prefers-color-scheme` block), so form controls,
  scrollbars and the page canvas follow the theme. Themes with any other id get none.
- The FIRST theme's values on `:root` (emitted as `:root, [data-theme="<first>"]` so a nested
  scope can switch back); every other theme under `[data-theme="<id>"]`.
- When themes are exactly light + dark, the non-default one is also emitted under
  `@media (prefers-color-scheme: <it>) { :root:not([data-theme="<default>"]) {…} }`.
- Plain string values apply to all themes. Aliases `{name}` → `var(--name)`, re-declared in every
  theme block so nested theme scopes resolve them.
- Type families → `--font-sans`, `--font-display`, `--font-mono`.
- Text styles → `--text-<style>-size`, `--text-<style>-line`, `--text-<style>-weight`.
- Shadow, radius and spacing tokens → `--<name>`; numbers become px.
- `type.fonts[]` entries with a `file` → `@font-face` with `src: url("<file>")` relative to
  `tokens.css` (copy `fonts/` beside it).
- Motion defaults, documented in the README "Motion" section:
  `--duration-fast:120ms; --duration-base:200ms; --duration-slow:320ms;`
  `--ease-out:cubic-bezier(.22,1,.36,1); --ease-in-out:cubic-bezier(.65,0,.35,1); --ease-sheet:cubic-bezier(.32,.72,0,1)`.
  Override with `--motion <file.json>` holding `{"--duration-fast":"…", …}`; listed keys replace
  defaults, new `--` keys are added.
- Opt-in `--style-classes`: also one class per text style (`.body {font-family: var(--font-sans);
  font-size: var(--text-body-size); …}`), matching how the Design System page exposes type to
  component previews. Use it for local preview sheets only; prototypes use the `--text-*` vars.

## The check

```bash
node ${CLAUDE_SKILL_DIR}/assets/tokens-to-css.mjs <tokens.json> --check
node ${CLAUDE_SKILL_DIR}/assets/tokens-to-css.mjs <tokens.json> --out tokens.css [--motion motion.json]
```

`--check` fails (exit 1, one `error:` line each) on: a family that is not a list (DTCG map), a
missing required token, an invalid name, a name used twice (the message names both families and the prefixed names to use), a color value outside the allowed
syntax, a broken or cyclic alias, a motion family, an invalid length or font stack, and
`text-primary` / `text-secondary` under 4.5:1 on `surface-page` in ANY theme.

It warns (exit 0) on: missing `usage` notes, a single theme, and contrast under target for
`text-*` on `surface-raised` (4.5), `text-tertiary` on `surface-page` (3), `on-accent` on `accent`
(4.5), each `status-*` on its `status-*-bg` (4.5), `border-strong` and `focus-ring` on
`surface-page` (3), and `series-1..5` on `surface-page` (3). Treat warnings as defects to fix or to
justify in the README; keep a source's failing pair only with its note.

Exit codes: 0 ok · 1 invalid tokens or failed check · 2 usage or file error.

Contrast of any pair, for audit evidence:

```bash
node --input-type=module -e "import {parseColor, contrastRatio} from '${CLAUDE_SKILL_DIR}/assets/tokens-to-css.mjs'; console.log(contrastRatio(parseColor('#52606d'), parseColor('#f7f3ea')).toFixed(2))"
```
