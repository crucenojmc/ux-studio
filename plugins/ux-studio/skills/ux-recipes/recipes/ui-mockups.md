---
id: ui-mockups
title: Mockups de interfaz (web o mobile)
source: claude-design
medium: design
fallback: html
agent: ux-designer
skills: [design-system-builder, ux-content]
---
## When

Use when the user wants high-fidelity static screens: how a screen looks when finished, on the web or on a phone. Covers the Claude Design templates «UI mockups» and «Mobile app design»; the platform question picks between them. Signals: «mockup», «pantalla final», «alta fidelidad», «diseño de la app», «cómo se vería», «diseño mobile».

Not for:
- clicking through screens or trying a flow → `app-prototype`
- grey boxes to agree on structure first → `wireframe`
- several visual directions of one screen to choose from → `variants`
- a new look for an existing product screen → `redesign`
- specs, tokens and measurements for developers → `dev-handoff`

## Expect

- **Obtienes:** pantallas en alta fidelidad sobre un lienzo de Design, una por mesa de trabajo, con el sistema de diseño por defecto y textos reales.
- **No incluye:** navegación ni interacción entre pantallas; para navegar flujos, `app-prototype`.
- **Ideal si:** necesitas ver y aprobar cómo se verá una pantalla terminada antes de construirla.

## Questions

1. ¿Para qué plataforma son las pantallas?
   - Web de escritorio (Recomendado)
   - Mobile (teléfono)
   - Web y mobile
2. ¿Qué pantallas incluye?
   - Las de un flujo principal, de 3 a 6 (Recomendado)
   - Una sola pantalla
   - Una lista de pantallas que entregarás
3. ¿Con qué sistema de diseño?
   - El sistema de diseño por defecto de la cuenta (Recomendado)
   - Otro sistema de diseño ya publicado
   - Uno nuevo a partir de la marca

Infer instead of asking:
- Platform from the envelope's `scope.platforms` or the wording («app», «celular», «teléfono» → mobile; «panel», «escritorio» → web).
- The screens from the requirements, the BRIEF or the product's routes.
- Roles and states from the BRIEF's design scope; default: the main role, filled state.
- Language and tone from the envelope's `language` (default neutral Spanish).

## Medium

- Type: **Design**, a canvas of artboards.
- Run-time check: Artifact `action: "list", scope: "types"` (the list varies per account). A Design row → publish with its `type_url` and a `title`; the result carries the design systems: build with the default one unless the answer named another.
- Fallback: no Design row → one plain HTML artifact with every screen as a fixed frame (390×844 mobile, 1440×900 web) on a neutral canvas, styled only with the design system's `tokens.css`. No Artifact tool → write that HTML in the output dir and return its path and title.

## Structure

- One artboard per screen and platform, named `NN · Nombre de la pantalla`, in flow order; mobile 390×844, web 1440×900.
- The design system's components and tokens only: no raw colours, no ad hoc type sizes.
- Real copy for titles, labels, buttons and messages; demo data labelled as such.
- Light theme first; a second row in dark theme when the design system has one and the scope asks for it.
- A short note beside each artboard (purpose, main action), never on top of the interface.

## Steps

1. Check the envelope: objective, platform, screens. A missing one → return the Questions above as `<outputDir>/questionnaire.json` and stop.
2. Medium check (see Medium). With the Design type, use the default design system the publish result names. For the HTML fallback, `design-system-builder` (reuse path) turns that system's `tokens.json` into `tokens.css`; no system at all → template tokens, said once.
3. `ux-content`: write the copy for every screen and state in scope (labels, empty, error and confirmation messages) before drawing.
4. Draw the artboards per Structure. Optional when listed in the session: `frontend-design` or `ui-ux-pro-max` for quick directions; deliver one.
5. Run Checks, publish or update the artifact, and return.

## Checks

- Every screen in scope has its artboard at the platform's frame size, in flow order.
- Tokens only; text contrast 4.5:1 (3:1 from 24 px) in every theme shown.
- One primary action per screen; touch targets of 44 px or more on mobile.
- Copy in the envelope's language, no voseo, no invented business rules: ask instead.
- HTML fallback: zero console errors and no horizontal scroll at 390 px.

## Return

Compact, per the caller's task envelope (`skills/presentation-brief/references/task-envelope.md`), within its `returnBudget`:
- Summary: platform, screens, design system, and each decision with its source.
- The artifact URL, or the HTML path and title to publish.
- Verification: `<command>: <result>`, one line each.
- Questions: the questionnaire path and its first round (up to 4).
- Open items, and the next recipe when it fits (`app-prototype` to navigate the screens, `dev-handoff` to build them).
