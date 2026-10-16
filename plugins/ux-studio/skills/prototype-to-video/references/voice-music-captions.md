# Voice, music and captions

HyperFrames owns synthesis, transcription, mixing and caption rendering
(`hyperframes:media-use`, `hyperframes:hyperframes-audio`). This file adds what a client
deliverable needs on top: provider choice, consent, licences, Spanish caption rules, the
sidecar files and the loudness check. Installs belong to `ux-studio:ux-env-setup`; here you
only check and ask.

## Prerequisites (check, then ask before installing anything)

| Need | Check | Install / size (ask first) |
|---|---|---|
| Node 22+, FFmpeg + ffprobe | `node --version`, `ffmpeg -version` | system package manager |
| Render browser | `npx hyperframes doctor --json` (gate on `.ok`) | `npx hyperframes browser ensure` (~260 MB) |
| Kokoro-82M (local voice) | `npx hyperframes doctor` | Python 3.8+, `pip install kokoro-onnx soundfile`; ~311 MB model + voices (≈340 MB) cached in `~/.cache/hyperframes/tts/` |
| `espeak-ng` (Kokoro, any non-English voice) | `espeak-ng --version` | `apt`/`dnf install espeak-ng`, `brew install espeak-ng` |
| Parakeet (transcription, includes Spanish) | — | `npx hyperframes models install parakeet` (~640 MB) |
| whisper.cpp (transcription fallback) | built on first `transcribe` | needs git + cmake outside macOS; models 75 MB–3.1 GB |
| `playwright-core` (capture) | `npm ls playwright-core` | workspace `npm i -D playwright-core` or once `npm i -g playwright-core` (downloads no browser) |

Under the HyperFrames plugin, `npx hyperframes <cmd>` is replaced by the plugin launcher the front
door names (`node "<PLUGIN_ROOT>/skills/hyperframes/scripts/plugin-cli.mjs" <cmd>`). Windows support
for local rendering is unverified: try it, and fall back to WSL2 or `render --docker` if it fails.

## Voice

**Provider order** (HyperFrames `media-use`): HeyGen (signed in: `npx hyperframes auth login` or the
heygen CLI; returns word timestamps) → ElevenLabs (`ELEVENLABS_API_KEY`) → Kokoro-82M local. Gemini
TTS only when the user picks it and a Google key exists. Run `npx hyperframes auth status` first and
relay it verbatim; exit 1 there means "signed out", not a failure. Paid or signed-in providers need
the user's explicit OK; never put keys in the repo.

**Spanish with Kokoro**: voice ids starting with `e` are Spanish (`ef_dora` is the documented
example). List what is actually installed with `npx hyperframes tts --list`; do not assume other
ids. Spanish quality and accent (Castilian vs Latin American) are unverified: if the brief names a
regional variant, compare against a HeyGen or ElevenLabs voice before committing.

**Sample before the full read** (mandatory):

1. Take the hook sentence (≈10 s, 20–25 words) from the narration script.
2. Render it with one or two candidate voices, e.g.
   `npx hyperframes tts "<frase del gancho>" --voice ef_dora --output videos/_plan/muestra-ef_dora.wav`.
3. Give the user the files and ask which voice, speed and tone. Stop until they answer.
4. Only then synthesize the full script with the chosen voice (inside the HyperFrames workflow).

**Pronunciation**: when TTS mispronounces a product name or acronym, respell it in the spoken text
only (`spoken:` line in the narration script); captions keep the correct spelling.

**Voice cloning**: only with the speaker's written, informed consent naming the voice, the project,
the uses, the period and the right to withdraw. Record the consent reference in `CREDITS.md`.
Never clone a voice from public recordings, a client employee without consent, or a public figure.
Delete the cloned voice when the agreed period ends.

## Captions

Captions are mandatory for every narrated video (WCAG 2.x SC 1.2.2, Captions (Prerecorded),
Level A). Deliver both:

