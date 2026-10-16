---
name: prototype-to-video
description: "Trigger: prototype video, demo video, narrated walkthrough, training clip, video per audience, showcase flows to video. Captures showcase flows and orchestrates HyperFrames into narrated, captioned videos per audience."
license: UNLICENSED
metadata:
  author: "Mapplics"
  version: "1.0"
---

## Activation Contract

Optional phase, never a default step: run only when the `BRIEF.md` module plan selects "Video" (a video row assigned to `video-producer`; the user asked for it or accepted the proposal), and the `ux-studio:prototype-showcase` page exists. This skill prepares inputs and orchestrates; HyperFrames composes, mixes and renders.

## Hard Rules

- Enter HyperFrames only via `hyperframes:hyperframes`; its rules win any conflict.
- Scene base = captured screenshot. Never embed or rebuild the live prototype.
- Narrate only what is on screen; no invented numbers; demo data labelled as demo.
- Every narrated video: captions burned in AND `.srt` + `.vtt` sidecars.
- Ask before large downloads (Chrome ~260 MB, Kokoro ~340 MB, Parakeet ~640 MB) and paid or signed-in providers.
- No voice cloning without written consent; no asset without a known licence; record both in `CREDITS.md`.
- No client material in HyperFrames `feedback`; `--file-issue` only with consent.
- Write everything under the project's `videos/`, never `/tmp`.

## Decision Gates

One question at a time; stop and wait.

- No `BRIEF.md`, no module plan or no video row → `ux-studio:presentation-brief` first.
- Developer audience → no video; link the showcase inventory and Design System.
- Approve storyboard + narration + screenshots per audience before building.
- Approve a 10-second voice sample before the full narration.
- Music only if the brief asks, with a confirmed licence.
- Approve the draft render before the delivery render.

## Execution Steps

1. Read `BRIEF.md`; map audiences to presets (`references/formats.md`).
2. Pick flows; draft `videos/_plan/<audiencia>/storyboard.md` from `assets/storyboard-template.md`.
3. Write narration with `assets/narration-guide.md`.
4. Serve the wrapped showcase; run `node ${CLAUDE_SKILL_DIR}/assets/capture-flows.mjs --url <http-url> --out videos/_capture/<view>`; attach images and rects.
5. Enter `hyperframes:hyperframes` per audience × format with the input pack (`references/pipeline.md` §5).
6. Voice sample → approval → full TTS.
7. Burned-in captions; sidecars via `node ${CLAUDE_SKILL_DIR}/assets/srt-from-script.mjs`.
8. Music/SFX: carve under voice, ≈ −14 LUFS, ≤ −1 dBTP.
9. `doctor` → `lint` → `check` → preview → draft → review → delivery render.
10. Deliver and report.

## Output Contract

`videos/delivery/`: per audience × format `<audiencia>-<formato>.mp4`, `.<idioma>.srt` + `.vtt`, `<audiencia>-storyboard.md`; one `CREDITS.md` (voice, music, SFX, fonts, logo permission, loudness). In the brief's language. Report path, duration, resolution, loudness and what is pending or unverified.

## References

All under `${CLAUDE_SKILL_DIR}/`:

- `references/pipeline.md` — steps, folders, HyperFrames hand-off, delivery.
- `references/formats.md` — audience presets (conventions).
- `references/voice-music-captions.md` — providers, setup, consent, licences, Spanish captions, loudness.
- `references/capture-contract.md` — `window.SHOWCASE` v1, capture output.
- `assets/storyboard-template.md`, `assets/narration-guide.md` — Spanish templates.
- `assets/capture-flows.mjs`, `assets/srt-from-script.mjs` — scripts (`--help`).
