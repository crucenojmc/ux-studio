---
id: html-email
title: Email HTML
source: claude-design
medium: html
fallback: none
agent: ux-designer
skills: [ux-content, design-system-builder, implement-ui]
---
## When

Use when the user wants an email: transactional (confirmation, notice, password reset), marketing or newsletter, welcome or onboarding. Signals: «email», «correo», «newsletter», «plantilla de correo», «mailing».

Not for:
- a social post, flyer or poster → `print-piece`
- a long written report or document → `document`
- app screens → `ui-mockups`

## Expect

- **Obtienes:** un correo HTML de 600 px hecho con tablas y estilos en línea, con modo oscuro, preencabezado y un botón que funciona también en Outlook, listo para tu plataforma de envío.
- **No incluye:** el envío, las listas de contactos ni la programación en la plataforma; para una pieza para redes o para imprimir, `print-piece`.
- **Ideal si:** necesitas un correo que se lea bien en Gmail, Outlook y Apple Mail, en el teléfono y en el escritorio.

## Questions

1. ¿Qué tipo de correo es?
   - Transaccional, como una confirmación o un aviso (Recomendado)
   - Marketing o newsletter
   - Bienvenida o incorporación
2. ¿Dónde termina el correo?
   - Como archivo HTML para la plataforma de envío (Recomendado)
   - Dentro del repositorio del producto, como plantilla
3. ¿Con qué marca?
   - La del sistema de diseño por defecto (Recomendado)
   - Otra marca, con su logo aprobado

Infer instead of asking:
- Subject, preheader and the call to action from the objective.
- The merge-field syntax from the sending platform when the envelope names it; otherwise `{{campo}}`, labelled as an assumption.
- Language and tone from the envelope's `language` (default neutral Spanish).

## Medium

- Type: a plain **HTML artifact** built from `${CLAUDE_PLUGIN_ROOT}/skills/ux-recipes/assets/starters/html-email.html`, published only as the review preview; the deliverable is the `.html` file in the output dir. No artifact type is needed, so there is no type check.
- Product repository route (answer «Dentro del repositorio»): the agent becomes `ui-developer` with `implement-ui`, which turns the file into a template in the repository's own mail mechanism after consent.
- Fallback: none. No Artifact tool → return the file path and title.

## Structure

- A 600 px container table; every layout table with `role="presentation"`; all styles inline.
- One `<style>` block holding only media queries: mobile (`max-width`) and dark mode.
- A hidden preheader of 40 to 90 characters; one primary call to action as a bulletproof button (VML for Outlook, a padded link elsewhere); a footer with why the person gets the email and a preferences link.
- Images: absolute `https` URLs hosted by the sending platform, with `width`, `height` and `alt`; no SVG and no data URIs in the final file; system font stack.
- The token map comment at the top: each token with its light and dark hex, mirrored in the dark-mode block.

## Steps

1. Check the envelope: objective, kind of email, destination. A missing one → return the Questions above as `<outputDir>/questionnaire.json` and stop.
2. `ux-content`: subject (50 characters or fewer), preheader, headline, body, button label and footer.
3. `design-system-builder` (reuse path): read the system's `tokens.json` and take the hex values; inline them, never as custom properties.
4. Copy `${CLAUDE_PLUGIN_ROOT}/skills/ux-recipes/assets/starters/html-email.html` to the output dir and compose the email per Structure.
5. Product repository route only: return an envelope for `ui-developer` with `implement-ui` and `consent: pending`; it returns its plan (files and branch) and edits only after the user's OK.
6. Run Checks, publish the preview artifact, and return.

## Checks

- No `<script>`, no external CSS, no `var(--…)`; the `<style>` block holds only media queries.
- Every table has `role="presentation"`; the container is 600 px; every `<img>` has `alt`.
- At 390 px no horizontal scroll; in dark mode every text keeps 4.5:1 contrast.
- Links are absolute `https`; one primary button; the preheader is present and hidden.
- Rendering in real clients (Outlook, Gmail, Apple Mail) cannot be verified here: list it as pending.

## Return

Compact, per the caller's task envelope (`skills/presentation-brief/references/task-envelope.md`), within its `returnBudget`:
- Summary: kind, subject, preheader, merge fields, and each decision with its source.
- The preview URL and the `.html` path in the output dir.
- Verification: `<command>: <result>`, one line each.
- Questions: the questionnaire path and its first round (up to 4).
- Open items: client rendering tests, image hosting, and the `ui-developer` envelope when it goes into a repository.