- **Burned in**: HyperFrames builds caption groups from word timings and styles them with the
  project's caption skin. Keep the brand font, a backing plate with ≥ 4.5:1 contrast, the lower
  safe zone, and clear of cursor callouts.
- **Sidecar `.srt` + `.vtt`** for hosted players and accessibility (HyperFrames exports none):

```bash
# From narration items with final, absolute times in the cut: [{ "text", "start", "end" }]
node ${CLAUDE_SKILL_DIR}/assets/srt-from-script.mjs videos/_plan/<audiencia>/narration.json \
  --out videos/delivery/<audiencia>-<formato>.es
# Or from a word-level transcript of the final voice track
node ${CLAUDE_SKILL_DIR}/assets/srt-from-script.mjs transcript.json --words --out videos/delivery/<audiencia>-<formato>.es
```

Times must be absolute in the final cut. When narration is synthesized per frame, add each clip's
start (`npx hyperframes timeline --json` → `absStart`) to its word times before converting.

**Transcription language rule**: always pass the model and language explicitly. Whisper `.en`
models (the CLI default is `small.en`) translate Spanish into English. Use
`npx hyperframes transcribe narration.wav --model small --language es`, or Parakeet once installed.

**Spanish timed-text rules** (Netflix Castilian & Latin American Spanish Timed Text Style Guide,
https://backlothelp.netflix.com/hc/en-us/articles/217349997):

- ≤ 42 characters per line, ≤ 2 lines per event.
- Duration 5/6 s minimum (this skill targets 1 s) to 7 s maximum per event.
- Reading speed: check the guide's limit (17 characters/second for adult programmes at the time of
  writing); slow the narration rather than compress the caption.
- Break lines after punctuation and before conjunctions or prepositions; keep article + noun and
  verb + pronoun together.
- Captions are verbatim: the same words as the narration, never a summary.

`srt-from-script.mjs` enforces the length, line, minimum and maximum duration rules; line-break
style is left to the narration (one idea per sentence keeps cues natural). Check three random cues
of the sidecar against the draft render.

## Music and sound effects

Default: no music unless BRIEF.md asks for it. Never music under the voice in training clips.

Order of preference, always recording source, track id, licence and URL in `CREDITS.md`:

1. A track the user supplies with a known licence that covers this client use.
2. A royalty-free library whose licence allows commercial use in client deliverables.
3. HeyGen's music catalog (needs HeyGen sign-in); confirm its terms cover the use.
4. HyperFrames' bundled SFX (`click-soft`, `whoosh`, `chime`…), sourced from Pixabay under the
   Pixabay Content License (commercial use, no attribution required) per their `CREDITS.md`.

Avoid unless the user decides explicitly after hearing the caveat:

- AI-generated music. HyperFrames falls back to local generation (Lyria with a Google key, else
  MusicGen `facebook/musicgen-small`, whose model card states a non-commercial licence — verify)
  when no HeyGen credential exists. Set `music: none` in the HyperFrames storyboard, or supply a
  track, so it never generates silently. Suno/Udio licensing is in flux.
- Anything with an unknown licence. Unknown licence → do not use.

## Mix and loudness (conventions, not a standard)

- Music under a voice: use the HyperFrames voiceover carve (`hyperframes:hyperframes-audio`), not a
  flat volume duck; aim for the bed sitting about 12–18 dB under the voice.
- Web delivery: ≈ −14 LUFS integrated, true peak ≤ −1 dBTP; a `truepeak` limiter last on the master
  bus. Use the same target for every video of the presentation.
- Measure the draft render and report the numbers:

```bash
ffmpeg -hide_banner -nostats -i renders/draft.mp4 -af loudnorm=I=-14:TP=-1:LRA=11:print_format=summary -f null -
```

  Off by more than 1 LU → adjust master gain in the composition and re-render; record any
  post-render normalisation in `CREDITS.md`.
- Clicks and whooshes stay well under the voice and never land on a word.
