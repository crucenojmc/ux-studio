# Showcase blueprint

The showcase is one self-contained HTML fragment. It always **is** the prototype: a fully navigable app rendered in the device frames the brief chose (a desktop browser frame, a phone frame or both). How much it **explains** around the app is the presentation format the brief chose; nothing outside that choice is rendered.

`assets/showcase-template.html` implements everything below with a fictional field-maintenance app. Build a new showcase by setting `LAYOUT`, replacing the demo app and keeping the shell.

## Format: `LAYOUT`

The first block of the script. Copy `mode` and `sections` from the BRIEF section "Formato de la presentación" and `platforms` and `roles` from "Alcance del diseño"; without either section, build nothing and return questionnaire items (never assume `ux-system`, a platform or a role scope). A reference page is an example of format, not the format, unless the BRIEF asks to replicate it.

```js
const LAYOUT = { mode: 'tour', sections: ['definiciones', 'inventario'], platforms: ['web', 'phone'], roles: 'all', webMinWidth: 1440 };
```

| `mode` | Brief option | What the page is |
|---|---|---|
| `app` | Solo la app simulada | The app alone, filling the viewport under a thin strip with the demo-data label and a role selector (only with two or more roles). The viewport picks the frame: desktop when there is one and the window is wider than 860 px, phone otherwise. |
| `tour` | App con recorridos guiados | Compact header (brand, title, controls), stage with index and frames, Flujos with the player, then the chosen sections and the footer. |
| `ux-system` | Sistema UX completo | The complete UX system: hero with title, lede and controls, stage with the navigable mockups, Flujos, the chosen sections, the Anexo and the footer. |

`sections` lists the chosen sections in display order: `definiciones`, `principios`, `sistema`, `inventario`. It is empty in `app`. Sections not listed leave the DOM.

`platforms` lists the device frames that exist:

| `platforms` | Brief option | Frames |
|---|---|---|
| `['web']` | Web | Desktop browser frame only. The phone frame leaves the DOM, the Vista control is hidden and only `?capture=web` exists. |
| `['phone']` | Mobile | Phone frame only. The web frame leaves the DOM, the Vista control is hidden and only `?capture=phone` exists. |
| `['web', 'phone']` | Web y mobile | Both frames and the Vista control (Ambas, Web, Teléfono). |

`roles` sets which roles the page shows:

| `roles` | Brief option | Roles shown |
|---|---|---|
| `'single'` | Un solo rol | Exactly one role in `ROLES`; no role selector. |
| `'all'` | Varios roles, diseño completo para cada uno | Every role, the Rol selector and the locks that name who can open a screen. |
| `{ focus: '<roleId>' }` | Varios roles, uno en foco | Only that role: the screens and sheets it can open and the flows it walks alone. No role selector, no locks. Other roles, their screens and the cross-role flows leave the page and `window.SHOWCASE`. |

`webMinWidth` is not a brief decision: it is the logical width of the desktop canvas, taken from the product's code (its widest desktop breakpoint; 1080 in the template). See `adapting.md`.

