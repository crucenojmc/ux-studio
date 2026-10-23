---
id: print-piece
title: Pieza gráfica (flyer, afiche, redes)
source: claude-design
medium: design
fallback: html
agent: ux-designer
skills: [graphic-assets]
---
## When

Use when the user wants a single graphic piece to publish or print: a social post, a story, a banner, a flyer, a poster, a one-pager, an invitation. Signals: «flyer», «afiche», «póster», «post para redes», «historia», «banner», «volante», «para imprimir».

Not for:
- an email → `html-email`
- several slides presented in sequence → `deck`
- a long document or report → `document`
- choosing the palette and fonts themselves → `color-type-pairing`

## Expect

- **Obtienes:** la pieza en los formatos pedidos (redes, A4, A5 o Carta) con el sistema de diseño, y sus PNG exportados en las medidas y densidades indicadas.
- **No incluye:** archivos de imprenta con sangrado, marcas de corte ni CMYK; para varias láminas que se presentan en secuencia, `deck`.
- **Ideal si:** necesitas una pieza gráfica con la identidad de la marca para publicar o imprimir.

## Questions

1. ¿Para qué es la pieza?
   - Redes sociales (Recomendado)
   - Impresión: afiche o volante
   - Redes e impresión
2. ¿Qué formatos?
   - Los estándar del uso elegido (Recomendado)
   - Una lista de medidas que entregarás
3. ¿Qué material visual lleva?
   - Una ilustración hecha con formas y los colores del sistema (Recomendado)
   - Fotos o logos aprobados que entregarás
   - Solo texto y color

Infer instead of asking:
- The copy from the objective; the brand from the default design system.
- Social sizes from the `graphic-assets` presets (`--list-presets`); print sizes from the note in Structure.
- Language and tone from the envelope's `language` (default neutral Spanish).

## Medium

- Type: **Design**, one artboard per format.
- Run-time check: Artifact `action: "list", scope: "types"`. A Design row → publish with its `type_url` and a `title`; build with the default design system the result names.
- Fallback: no Design row, or the caller needs PNG files the artifact cannot export → the `graphic-assets` HTML route (one HTML piece exported with `export.mjs`), published as a plain HTML artifact for review. No Artifact tool → return the HTML and PNG paths and the title.

## Structure

- One artboard or HTML piece per format; everything that carries the message inside the safe area.
- One message, one call to action, at most three text sizes; minimum text sizes per format as in `graphic-assets`' pieces reference.
- Illustrations built from primitives coloured with tokens, or only supplied and approved photos and logos.
- Print note, at 300 dpi: A4 is 2480×3508 px (794×1123 CSS px), A5 is 1748×2480 px (559×794), Letter is 2550×3300 px (816×1056). Export with `--size <CSS size> --dpr 3.125`; for a PDF, print the HTML from the browser with `@page { size: A4; margin: 0 }`. Bleed, crop marks and CMYK are the printer's: say so, never call the file press-ready.

## Steps

1. Check the envelope: objective, use and formats. A missing one → return the Questions above as `<outputDir>/questionnaire.json` and stop.
2. Medium check (see Medium); the caller's envelope or BRIEF decides when both routes apply.
3. `graphic-assets`: compose the piece (Design artboards, or a copy of its `piece-template.html` with the system's tokens) and render every format with its `export.mjs` (`--preset` for social sizes, `--size … --dpr 3.125` for print); look at every PNG before returning it, downscaled to at most 1000 px wide (Budget #2); a 1:1 crop only where a check flags a defect.
4. Add the print note to the return when any format is for print.
5. Run Checks, publish or update the artifact, and return.

## Checks

- Every requested format exists, at its exact pixel size, in its own output folder.
- Text inside the safe area; body text contrast 4.5:1, large text 3:1.
- Only supplied and approved logos and photos; no third-party marks.
- Every PNG opened and looked at; copy in the envelope's language, no voseo.

## Return

Compact, per the caller's task envelope (`skills/presentation-brief/references/task-envelope.md`), within its `returnBudget`:
- Summary: use, formats, design system, and each decision with its source.
- The artifact URL and the PNG folder paths.
- Verification: `<command>: <result>`, one line each.
- Questions: the questionnaire path and its first round (up to 4).
- Open items: the print note when it applies (bleed, crop marks, CMYK pending with the printer).
