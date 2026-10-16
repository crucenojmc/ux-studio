# Adapting the format to the product

The shell is fixed; the presentation format (`LAYOUT.mode`: app only, app with guided tours, the complete UX system, and `LAYOUT.sections`) and the design scope (`LAYOUT.platforms`, `LAYOUT.roles`) come from the BRIEF; what fills them depends on the product's shape and on the audience. Decide the shape first, then confirm it with the user in one question when it is not obvious.

## 1. Multi-role app (the template's case)

- With `LAYOUT.roles: 'all'`, roles become the **Rol** control; each screen declares `access`.
- With `LAYOUT.roles: { focus: '<roleId>' }`, only that role remains: write its flows with care, since cross-role flows that involve another role are dropped, and every other role's screens leave the page.
- One flow per role, written as that persona's real goal ("Cerrar una urgencia en el lugar", not "Usar la pantalla de órdenes").
- Add at least one **cross-role** flow when a record travels between roles (request, approval, follow-up). Every step names its `to.role`.
- Screens that look the same for every role are a smell: show what changes (scope of records, extra columns, actions) and write it in `changes`.

## 2. Single dashboard with filters

There is one main screen; the story is in the questions it answers.

- Roles may collapse to one (`LAYOUT.roles: 'single'` with one entry in `ROLES`), or become **personas with different questions** (plant manager, analyst, controller). Keep several roles only if access or default filters differ.
- **Flows are business questions walked step by step.** Each step changes one filter or opens one detail, and the `say` line states what the person learns. Example for a production dashboard:
  1. "¿Dónde se perdió producción ayer?": choose the site → `set: { site: 'norte' }`.
  2. Choose the period → `set: { site: 'norte', period: 'ayer' }`.
  3. Open the section with the largest gap → `set: { ..., section: 'envasado' }`.
  4. Open the detail of the stop that explains it → `sheet: 'detalle-parada'`.
- Model filters in `store.ui` so every step is a reproducible state; registry screens can be "views" of the same dashboard (overview, section, detail) with `kind: 'push'` for drill-downs.
- The brief usually chooses «Web» (`LAYOUT.platforms: ['web']`); «Web y mobile» only when the dashboard has a real mobile layout.

## 3. Mobile-only app

- The brief chooses «Mobile» (`LAYOUT.platforms: ['phone']`): the web frame leaves the DOM, the Vista control is hidden and only `?capture=phone` exists. «Web y mobile» only when a web companion exists.
- Flows lean on thumb reach, offline states, notifications and interruptions (a call, losing signal). Show those states as steps.
- If the target hardware is specific (a rugged handheld, a small screen), change the phone canvas size in CSS (`390px` / `844px` and `--pk`) and say which device it emulates. Anything only the real device can validate (scanner, printer, camera) is listed as not verified.

## 4. Desktop-only back office

- The brief chooses «Web» (`LAYOUT.platforms: ['web']`): the phone frame leaves the DOM and only `?capture=web` exists. «Web y mobile» only when the brief asks how it behaves on small screens.
- Flows are long tasks broken into states: search → select → edit → review → confirm.
- Tables are first-class; keep columns that fit at `LAYOUT.webMinWidth` logical px and move secondary data to the detail.

## Desktop canvas width

The web frame renders the app at `LAYOUT.webMinWidth` logical px or wider and scales it to the frame. Set it from the product's code: its widest desktop breakpoint. An app that changes layout at lg 1280 and xl 1440 needs `1440`; otherwise the frame shows a layout the product never shows at that size. Keep `1080` only when the product has no breakpoint above it.

## Side drawers and bottom sheets on phones

The template's `sheet()` opens as a side drawer in the desktop layout and as a bottom sheet in the phone layout. That is the demo app's pattern, not a rule. Copy the product's own:

- The product uses a side drawer on phones (navigation menu, filters, a detail panel): keep the side drawer in the phone layout. Override the sheet's phone styles so it enters from the same edge, covers the width the product gives it and dims the rest.
- Use a bottom sheet on phones only when the product does.
- Unknown pattern and no code to read: questionnaire item, never a guess.

## Audience (from BRIEF.md)

Which format and which sections each audience gets is decided in the brief ("Ronda de formato de la presentación" in `presentation-brief/references/module-plan.md`); never add a section here. Inside the chosen format, the audience sets the emphasis:

| Audience | Emphasis |
|---|---|
| Executives / sponsors | Fewer, shorter flows (3 to 5 steps) with strong `say` lines; principles, when chosen, stated as outcomes. |
| Functional owner | Flows that walk the business rules; «Definiciones y decisiones» with every open item and who decides it. |
| Product / design review | Full flows, principles with tradeoffs, cross-role flows, inventory with "qué cambia". |
| Development handoff | Inventory complete (every state); when Sistema is chosen, every token in use; in `ux-system`, the Anexo lists data assumptions and what is out of scope. |
| End users / training | Flows named as tasks, slower default speed, narration in plain words, reduced jargon. |

## Language and brand

- Content follows the brief's language; set `lang` so the shell chrome (`UI_TEXT`) matches. Add a `UI_TEXT` entry if the language is neither `es` nor `en`.
- Brand comes from the design system: `tokens.css` plus the logo as inline SVG. Do not hotlink logos or images.
- The demo vocabulary (states, priorities) must match the client's real vocabulary when known; if a term is unknown, ask instead of inventing one.