An unknown mode or section, sections in `app`, `platforms` other than the three lists above, `roles` other than the three values above, `'single'` with more than one role in `ROLES`, a focus role that is not in `ROLES`, or a `webMinWidth` under 820 replaces the page with the reason and throws at load (the preview's console shows it). So does `?capture=` for a platform that `platforms` does not declare.

## Page anatomy (top to bottom)

| Block | What it holds | `app` | `tour` | `ux-system` |
|---|---|---|---|---|
| Role strip | Demo-data label and a role `<select>` (only with two or more roles shown). | Keep | — | — |
| Hero | Brand mark, serif display title with one italic accent word, lede of 60 words or fewer, segmented controls Rol (only with two or more roles shown) / Vista (Ambas, Web, Teléfono; only with both platforms) / Tema (Oscuro, Claro) / Movimiento (Completo, Reducido). Choices persist in `localStorage` inside try/catch. | — | Brand, title and controls; replace copy | Replace copy; keep controls |
| Stage | Sticky screen index grouped by module (icon, `aria-current`, lock naming a role that can see the screen, sheets indented under their parent), the declared frames: desktop browser frame (dots + URL pill tracking the route) and phone frame, captions `Pantalla · Rol`, ambient glow tinted by module. | Frames only | Keep | Keep |
| Flujos | One card per persona plus cross-role flows; numbered steps, each a button that jumps to that state; a `Reproducir` button. | — | Replace `FLOWS` | Replace `FLOWS` |
| Definiciones y decisiones | Business terms and decisions, each with its state (`Abierta` / `Decidida`), date and, for decisions, owner. | — | If chosen: replace `DEFINITIONS`, `DECISIONS` | If chosen: same |
| Principios | 6 to 8 items, "rule" + "why". | — | If chosen: replace `PRINCIPLES` | If chosen: same |
| Sistema | Live color swatches (value read with `getComputedStyle`, so it follows the theme) with token name, value and usage; type specimens; motion demos with replay buttons; spacing and radius scale. | — | If chosen: edit usage notes | If chosen: same |
| Inventario | Table generated from the registry: módulo, pantalla, quién la ve, para qué sirve, qué cambia. | — | If chosen: generated | If chosen: generated |
| Anexo | Collapsed `<details>` with method and data notes. Methodology never leads the page. | — | — | Replace copy |
| Footer | "Datos de demostración: las cifras no son mediciones." (translate with the brief). | In the strip | Keep | Keep |

The design system can exist only so the prototype looks like the product: its tokens are always used, and showing them is the «Sistema» section, rendered only when the brief chooses it.

Responsive rules: at 1099 px or less, Ambas shows the phone only; at 860 px or less the index becomes a popover button ("Pantallas"); at 600 px or less the phone goes full-bleed (no bezel). No horizontal page scroll at 390 px, 16 px gutters.

## Architecture

- **Same DOM, no iframes.** Each frame contains an `.app` element. `render()` builds one HTML string from the current screen and writes it into every mounted frame.
- **Container queries switch layout.** `.app` is `container: app / inline-size`. `@container app (min-width: 820px)` turns on the desktop layout (sidebar, toolbar, side drawers, tables). Below that the same markup is a phone app (top bar, bottom tab bar, bottom sheets, list rows). Content that differs by layout is rendered twice and hidden per container (for example a `<table>` and a `<ul>`); the capture API always picks the first visible match.
- **The desktop frame is scaled, not reflowed.** The web canvas renders at `LAYOUT.webMinWidth` logical px or wider (1080 in the template; the product's widest desktop breakpoint, see `adapting.md`) and is scaled with `transform: scale()` to fit, so the desktop layout always shows. The phone canvas is 390 × 844 logical px scaled by `--pk`.
- **One store.** `store = { role, stack, ui, sheet, data }`.
  - `role`: current role id. Switching role resets the stack to that role's `home`.
  - `stack`: `[{screen}]`; push screens add an entry, tabs and roots replace it.
  - `ui`: view state (selected record, filters, search, form drafts, confirmations, toast). `UI_DEFAULTS` holds the initial values; `open()` resets to them.
  - `sheet`: open sheet id or `null`.
  - `data`: a deep copy of `DATA`; real interactions mutate it (closing an order, approving a purchase).
- **Render pipeline.** `render()` captures focus and scroll, builds the HTML inside `try/catch` (an error draws a note in the frame instead of breaking the page), writes every frame, restores focus and selection, syncs the hash, dispatches the synchronous `showcase:render` event (the chrome listens: index, URL pill, captions, glow), then `settle()` waits for `document.fonts.ready` and two frames and fires `showcase:rendered`.
- **Motion only when something changed.** `navFx` (`tab`, `push`, `pop`), `sheetFx` and `toastFx` are set by navigation and consumed by the next render as `data-enter*` attributes. `.st` elements with `--i` stagger in (capped at 8). A plain re-render never re-animates.
- **Navigation.** `goTo(to)` opens any `{screen, role?, sheet?, set?}` and switches to a role that can see both screen and sheet when the current one cannot. `goScreen()`, `back()`, `openSheet()` and `closeSheet()` serve in-app interactions.
- **Interaction attributes inside the app** (delegated, no inline handlers):
  - `data-go="<screenId>" data-arg="<recordId>"` navigates.
  - `data-act="<action>" data-arg="<value>"` runs `act(name, arg)`.
  - `data-model="draft.desc"` binds an input, textarea or select to a path in `store.ui`.
  These attributes double as stable `target` selectors for flows.
- **IDs are not allowed inside the app** (the DOM exists twice). Label fields by wrapping them in `<label>`.

## Data shapes

```js
ROLES = [{ id, label, user, initials, home, tone, blurb, access /* derived from the registry */ }]

screen(id, {
  title, group, access: [roleIds], kind: 'tab' | 'root' | 'push',
  parent /* push only */, icon, path /* '/ordenes/:order' */, desc, changes,
  render(ctx) { return { title, crumb, body }; },   // ctx = { role, ui, data }
});

sheet(id, { title, group, parent, access, icon, path, desc, changes,
  render(ctx) { return { title, sub, body, foot }; } });

FLOWS = [{ id, role, title, lede,
  steps: [{ label, to: { screen, role, sheet, set }, target, say }] }];

PRINCIPLES = [['rule', 'why'], ...];

DEFINITIONS = [{ term, meaning, status: 'open' | 'decided', date: 'YYYY-MM-DD' }];
DECISIONS = [{ title, detail, status: 'open' | 'decided', date: 'YYYY-MM-DD', owner? }];
```

- `DEFINITIONS` and `DECISIONS` come from the BRIEF (glossary, decisions, pending items) and the answered questionnaires, never invented. An open item says what is missing in `meaning` or `detail`; `date` is the day it was raised or decided.

- `kind: 'tab'` appears in the sidebar and the phone tab bar; `'root'` is reachable but not a tab (settings); `'push'` stacks on its `parent` with a back button.
- `path` drives the URL pill; `:param` is filled from `store.ui`.
- `changes` feeds the inventory column "Qué cambia según el rol". Make each screen genuinely differ by role and say how.
- Flow `role` is the card persona; in a cross-role flow every step names its own `to.role`.
- A step's `target` is the element the user acts on **in that state** to reach the next step. It must exist in both frames. The last step usually has no target.
- `set` is merged into the `ui` defaults (plain objects merge one level deep), so a step can show a half-filled form or an expanded detail without real clicks.
- Demo data: one `DATA` object, realistic and mutually coherent. Derive every total from its parts (KPIs from records, category totals from line items) and format with the brief's locale (`es-AR`: `1.234,5`, `$ 84.300`). Freeze "now" to a fixed date and time so captures are reproducible.

## Replacing the demo app (keep the shell)

1. Set `LAYOUT` from the BRIEF (`mode`, `sections`, `platforms`, `roles`) and from the product's code (`webMinWidth`). Paste the project's `tokens.css` between `TOKENS:START` and `TOKENS:END` (see `tokens-contract.md`). Keep the motion block.
2. Rewrite the hero: brand, title (one italic accent word), lede (`ux-system` only), `<title>` of 2 to 4 words.
3. Replace `ROLES`, `ME` (the persona of the first role if it matters), `CHECKLIST`-style constants, `DATA`, `UI_DEFAULTS`, `STATUS`/`PRIO`-style vocabularies and `GROUP_TONE`.
4. Replace the `screen()` and `sheet()` calls and their render functions. Reuse the `.a-*` component classes (cards, KPIs, chips, list rows, table, sheet fields, options, switches) before adding new CSS; delete the classes your app does not use.
5. Update `act()` with your actions and `sideHTML()`/`topHTML()` if the app chrome differs (brand, primary action).
6. Replace `FLOWS` and the data of the chosen sections only: `PRINCIPLES`; `DEFINITIONS` and `DECISIONS`; the Sistema usage notes (`SWATCHES`, `TYPE`, `DEMOS`). In `ux-system`, the Anexo copy. Leave the data of unchosen sections as it is: it is never rendered.
7. Translate `UI_TEXT` only if the brief's language is neither `es` nor `en`; set `lang` on the host page or preview (`--lang=`).
8. Do not touch: `render()`, `settle()`, `goTo()`, `applyLayout()`, the role scope (block 5b), the player, `targetRect()`, capture mode CSS, `window.SHOWCASE`.

## Checklist before delivery

- [ ] `LAYOUT` matches the BRIEF's "Formato de la presentación" and "Alcance del diseño"; no section, frame or role that was not chosen is on the page.
- [ ] Fragment only: no doctype, `<html>`, `<head>`, `<body>`; `<title>` of 2 to 4 words; explicit `body` background and color.
- [ ] Every registry screen and sheet is in the index; locks name a role that can see them.
- [ ] With both platforms, both frames show the same screen; desktop layout in the web frame, phone layout in the phone frame.
- [ ] Every flow step opens; every `target` resolves in every declared frame; in `tour` and `ux-system`, "Reproducir" plays and a click inside a frame pauses it.
- [ ] Theme toggle changes the computed `--surface-page`; text contrast 4.5:1 or more in both themes.
- [ ] No horizontal scroll at 390 px; touch targets 44 px or more; hover styles only under `(hover: hover)`.
- [ ] Reduced motion (control and OS) removes cursor travel and transform motion.
- [ ] Zero console errors at 1440 and 390 px, dark and light. Screenshots taken.
- [ ] Demo data labelled as demo; numbers coherent across screens; no real client names.
- [ ] Size well under 16 MB (the template is under 225 KB); no external images.

## Self-check snippet

Run in the page console (any browser tool) after loading the preview in a viewport 1100 px wide or more, so every declared frame is visible. It opens every flow step and reports targets that do not resolve in the frames on the page. In `app` mode with both platforms only one frame shows: run it at 1440 px (web) and again at 390 px (phone), and read only the problems of the frame on screen.

```js
(async () => {
  const S = window.SHOWCASE, problems = [];
  const frames = ['web', 'phone'].filter((fr) => document.querySelector(`[data-frame="${fr}"]`));
  for (const f of S.flows()) for (const [i, s] of f.steps.entries()) {
    await S.open(s.to, { view: 'both' });
    if (!s.target) continue;
    for (const fr of frames) if (!S.targetRect(s.target, fr)) problems.push(`${f.id}#${i + 1} ${fr}: ${s.target}`);
  }
  const listed = [...document.querySelectorAll('[data-index-item]')].length;
  console.log({ screens: S.screens().length, flows: S.flows().length, listed, problems });
})();
```
