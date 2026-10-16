# Tokens contract (core design tokens)

The showcase, its prototype app and `ux-studio:design-system-builder` share these CSS custom property names so a design system drops in without touching any other rule.

## Contract (verbatim)

Colors: `--surface-page --surface-raised --surface-overlay --surface-sunken --text-primary --text-secondary --text-tertiary --border-subtle --border-strong --accent --accent-hover --on-accent --focus-ring --status-ok --status-ok-bg --status-warn --status-warn-bg --status-danger --status-danger-bg --status-info --status-info-bg --series-1 … --series-5`. Spacing `--space-1 … --space-8` (4,8,12,16,24,32,48,64px). Radius `--radius-sm --radius-md --radius-lg --radius-pill`. Shadow `--shadow-raised --shadow-overlay`. Type `--font-sans --font-display --font-mono` and per style `--text-<display|title|heading|body|label|caption>-size/-line/-weight`. Motion (not part of tokens.json): `--duration-fast 120ms --duration-base 200ms --duration-slow 320ms --ease-out cubic-bezier(.22,1,.36,1) --ease-in-out cubic-bezier(.65,0,.35,1) --ease-sheet cubic-bezier(.32,.72,0,1)`. Dark/light: default theme on `:root`, other under `[data-theme="dark"]` (or light) AND `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {…} }`. The template ships with its own default values; the skill tells the agent to replace that block with the generated `tokens.css` from `design-system-builder` when a design system exists.

## Swapping in a design system

1. Open the showcase file and find the block between `/* TOKENS:START` and `/* TOKENS:END`.
2. Replace the whole block with the contents of the project's `tokens.css`. Keep the motion block that follows it (motion tokens are not in `tokens.json`); if `tokens.css` already defines them, delete the duplicates from the template, not from `tokens.css`.
3. If `tokens.css` loads fonts with `@import`, move that URL to a Google Fonts `<link rel="stylesheet">` at the top of the fragment; other font hosts are not allowed in artifacts.
4. Reload the preview and check the Sistema section: every swatch must show a value in both themes. An empty value means the design system is missing a contract token; report it instead of inventing one.
5. Re-check text contrast (4.5:1) for `--text-secondary` and `--text-tertiary` on every surface, `--on-accent` on `--accent`, and each `--status-*` on its `--status-*-bg`.

## Theme switching in the showcase

- The **Tema** control writes `data-theme="dark"` or `data-theme="light"` on `<html>`; with no choice the OS preference applies through the media query.
- Shell-only values (glass, bezel, grid lines) are derived from the core tokens with `color-mix()`, so they follow any design system.
- Never hard-code colors in screens: use the tokens, or `color-mix()` over them for tints.
