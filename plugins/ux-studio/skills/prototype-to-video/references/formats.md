# Audience presets

Conventions distilled from product-demo and training practice, **not measured benchmarks**.
BRIEF.md wins whenever it states a length, format or tone; adjust to the attention budget the
user gives. The "likely route" column is an expectation only: the HyperFrames front door
(`hyperframes:hyperframes`) picks the workflow.

| Audience | Length | Canvas | Structure | Voice / music | Captions | Likely route |
|---|---|---|---|---|---|---|
| Executive sponsor | 60–90 s | 1920×1080 | Outcome first → problem → one flow → proof → the decision asked | Narrated; calm bed optional, carved under voice | Burned in + sidecar | `product-launch-video` (show-it-as-is) |
| Operational users / training | 30–120 s **per task**, one clip per flow | 1920×1080 (web) or 1080×1920 (phone tasks) | Goal → step by step → result → how to recover from the usual mistake | Narrated, slower (~2.2 words/s); **no music over the voice** | Mandatory, burned in + sidecar | `product-launch-video` |
| Sales / marketing | 30–60 s, plus a 9:16 cut | 1920×1080 and 1080×1920 | Hook → one use case → outcome → CTA | Narrated; brand bed and sonic logo if the brand has one | Burned in (most feeds play muted) + sidecar | `product-launch-video` |
| Product / UX peers | 2–4 min walkthrough | 1920×1080 | Problem → principles → flow by flow with rationale → alternatives considered → open questions | Narrated, conversational; no music or a very low bed | Burned in + sidecar | `general-video` (longer than the specialised sweet spot) |
| Developers | **No video by default** | — | Link the showcase inventory and the Design System artifact | — | — | — |

## Structure per scene

Every narrated video follows hook (0–5 s, outcome first) → problem → solution walked through the
flow → proof → close/CTA. Inside "solution", one scene per flow step:

- base: the step's screenshot (`storyboard.json` → `image`), never a rebuilt screen;
- cursor: path to the centre of `targetRect`, click ripple on arrival;
- callout: 2–6 words naming what the step achieves, anchored to the target;
- narration: one sentence, one idea;
- duration: narration length + 0.5–1.0 s of breathing room (≈ words ÷ 2.5 s for Spanish).

## Cuts and versions

- Short and long cuts come from the same capture and storyboard; never re-capture for a cut.
- A 9:16 cut of a web flow crops around `targetRect` or, when the BRIEF's platform includes Mobile,
  switches to the phone capture; it does not shrink a 16:9 screen into the middle of a vertical frame.
- Platform «Web»: every video is captured with `--view web`. «Mobile»: `--view phone`, vertical
  canvases first.
- Name files `<audience>-<format>` (`ejecutivo-16x9`, `ventas-9x16`, `tarea-aprobar-pedido-16x9`).

## Default render settings

- 30 fps (24 for a filmic look, 60 only for fast UI motion), MP4 for delivery.
- GIF only for silent loops in docs (no audio, so no narration); WebM/MOV only when transparency is needed.
- `--quality draft` while reviewing; the delivery quality only after the user approves the draft.
