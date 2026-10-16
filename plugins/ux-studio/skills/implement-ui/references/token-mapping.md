# Token mapping: `tokens.css` → the project's mechanism

`design-system-builder` emits `tokens.css`: every token as a CSS custom property, the first theme on
`:root, [data-theme="<first>"]`, other themes under `[data-theme="<id>"]` (and a
`prefers-color-scheme` block when the themes are light and dark). Names follow its contract:
`--surface-*`, `--text-*`, `--border-*`, `--accent*`, `--on-accent`, `--focus-ring`, `--status-*`,
`--series-1..5`, `--space-1..8`, `--radius-*`, `--shadow-*`, `--font-sans|display|mono`,
`--text-<style>-size|line|weight`, `--duration-*`, `--ease-*`.

## Rules

- Never hardcode a value that has a token: no literal hex, px spacing, radius, shadow, font or
  duration where a token exists. Check the touched files: `rg -n '#[0-9a-fA-F]{3,8}\b|\b\d+px\b' <files>`.
- The project's existing theme comes first. When it already names a value (a Tailwind color, a SCSS
  variable, a Material palette), map the token onto that name; never add a parallel name for the same
  value.
- A design value with no token and no project equivalent is a question for the design system owner
  (add a token, or use the nearest existing one); never invent a token.
- `tokens.css` is regenerated, never edited. Copy it where the project keeps global styles, with the
  file name its convention uses, and load it once (global stylesheet or `angular.json` / bundler
  entry). That copy is a planned file of the consent.
- A value that differs between `tokens.css` and the project's theme is a question; the answer goes
  to the decision log through the caller.

## CSS custom properties (plain CSS, CSS modules, any framework)

Load `tokens.css` globally and use `var(--token)` in components:

```css
.card {
  background: var(--surface-raised);
  color: var(--text-primary);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-raised);
}
```

Themes follow `data-theme` on `<html>` (or the scope element). If the project switches themes with a
class (`.dark`), set `data-theme` in the same place the switcher sets the class; never copy the
theme block by hand.

## Tailwind 3 (`tailwind.config.*`)

Extend, never replace, the default scale in an existing project:

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        surface: { page: 'var(--surface-page)', raised: 'var(--surface-raised)' },
        accent: { DEFAULT: 'var(--accent)', hover: 'var(--accent-hover)' },
        'on-accent': 'var(--on-accent)',
      },
      spacing: { 'space-1': 'var(--space-1)', 'space-4': 'var(--space-4)' },
      borderRadius: { md: 'var(--radius-md)' },
      fontFamily: { sans: 'var(--font-sans)' },
      transitionDuration: { base: 'var(--duration-base)' },
    },
  },
};
```

- Opacity modifiers (`bg-accent/50`) need channel variables (`rgb(var(--x) / <alpha-value>)`); with
  hex tokens they do not apply. Avoid them on token colors, or propose channel tokens.
- Overriding an existing key (`md`, `sans`) changes every class that uses it: list those usages in
  the plan or pick a new key.

## Tailwind 4 (`@import "tailwindcss"`, no config file)

Declare theme variables that point at the tokens with `@theme inline`, so utilities resolve the
token at runtime:

```css
@import "tailwindcss";
@import "./tokens.css";

@theme inline {
  --color-surface-page: var(--surface-page);
  --color-accent: var(--accent);
  --color-on-accent: var(--on-accent);
  --spacing-space-4: var(--space-4);
}
```

- Tokens whose names already sit in a Tailwind namespace (`--radius-sm|md|lg`, `--font-sans|mono`)
  need no line: `tokens.css` is unlayered, so it overrides Tailwind's layered defaults and
  `rounded-md` or `font-sans` already resolve to the token. Never redeclare a token as itself
  (`--radius-md: var(--radius-md)` is a cycle).
- A token with no utility uses the variable shorthand: `shadow-(--shadow-raised)`.

## SCSS

- Runtime theming (recommended): SCSS variables point at the custom properties, so themes keep
  working: `$accent: var(--accent);`, `$space-4: var(--space-4);`.
- SCSS color functions (`darken()`, `rgba($accent, .5)`, `color.adjust`) need static values and fail
  on `var()`. Replace them with a token (`--accent-hover`) or `color-mix()` where the browsers in
  scope support it; otherwise it is a question.
- Angular Material / Fuse palettes are built from static colors (`mat.define-palette`, theme maps):
  mapping tokens there changes every Material component. It needs its own plan line and consent;
  component-level styles use `var(--token)` meanwhile.

## Flutter

No CSS: translate the values once into the theme, never per widget.

- Colors → `ColorScheme` / `ThemeData` (`Color(0xFF1F5F5B)` from `#1f5f5b`); one `ThemeData` per
  theme (`theme`, `darkTheme`).
- Tokens without a Material slot (`status-*`, `series-*`, spacing, radius) → a `ThemeExtension`
  or the constants class the project already uses.
- Type styles → `TextTheme`; durations and curves → constants next to the theme.
- Values come from the design system's `tokens.json` and land in the project's existing theme file.

## Motion and type

- `--duration-*` and `--ease-*` drive every transition; reduced motion turns them off (see
  `checklist.md`).
- `--text-<style>-size|line|weight` and `--font-*` set type; never a literal font size where a text
  style exists.
