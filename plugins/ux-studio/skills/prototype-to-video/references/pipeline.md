# Pipeline — showcase flows to delivered videos

This skill prepares inputs and orchestrates; HyperFrames composes, mixes and renders. Whenever a
HyperFrames skill gives a different instruction for composition, timing, audio or rendering,
follow HyperFrames.

## Folder layout (inside the user's project, never `/tmp`)

```text
videos/
  _capture/<view>/            capture-flows.mjs output: storyboard.json + <flow>/<NN>-<slug>.png
  _plan/<audiencia>/          storyboard.md, narration.md, narration.json, voice samples
  <audiencia>-<formato>/      one HyperFrames project per audience × format (created by `hyperframes init`)
  delivery/                   what the user receives (step 10)
```

`hyperframes init` refuses a non-empty directory: never pre-create `videos/<audiencia>-<formato>/`.

## 1. Read the brief

From `BRIEF.md` take, per video row: audience, decision asked, format and length, language and
variant, address form (tú / vos / usted), brand (design system tokens, logo permission, sonic
identity) and music policy. Map each audience to a preset in `formats.md`. No `BRIEF.md` or no
video row → run `ux-studio:presentation-brief` first. Developers get no video unless the brief
asks for one.

## 2. Pick flows and draft the storyboard

- List the flows (`window.SHOWCASE.flows()` or the showcase's FLOWS definition) and choose the ones
  that serve each audience's decision. Training: one clip per flow. Executive: one flow, the one
  that proves the outcome.
- Copy `${CLAUDE_SKILL_DIR}/assets/storyboard-template.md` to `videos/_plan/<audiencia>/storyboard.md`
  and fill it: hook (0–5 s, outcome first) → problem → solution walked through the flow → proof →
  close/CTA. One scene per flow step; each scene = screenshot base + cursor path to `targetRect` +
  callout + narration + duration. `image` and `targetRect` are filled after step 4.

## 3. Write the narration script

Follow `${CLAUDE_SKILL_DIR}/assets/narration-guide.md`: the brief's language and address form,
about 2.5 words per second for Spanish, one idea per sentence, no invented numbers (only demo data
visible on screen, said to be demo data). Write `narration.md` (human-readable, one line per scene)
and, once timings exist, `narration.json` (`[{ "text", "start", "end" }]`, seconds) for the sidecar
captions. Estimated scene duration = words ÷ 2.5 + 0.5–1.0 s.

## 4. Capture the flows

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/prototype-showcase/assets/preview.mjs fragment.html videos/_capture/preview.html
python3 -m http.server 8080 --directory videos/_capture      # any static server; stop it afterwards
npm i -D playwright-core   # in the git-ignored tmp/ workspace, or once `npm i -g playwright-core` for all projects; with the user's OK, never in a product's package.json; downloads no browser
node ${CLAUDE_SKILL_DIR}/assets/capture-flows.mjs --url http://localhost:8080/preview.html \
  --out videos/_capture/web --view web --theme light
node ${CLAUDE_SKILL_DIR}/assets/capture-flows.mjs --url http://localhost:8080/preview.html \
  --out videos/_capture/phone --view phone                    # only when the BRIEF's platform includes Mobile
```

Contract, defaults, exit codes and rect mapping: `capture-contract.md`. Open three PNGs and check
them before going on (no half-rendered states, demo label visible, no runtime errors reported).
Fill `image` and `targetRect` in the storyboard from `storyboard.json`.

**Gate**: present storyboard + narration + screenshots per audience; wait for approval.

## 5. Build the HyperFrames project

Enter `hyperframes:hyperframes` (the mandatory front door) once per audience × format. It runs
its own intent layer, picks the workflow (expected: `product-launch-video` with a show-it-as-is
intent; `general-video` for walkthroughs over ~3 min), scaffolds `videos/<audiencia>-<formato>/`
and writes its own `BRIEF.md` there. Give it a formed request so it only asks what the brief does
not answer:

- **message, audience, length, language**: from `BRIEF.md` (name it as the receipt).
- **destination → aspect**: 1920×1080, 1080×1920 or 1080×1080 per `formats.md`.
- **intent**: show the prototype as-is; the supplied screenshots are the visual source of truth;
  no URL capture (the prototype is local); keep each screenshot as the scene base, never rebuild
  or embed the live prototype (it is not seekable).
- **VO_MODE**: verbatim — the approved `narration.md`.
- **assets**: the PNG paths and `storyboard.json` (rects for cursor targets), the logo if permitted.
- **brand**: colors and fonts from the design system tokens. For the no-capture path, HyperFrames
  reads `capture/extracted/tokens.json` (`{ title, description, colors, fonts }`); fill it from the
  tokens so the frame preset is remixed onto the brand.
- **customizations**: animated cursor moving to the `targetRect` centre with click ripple
  (HyperFrames rules `cursor-click-ripple`, `coordinate-target-zoom`, `camera-cursor-tracking`);
  callouts; brand lower-third; title and end cards from the design tokens; a "Datos de
  demostración" label wherever numbers appear; the end card says the look is a prototype, not the
  final design; captions on; music per the brief.
- **run shape**: recommend `storyboard: yes` for the first video of a presentation; let the user
  answer the front door's own questions.

HyperFrames writes `STORYBOARD.md` and `SCRIPT.md` from these inputs; ours stay in `_plan/` as
the approved source.

## 6. Voice

Sample → approval → full TTS, per `voice-music-captions.md`. The full read happens inside the
HyperFrames workflow with the chosen provider and voice.

## 7. Captions

Burned in by HyperFrames from word timings (brand-styled, ≤ 42 chars/line, ≤ 2 lines, 1–7 s).
Sidecars with `srt-from-script.mjs` from the final timings. Rules and commands:
`voice-music-captions.md`.

## 8. Music and SFX

Only per the brief's music policy; licence recorded; carve under the voice; loudness targets.
Details: `voice-music-captions.md`.

## 9. Check, draft, approve, deliver render

1. `npx hyperframes doctor --json` before the first render (gate on `.ok`).
2. `npx hyperframes lint`, then `npx hyperframes check` (0 findings) and the workflow's snapshots.
3. Open the Studio preview (`npx hyperframes preview --background`); HyperFrames asks "render now, or
   what changes?".
4. Approved → `npx hyperframes render --quality draft --output renders/<audiencia>-<formato>-draft.mp4`.
   Check duration with `ffprobe`, loudness, and three caption cues; hand the draft to the user.
5. Draft approved → `npx hyperframes render --quality delivery --output renders/<audiencia>-<formato>.mp4`.
   Quality names follow the installed CLI (`render --help`; 0.8.153 documents draft/looks/delivery).

Under the HyperFrames plugin, replace `npx hyperframes` with the launcher its front door names.

## 10. Deliver

Copy to `videos/delivery/`:

- `<audiencia>-<formato>.mp4` per audience and format;
- `<audiencia>-<formato>.<idioma>.srt` and `.vtt`;
- `<audiencia>-storyboard.md` (the approved storyboard with narration);
- `CREDITS.md`:

```markdown
# Créditos y licencias — {presentación}

| Elemento | Fuente | Licencia / permiso | Referencia |
|---|---|---|---|
| Voz | {proveedor · voz} | {términos del proveedor / consentimiento firmado} | {id de voz · fecha} |
| Música | {biblioteca · pista} | {licencia} | {URL · id} |
| Efectos | HyperFrames SFX (Pixabay) | Pixabay Content License | media-use/audio/assets/sfx/CREDITS.md |
| Tipografías | {familia} | {licencia} | {URL} |
| Logo | {cliente / consultora} | {permiso} | {referencia en BRIEF.md} |

Datos mostrados: de demostración. Sonoridad medida: {LUFS integrados} / {dBTP}.
```

Report per video: path, real duration, resolution, loudness measured, caption files, what is
pending (for example a voice not yet approved for the regional variant).
