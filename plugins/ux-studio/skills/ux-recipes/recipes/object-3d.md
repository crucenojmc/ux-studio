---
id: object-3d
title: Objeto 3D
source: claude-design
medium: html
fallback: none
agent: ux-designer
skills: [design-system-builder]
---
## When

Use when the user wants to show an object in 3D that the viewer can turn and zoom: a device, a package, a piece of equipment, a 3D logo, a simple product study. Signals: «3D», «modelo 3D», «girar el objeto», «.glb», «visor 3D».

Not for:
- a flat illustration, flyer or poster of the object → `print-piece`
- the motion of an interface element → `animation`
- app screens → `ui-mockups`

## Expect

- **Obtienes:** un visor 3D en una página HTML con tu modelo GLB o figuras simples de ejemplo, luz de estudio, controles para girar y acercar, y texto alternativo si el navegador no muestra 3D.
- **No incluye:** modelado 3D desde cero ni renders fotorrealistas; para una pieza gráfica fija del objeto, `print-piece`.
- **Ideal si:** tienes un modelo, o te sirve un objeto simple, y necesitas mostrarlo desde todos los ángulos.

## Questions

1. ¿Qué se muestra?
   - Un modelo GLB que entregarás (Recomendado)
   - Figuras simples hechas con primitivas
   - Un modelo en otro formato (OBJ, FBX, STEP)
2. ¿Cómo se presenta?
   - Visor con giro libre (Recomendado)
   - Giro automático lento al abrir
   - Vistas fijas para capturas
3. ¿Hace falta una imagen fija para navegadores sin 3D?
   - Sí, una captura de la vista inicial (Recomendado)
   - No

Infer instead of asking:
- The model from the envelope's `inputs` (a `.glb` path); none → primitives.
- Colours from the design system's tokens; the text alternative (`LABEL`) from the objective.
- Reduced motion: auto-rotate off, never asked.

## Medium

- Type: a plain **HTML artifact** built from `${CLAUDE_PLUGIN_ROOT}/skills/ux-recipes/assets/starters/object-3d.html`: three.js 0.186.1 from `cdn.jsdelivr.net` through an import map, with OrbitControls, GLTFLoader and RoomEnvironment from the same version's `examples/jsm`. No artifact type is needed, so there is no type check.
- The model goes to the artifact's asset store (15 MB at most per file; load `artifact-capabilities` before declaring the `assets` capability) and `GLB_URL` takes the URL the upload returns.
- Fallback: none. No Artifact tool → write the HTML in the output dir with the model beside it and return the paths and the title.

## Structure

- One stage at 4:3 with the object resting on the ground, a soft shadow and the stage background from a token.
- Studio lighting: the room environment for fill and reflections, one key light for the shadow.
- Orbit controls with limits (no camera under the floor); buttons «Giro automático» and «Restablecer vista».
- `LABEL` describes the object for screen readers; the fallback text, and the poster when there is one, show without WebGL or without the CDN.
- `window.SCENE3D` exposes the scene, camera, renderer and controls for captures.

## Steps

1. Check the envelope: objective and model. A missing one → return the Questions above as `<outputDir>/questionnaire.json` and stop. A model in another format → ask for a GLB export; never convert silently.
2. Copy `${CLAUDE_PLUGIN_ROOT}/skills/ux-recipes/assets/starters/object-3d.html` to the output dir.
3. `design-system-builder` (reuse path): with a design system, paste its `tokens.css` values over the starter's `:root` block; no system → the starter's tokens, said once.
4. Model: a GLB of 15 MB or less → upload it to the asset store and set `GLB_URL`; a Draco or Meshopt compressed GLB also needs DRACOLoader or MeshoptDecoder from the same addons path; heavier → ask for a lighter export. No model → arrange the primitives to suggest the object.
5. Poster, when asked: capture the ready view (headless Chromium may need `--enable-unsafe-swiftshader` for WebGL), upload it and set `POSTER_URL`.
6. Run Checks, publish the HTML artifact (title, icon), and return.

## Checks

- three.js URLs pinned to one exact version on `cdn.jsdelivr.net`; never `@latest`.
- With WebGL: the scene draws with zero console errors; without WebGL or the CDN: the fallback text shows.
- No horizontal scroll at 390 px; the canvas follows the stage size.
- Reduced motion: no auto-rotate and no inertia until the user turns it on.
- The model file is 15 MB or less and fits the stage (the starter scales it into view).

## Return

Compact, per the caller's task envelope (`skills/presentation-brief/references/task-envelope.md`), within its `returnBudget`:
- Summary: model or primitives, the three.js version, and each decision with its source.
- The artifact URL, or the HTML path, the model path and the title to publish.
- Verification: `<command>: <result>`, one line each.
- Questions: the questionnaire path and its first round (up to 4).
- Open items: what was not verified (for instance, rendering on a phone GPU).
