---
id: animation
title: Animación de interfaz
source: claude-design
medium: html
fallback: none
agent: ux-designer
skills: [design-system-builder, prototype-to-video]
---
## When

Use when the user wants to define or show how an interface element moves: a micro-interaction, a confirmation, a loading sequence, a transition between two states, a short animated explainer of a UI. Signals: «animación», «microinteracción», «transición», «motion», «que se mueva», «efecto al tocar».

Not for:
- a navigable prototype where motion is part of the flow → `app-prototype`
- static screens with no motion → `ui-mockups`
- an object that turns in three dimensions → `object-3d`
- the steps drawn as a static flow → `diagram`

## Expect

- **Obtienes:** una página HTML con la animación en pasos con nombre, controles para reproducir, pausar, repetir, recorrer la línea de tiempo y cambiar la velocidad; respeta «reducir movimiento».
- **No incluye:** la navegación entre pantallas ni un video narrado para una audiencia; para recorrer un flujo completo, `app-prototype`.
- **Ideal si:** quieres acordar cómo se mueve un elemento de la interfaz, con tiempos y curvas exactos, antes de construirlo.

## Questions

1. ¿Cómo se entrega la animación?
   - Página HTML con controles (Recomendado)
   - Página HTML y además un video MP4
   - Solo un video MP4
2. ¿Qué se anima?
   - Un componente de la interfaz (Recomendado)
   - Una transición entre dos pantallas
   - Una secuencia explicativa de varios pasos
3. ¿Qué ritmo tiene?
   - Las duraciones del sistema de diseño (Recomendado)
   - Más lento, para presentarlo
   - Más rápido, para uso diario intensivo

Infer instead of asking:
- The steps (what moves, in what order) from the objective and the supplied screens.
- Durations and curves from the design system's motion tokens; without a system, the starter's.
- Reduced motion: always honoured, never asked.

## Medium

- Type: a plain **HTML artifact** built from `${CLAUDE_PLUGIN_ROOT}/skills/ux-recipes/assets/starters/animation.html`: Web Animations API, no library, no network. No artifact type is needed, so there is no type check for the page.
- Fallback: none. No Artifact tool → write the HTML in the output dir and return its path and title.
- Video, only when asked: `prototype-to-video` (HyperFrames) captures frames through `window.ANIMATION.seek(t)`. Claude Motion, if available in the user's plan, is an alternative the user chooses; never assume it.

## Structure

- One stage with the element in its real context; the surrounding screen muted.
- `STEPS` in the starter: each step names its target, keyframes, a duration token (`fast`, `base`, `slow`), an easing token (`out`, `in-out`, `sheet`) and a gap to the previous step.
- Motion tokens on `:root`: `--motion-duration-*` (they read the design system's `--duration-*`) and `--ease-*`.
- Controls: play and pause, replay, scrubber, speed 0.5×, 1× and 2×; the list of steps with each one's time range.
- Reduced motion: the end state with a short fade.
- `window.ANIMATION` (steps, duration, play, pause, seek) kept intact: captures depend on it.

## Steps

1. Check the envelope: objective, what moves, the delivery. A missing one → return the Questions above as `<outputDir>/questionnaire.json` and stop.
2. Copy `${CLAUDE_PLUGIN_ROOT}/skills/ux-recipes/assets/starters/animation.html` to the output dir.
3. `design-system-builder` (reuse path): with a design system, paste its `tokens.css` values over the starter's `:root` block, keeping the `--motion-*` and `--ease-*` names; no system → the starter's tokens, said once.
4. Build the stage and `STEPS`: animate `transform` and `opacity` only. Optional when listed in the session: `animate` for the decisions, `animation-vocabulary` to name effects.
5. Run Checks and publish the HTML artifact (title, icon).
6. Video, only when the answer asked for it: return an envelope for `video-producer` with `prototype-to-video`, the published page as input, `window.ANIMATION.duration` as the length and `seek(t)` per frame.

## Checks

- At 390 px and on desktop: zero console errors and no horizontal scroll.
- `ANIMATION.seek(0)` and `ANIMATION.seek(ANIMATION.duration)` give different states; the same `t` always gives the same state.
- With reduced motion the page shows the end state and only fades.
- Durations and curves come only from tokens; no layout properties animated (`width`, `height`, `top`, `left`).
- Step names and copy in the envelope's language, no voseo.

## Return

Compact, per the caller's task envelope (`skills/presentation-brief/references/task-envelope.md`), within its `returnBudget`:
- Summary: the steps, total duration, tokens used, and each decision with its source.
- The artifact URL, or the HTML path and title to publish.
- Verification: `<command>: <result>`, one line each.
- The `video-producer` envelope when a video was asked for.
- Open items: anything not verified (for instance, the video render).
