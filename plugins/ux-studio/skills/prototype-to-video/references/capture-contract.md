# Capture contract — `window.SHOWCASE` v1

`ux-studio:prototype-showcase` owns this API; this skill only consumes it. If the page
breaks the contract, fix the showcase, never work around it here.

## The contract (verbatim)

```text
window.SHOWCASE = { version: "1", screens(), roles(), flows(), open(to, opts), targetRect(selector, frame) }

flows() → [{ id, role, title, lede, steps: [{ label, to: { screen, role?, sheet?, set? }, target?, say? }] }]

open(to, { view }) → Promise resolved after render + fonts ready; also fires window event `showcase:rendered`

targetRect(selector, 'web' | 'phone') → { x, y, width, height } or null

URL ?capture=web|phone renders only that device frame edge-to-edge (only a platform the showcase declares)
    (no chrome, no entrance animations) for deterministic screenshots
    &theme=dark|light&motion=reduced
```

The showcase is published as an artifact FRAGMENT. For local capture, wrap it with a
document skeleton and serve it over http:

```bash
node <prototype-showcase skill dir>/assets/preview.mjs fragment.html preview.html
python3 -m http.server 8080   # in the folder that holds preview.html (any static server works)
```

`<prototype-showcase skill dir>` is `${CLAUDE_PLUGIN_ROOT}/skills/prototype-showcase` inside this plugin.

## How `capture-flows.mjs` uses it

```bash
node ${CLAUDE_SKILL_DIR}/assets/capture-flows.mjs \
  --url http://localhost:8080/preview.html --out videos/_capture/web \
  [--view web|phone] [--size 1920x1080] [--scale 1] [--theme dark|light] [--flow <id>|all] [--timeout 30000]
```

1. Loads `--url` adding `capture=<view>`, `motion=reduced` and, when given, `theme=<theme>`.
2. Waits for `window.SHOWCASE`; refuses any `version` other than `"1"`.
3. For each selected flow and step, in order: `await SHOWCASE.open(step.to, { view })`, waits for
   fonts and two animation frames, screenshots the viewport (not the full page) to
   `<out>/<flow-id>/<NN>-<label-slug>.png`, then records `SHOWCASE.targetRect(step.target, view)`.
4. Writes `<out>/storyboard.json`:

```jsonc
{
  "source": "http://localhost:8080/preview.html?capture=web&motion=reduced&theme=dark",
  "view": "web",                       // web | phone
  "size": { "width": 1920, "height": 1080 },   // viewport in CSS px
  "scale": 1,                          // deviceScaleFactor; PNG pixels = CSS px × scale
  "theme": "dark",                     // or null when not forced
  "flows": [{
    "id": "aprobar-pedido", "title": "Aprobar un pedido", "role": "supervisor", "lede": "…",
    "steps": [{
      "index": 1, "label": "Abrir la bandeja", "say": "…" /* or null */,
      "to": { "screen": "bandeja", "role": "supervisor" },
      "image": "aprobar-pedido/01-abrir-la-bandeja.png",     // relative to <out>
      "target": "#btn-primero" /* or null */,
      "targetRect": { "x": 996, "y": 180, "width": 220, "height": 48 } /* or null */
    }]
  }]
}
```

Defaults: web 1920×1080 at 1×; phone 390×844 at 2× (a 780×1688 PNG that fits a 1080×1920 canvas
inside a device frame). Exit codes: 0 ok · 1 usage or capture error · 2 `playwright-core`
missing (workspace `npm init -y && npm i -D playwright-core` or once `npm i -g playwright-core`; it downloads no browser) · 3 no Chromium-family binary.

Browser lookup order (never downloads): `CHROME_PATH` → `~/.cache/hyperframes/chrome/**/chrome-headless-shell`
→ Playwright cache (`~/.cache/ms-playwright`, macOS `~/Library/Caches/ms-playwright`, Windows
`%LOCALAPPDATA%\ms-playwright`; newest first) → `google-chrome` / `chromium` on `PATH` → standard
macOS/Windows install paths. Verified on Linux only.

## Mapping rects into the composition

- In capture mode the device frame fills the viewport, so `targetRect` is already in screenshot
  coordinates (CSS px). Pixel rect in the PNG = rect × `scale`.
- When the screenshot is placed scaled or offset in the HyperFrames canvas (for example a phone
  inside a device mock), apply the same transform to the rect: `x' = left + x × k`, `y' = top + y × k`.
- The cursor target is the rect centre; the callout anchors to the nearest free edge.
- A `null` rect means the step has no target or the selector was not found (the script warns):
  narrate the screen without a cursor rather than guessing coordinates.
- Push-ins past 1:1 need a capture at `--scale 2` of that view; do not upscale a 1× PNG.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `window.SHOWCASE did not appear` | Fragment opened without the wrapper, or `file://` | Wrap with `preview.mjs`, serve over http |
| `Unsupported window.SHOWCASE version` | Showcase built from another template version | Rebuild the showcase with the current `prototype-showcase` |
| Blank or half-rendered PNG | `open()` resolves before render | Fix `open()` in the showcase; it must resolve after render + fonts |
| Rect partly outside the viewport (warning) | Target below the fold in that frame | Change the step's screen state or use a larger `--size` |
| Page error warnings | Prototype runtime errors | Fix them in the showcase before recording; never film a broken state |
