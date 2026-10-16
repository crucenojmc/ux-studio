# Gotchas

Each item: symptom → cause → what `capture-states.mjs` does or what to do.

## Motion and timing

- **Captured mid-transition** (half-faded dialog, colour between two states) → CSS transitions or
  animations still running. The script injects
  `*,*::before,*::after{transition:none!important;animation:none!important}` at document start and
  again before capture, sets reduced motion, and screenshots with `animations: 'disabled'`.
- **Background tab freezes the animation** (Claude in Chrome, a DevTools MCP tab that is not in
  front) → hidden pages do not run `requestAnimationFrame` and throttle timers, so a transition
  can stop half way. Inject the same stylesheet before capturing (the `--print-snippet` expression
  does it) and keep the measured tab in front.
- **Framework dialogs or overlays stay invisible or offset** → they animate with the Web Animations
  API or wait for `animationend`. Add per-side `css`, for example
  `.cdk-overlay-pane{opacity:1!important;transform:none!important}`, or a `waitFor` step.
- **Motion values read as `0s`** → read with the kill stylesheet on. The script reads
  `transition-*` / `animation-*` with that stylesheet briefly disabled; JS-driven motion is not in
  computed CSS, so record a video and compare by eye.
- **Hover or focus captured by accident** → the pointer stays where the last step left it. Hover
  only through a `hover` step; caret is hidden.

## Fonts and typography

- **Text metrics differ by a pixel everywhere** → web font not loaded at capture time. The script
  waits for `document.fonts.ready`; the report warns when `document.fonts.status` is not `loaded`
  and lists failed font requests.
- **Same `font-family`, different glyphs** → the computed value is the declared stack, not the
  font drawn. Compare `rendered-font` (Chromium CDP). A different `font-feature-settings` (for
  example a UI framework setting stylistic alternates on `body`) changes digits and letters with
  the same family.
- **Variable fonts** → also measure `font-variation-settings` and `font-optical-sizing`.

## Pixels and devices

- **Everything differs after moving machines** → rendering depends on OS, browser build, GPU,
  fonts installed and headless mode. Capture both sides in one run on one machine, with one browser
  binary; never compare a capture from one OS with a capture from another. Re-measure on the same
  machine as the first measurement, or re-capture both sides.
- **DPR** → `deviceScaleFactor` in each viewport. With `scale: "css"` (default) screenshots are one
  pixel per CSS pixel; with `"device"` they are larger and masks are scaled. Both sides always use
  the same value.
- **Colours from screenshots disagree with computed colours** → antialiasing, subpixel text,
  compression and colour management blend pixels. Judge colour on computed styles (ΔE2000), not on
  sampled pixels.
- **Modern colour syntax** (`oklch()`, `color()`, `lab()`) → normalised to sRGB through a canvas
  before ΔE; out-of-gamut colours are clamped, so compare those tokens by value too.
- **The 2 % pixel ratio passes with visible defects** → on a large frame 2 % is many pixels. The
  style diff catches small defects; the ratio only localises.

## Layout and data

- **Content cut off, lazy rows missing, element "not found"** → the app scrolls inside an inner
  container, not the window. `fullPage` only grows the window: it does not capture the content of
  inner scroll containers. Use a `scroll` step on the element (scrolls every ancestor), capture a
  single element, or use an `evaluate` step that scrolls the elements whose
  `scrollHeight > clientHeight`.
- **`isMobile: true` renders the page at 980 px** → a local HTML file without
  `<meta name="viewport" content="width=device-width, initial-scale=1">` gets the legacy desktop
  layout width in a mobile context. Add the meta tag to the page (or measure the real app, which
  has it), and check `innerWidth` in the capture's meta.
- **`frozenTime` did not change the prototype's clock** → it only affects the implementation: the
  showcase draws a fixed demo clock of its own. Mask the clock on both sides.
- **A step "cannot find" an element that exists** → the same screen is rendered twice (web frame
  and phone frame) and the first DOM match is the hidden copy. Steps use the first visible match;
  if one is still wrong, make the selector specific.
- **`failed file://…` entries** → a prototype opened from `file://` that reads its own URL gets
  net::ERR_FAILED (cross-origin for Chromium). That harmless case is not listed; missing assets,
  scripts and styles still are.
- **Clock, avatar, random IDs, live counters differ** → freeze time (`frozenTime`) and mask what
  stays dynamic. The union of both sides' masks (plus 1 px) is painted out on both images.
- **Different data on each side** → load the prototype's demo data in the implementation (fixture,
  seed, mocked API); `implementation.routes` answers the app's API requests with JSON files from
  the prototype's data. If impossible, mask data areas, compare shapes (widths, gaps, formats) only, and
  say it under "Límites". Verify by content, never by dates.
- **Selector measures the wrong element** → the first visible match is measured. Make selectors
  specific; prefer `data-*` hooks on the prototype side.
- **Shadow DOM** → selectors in the measuring expression use `document.querySelectorAll` and do not
  enter shadow roots; measure the host or add a light-DOM hook.
- **Captures of different sizes** (full page) → the extra area counts as different and the report
  warns; it usually means a missing or extra block.

## Authentication

- **Agent asked for credentials** → never. Use `--save-auth` (the user logs in), or the manual path
  in the user's browser.
- **`--save-auth` waits for Enter in a terminal that does not exist** → run it with
  `--wait-for <selector that only appears once logged in>` (or `auth.readySelector`); it gives up
  after `--timeout` seconds (default 600).
- **`storageState` file** → live cookies and storage (not sessionStorage). Keep it outside version
  control, readable only by the user, deleted at the end of the cycle. Sessions expire: re-create it
  when captures land on the login page (check the screenshot).
- **SSO that redirects to another domain** → `storageState` must include the app's own cookies; log
  in until the app itself is shown before pressing Enter (or pick a `--wait-for` selector that only
  the app itself shows).

## Claude vision

- Use it to describe differences between side-by-side images and to spot semantic drift. Do not let
  it decide pass/fail, count elements, or estimate sizes and colours: the vision docs call
  localisation and counting approximate. Large images are downscaled, so crop to the region first.
