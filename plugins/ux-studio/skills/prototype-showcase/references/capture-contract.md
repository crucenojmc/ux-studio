# Capture contract (v1)

`ux-studio:prototype-to-video` drives the showcase through this API. Implement it exactly; extra members are allowed, changes are not.

## Contract (verbatim)

`window.SHOWCASE = { version: "1", screens(), roles(), flows(), open(to, opts), targetRect(selector, frame) }`
- `screens()` → `[{id, title, group, access, kind, path, desc}]`; `roles()` → `[{id, label, home}]`.
- `flows()` → `[{id, role, title, lede, steps:[{label, to:{screen, role?, sheet?, set?}, target?, say?}]}]` where `target` is a CSS selector inside the app root of the element the user acts on in that step and `say` an optional narration line.
- `open(to, {view?: 'web'|'phone'|'both'})` → Promise resolved after every visible frame rendered and `document.fonts.ready`; dispatches `window` event `showcase:rendered` with `detail {screen, role, sheet}`.
- `targetRect(selector, frame /* 'web'|'phone' */)` → `{x, y, width, height}` in page CSS pixels or `null`.
- URL query `?capture=web|phone` renders ONLY that device frame edge-to-edge filling the viewport (no hero, index, sections, ambient glow, entrance animations or cursor) for deterministic screenshots; `&theme=dark|light`, `&motion=reduced`. Location via hash `#screen=<id>&role=<id>&sheet=<id>`.

## How the template implements it

- The contract holds in every presentation format (`LAYOUT.mode` `app`, `tour` or `ux-system`): `window.SHOWCASE`, `?capture=`, the hash and the navigation markup do not depend on it, and `flows()` returns the flows even when the format shows no flow cards. Capture mode ignores the format. In `app`, `open()` ignores `opts.view`: the viewport picks the frame.
- `screens()` lists screens only (`kind` is `tab`, `root` or `push`). Sheets come from the extra member `sheets()` → `[{id, title, group, access, parent, path, desc}]`.
- `roles()`, `screens()`, `sheets()` and `flows()` list only what the page shows. With `LAYOUT.roles` `'single'` or `{ focus: '<roleId>' }` that is one role, the screens and sheets it can open (their `access` lists only that role) and the flows it walks alone; cross-role flows are absent.
- `?capture=` works only for a frame `LAYOUT.platforms` declares. An undeclared one (`?capture=phone` on a web-only showcase) replaces the page with the reason and throws at load: `window.SHOWCASE` never appears, so a capture script fails instead of filming an empty frame. With one platform, `open()` ignores `opts.view`.
- `flows()[i].role` is the persona of the flow card. In a cross-role flow it is the first step's role, and every step carries its own `to.role`.
- `open()` resets the app's view state to its defaults, applies `to.set` (plain objects merge one level deep) and keeps `data`. The same `to` therefore always produces the same screen. If the current role cannot see the screen or sheet, it switches to the first role that can.
- `showcase:rendered` fires after every settled render (not only after `open()`): fonts ready plus two animation frames. A synchronous `showcase:render` event also fires on each render; it is internal and not part of the contract.
- `targetRect()` uses the first **visible** match inside that frame's `.app` (desktop and phone markup coexist in the DOM), scrolls the app's own scroller so the element is visible (never the page), and returns document coordinates (`getBoundingClientRect()` plus page scroll). In capture mode the page does not scroll, so they equal viewport pixels. It returns `null` for an invalid selector, a hidden frame or no match.
- Capture mode shows the device **screen** without bezel or browser bar. `capture=web` renders the desktop layout at `LAYOUT.webMinWidth` logical px (1080 in the template) or wider, scaled to the viewport; `capture=phone` fills the viewport and keeps the 47 px status bar (fixed time) and home indicator. Preferences in `localStorage` are ignored and not written; transitions and animations are disabled.
- The hash may carry extra keys (for example `&order=OT-4821`); they are applied as `set` values.

## Example: capture every flow step

```js
// node capture.mjs  (devDependency: playwright-core; uses an existing Chromium)
import { chromium } from 'playwright-core';

const page = await (await chromium.launch({ executablePath: process.env.CHROME_PATH }))
  .newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.goto('file:///…/preview.html?capture=web&theme=dark&motion=reduced');
await page.waitForFunction(() => window.SHOWCASE?.version === '1');

const flows = await page.evaluate(() => window.SHOWCASE.flows());
for (const flow of flows) {
  for (const [i, step] of flow.steps.entries()) {
    await page.evaluate((to) => window.SHOWCASE.open(to), step.to);
    const rect = step.target
      ? await page.evaluate((t) => window.SHOWCASE.targetRect(t, 'web'), step.target)
      : null;
    await page.screenshot({ path: `out/${flow.id}-${i + 1}.png` });
    console.log(flow.id, i + 1, step.label, rect, step.say);
  }
}
```

Recommended viewports, for the declared platforms only: web 1440 × 900 (or 1280 × 800), phone 390 × 844, both with `deviceScaleFactor` 2 or 3.

### Navigation markup

The audits and the capture scripts read navigation from the markup, so a prototype must keep it:

- Screens: `data-go="<screenId>"`, with an optional `data-arg="<recordId>"` for the record (`data-go="orden" data-arg="OT-4821"`).
- Sheets: `data-act="sheet" data-arg="<sheetId>"`.
- Every other `data-act` value (filter, toggle, approve, ...) is an in-screen action and is not navigation.

Any custom prototype must keep this markup, otherwise the reachability audit reports its screens as reachable only by URL and the videos cannot find the flow targets.
