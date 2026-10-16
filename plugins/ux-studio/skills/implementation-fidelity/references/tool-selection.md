# Tool selection for implementation fidelity

Pick the tool by the question being asked, not by habit. Numbers decide pass/fail; images and
vision only point where to look. Evidence below was checked on 2026-10-15; versions are the npm
`latest` on that date.

## Decision table

| Situation | Tool | Why | Caveat |
|---|---|---|---|
| App reachable by a script (local, staging, demo data) | Playwright through `capture-states.mjs` (`playwright-core` + an existing Chromium) | One browser for both sides; viewport, DPR, colour scheme, reduced motion, locale, time zone and clock fixed per context; screenshot and `getComputedStyle` in the same run | Pixels are only comparable on the same OS, browser build and fonts |
| App data that differs from the prototype's demo data | `implementation.routes` in the config: Playwright `page.route` answers matching requests with JSON files, before navigation | Both sides show the same records without a seeded backend or masking | Covers requests the app makes to an API; server-rendered data needs a seed or a mask |
| Login or SSO the agent must not handle | The user logs in once with `capture-states.mjs --save-auth` (Playwright `storageState`; `--wait-for <selector>` saves it without a terminal), then the automated path | Credentials never reach the agent | The file is a live session: outside version control, deleted after the cycle |
| The app only works in the user's own browser (VPN, device certificate, MFA every time) | Claude in Chrome, or Chrome DevTools MCP attached to that Chrome, running the `--print-snippet` expression | Measures the real session without exporting it | Per-site permission; background tabs freeze animation (see gotchas); screenshots may not reach disk, so only the style diff is guaranteed |
| Which CSS rule wins (framework overrides, inherited `font-feature-settings`, primary colour from the UI kit) | Chrome DevTools MCP `get_css_styles` | Matched, inherited and overridden declarations plus custom properties | Chrome only; one element at a time |
| Responsive and device emulation, CPU or network throttling | Chrome DevTools MCP `emulate` / `resize_page`, or the viewport list in the config | Reproduces phone conditions and slow devices | Each `emulate` call replaces the previous emulation settings |
| Layout drift (position, size, missing or extra blocks) | Pixel diff with masks: pixelmatch in `compare.mjs`; odiff for large batches | Localises every changed area fast | Says where, never why; dynamic data, fonts and OS move pixels |
| Colour | CIEDE2000 on computed colours normalised to sRGB (`delta-e.mjs`) | Perceptual, exact, free of antialiasing noise | Translucent colours are composited over white; alpha is compared separately |
| Typography | Computed `font-family`, `font-size`, `font-weight`, `line-height`, `letter-spacing`, `font-feature-settings` plus the rendered font through CDP | The declared stack is not the font on screen | `rendered-font` needs Chromium CDP (automated path only) |
| Motion | Computed `transition-*` / `animation-*` durations and easings, plus a recorded video (Playwright `recordVideo` or DevTools MCP `screencast_start`) for feel | Durations are numbers; feel needs frames | JS-driven animations (Web Animations API, animation libraries) are not in computed CSS |
| Accessibility kept while chasing fidelity | axe-core (`@axe-core/playwright`), DevTools MCP `lighthouse_audit` | A pixel-faithful change must not break contrast or semantics | Automated checks find only part of the problems |
| Finding selectors and steps for the element map | Playwright MCP (`browser_snapshot`) or DevTools MCP `take_snapshot` | Accessibility tree, no vision needed | Exploration only, never the measurement |
| "Does it feel the same?" (chart type, hierarchy, density, tone) | Side-by-side images reviewed by Claude vision and by the human | Catches what no property list names | Never the pass/fail metric |
| Regression after fidelity was accepted | Playwright `toHaveScreenshot` in the product's test suite; BackstopJS (`referenceUrl`) or reg-suit | Baselines in CI | Compares the product with itself; baselines per OS |
| Team wants a hosted review and approval UI | Percy, Chromatic, Applitools (paid) | Review workflows, browser grids | Cost; screenshots leave the network; not evaluated here |

Not recommended for new work: Lost Pixel (repository archived; the team announced it is sunsetting
the product). Resemble.js only if node-canvas installs cleanly where it must run.

## Evidence (facts, with source)

**Playwright** — https://playwright.dev/docs/api/class-pageassertions , /docs/test-snapshots , /docs/clock , /docs/auth , /docs/accessibility-testing (all read 2026-10-15; `playwright-core` 1.64.1)
- `toHaveScreenshot` options: `animations` (default `"disabled"`: finite animations fast-forwarded to the end, infinite ones reset), `caret` (default `"hide"`), `mask` (locators painted with `maskColor`, default `#FF00FF`, since 1.35), `maxDiffPixelRatio` (0–1), `maxDiffPixels`, `scale` (`"css"` default, or `"device"`), `stylePath` (since 1.41), `threshold` default 0.2, "an acceptable perceived color difference in the YIQ color space".
- "Browser rendering can vary based on the host OS, version, settings, hardware, power source (battery vs. power adapter), headless mode, and other factors." and "For consistent screenshots, run tests in the same environment where the baseline screenshots were generated."
- Clock: `setFixedTime` makes `Date.now()` and `new Date()` return a fixed time while timers keep running; `install` enables `pauseAt`, `runFor`.
- `storageState` saves cookies, local storage and IndexedDB, not sessionStorage. "The browser state file may contain sensitive cookies and headers that could be used to impersonate you or your test account"; the docs put it in a git-ignored folder.
- `@axe-core/playwright` (4.14.0): `AxeBuilder({ page }).withTags().include().exclude().analyze()`. "Many accessibility problems can only be discovered through manual testing."

**pixelmatch 8.0.0** — https://github.com/mapbox/pixelmatch (read 2026-10-15)
- `pixelmatch(img1, img2, output, width, height, options)` returns the number of mismatched pixels; same dimensions required. Options: `threshold` 0.1, `includeAA` false (antialiased pixels ignored), `ignoreMask`, `diffColor`, `alpha`.
- Colour metric: OKLab (Ottosson 2020) with HyAB distance (Abasi et al. 2019); antialiasing detection after Vyšniauskas (2009). ES module only (`"type": "module"`).

**odiff 4.5.0** (`odiff-bin`) — https://github.com/dmtrKovalenko/odiff (read 2026-10-15)
- Zig with SIMD; PNG, JPEG, WebP, TIFF; `ignoreRegions`, `antialiasing`, `threshold`; compares images of different layouts unless `failOnLayoutDiff`. The project's own benchmark: about 1.17 s against about 7.7 s for pixelmatch on two full-page screenshots (their hardware).

**looks-same 10.0.1** — https://github.com/gemini-testing/looks-same (read 2026-10-15)
- Non-strict `tolerance` is a ΔE value, default 2.3, "enough for the most cases"; ignores antialiasing and caret by default; `createDiff` writes or returns the diff. The README does not name the ΔE formula.

**Resemble.js 5.0.0** — https://github.com/rsmbl/Resemble.js (read 2026-10-15)
- Diff image through `outputDiff`; `ignoreColors`, `ignoreAntialiasing`; Node use depends on node-canvas, which "can fail to install in some environments"; `scaleToSameSize` resizes the second image.

**SSIM (ssim.js 3.5.0)** — https://github.com/obartra/ssim (read 2026-10-15)
- Mean SSIM 0–1 after Wang et al. (2004), "Image Quality Assessment: From Error Visibility to Structural Similarity"; runs in Node.

**BackstopJS 6.3.25** — https://github.com/garris/BackstopJS ; **reg-suit 0.14.5** — https://github.com/reg-viz/reg-suit ; **Lost Pixel** — https://github.com/lost-pixel/lost-pixel (read 2026-10-15)
- BackstopJS: scenarios × viewports, `hideSelectors` / `removeSelectors`, `misMatchThreshold` (default 0.1 %), Puppeteer or Playwright, Docker rendering, HTML report; `referenceUrl` takes the baseline from another URL.
- reg-suit compares a folder of images with stored ones (S3, GCS) and reports to GitHub; it does not capture.
- Lost Pixel: repository archived; the team is joining Figma and sunsetting the product.

**CIEDE2000** — G. Sharma, W. Wu, E. N. Dalal, Color Research and Application 30(1):21–30, 2005; test data https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/ (34 pairs; `delta-e.mjs` matches all to 4 decimals).
- Perception bands (≤ 1 not perceptible, 1–2 perceptible through close observation, 2–10 perceptible at a glance) come from http://zschuessler.github.io/DeltaE/learn/ , which states the table "is built from the author's own tests and does not come from an authority source". Treat them as a rule of thumb.

**Chrome DevTools MCP 1.11.0** — https://github.com/ChromeDevTools/chrome-devtools-mcp and docs/tool-reference.md (read 2026-10-15)
- Tools include `emulate` (`colorScheme`, `cpuThrottlingRate`, `networkConditions`, `prefersReducedMotion`, `viewport`, `userAgent`, …; each call replaces earlier settings except extra headers), `resize_page`, `take_screenshot` (`fullPage`, element `uid`, `filePath`), `evaluate_script` (`filePath`), `get_css_styles` (matched rules, inherited styles, custom properties, overridden marked), `lighthouse_audit` (`device`, `mode`), `screencast_start` / `screencast_stop`.
- Officially supports Google Chrome and Chrome for Testing; usage statistics on by default (`--no-usage-statistics`); performance tools may send trace URLs to CrUX (`--no-performance-crux`). Connecting to an already running Chrome is described in its Advanced Usage guide (not verified here).

**Playwright MCP 0.0.83** — https://github.com/microsoft/playwright-mcp (read 2026-10-15)
- Works on accessibility snapshots, not pixels; `--storage-state`, `--isolated`, `--user-data-dir`, `--extension` (attach to a running Chrome or Edge), `--viewport-size`, `--device`, `--caps vision,pdf,devtools`. "Not a security boundary."

**Claude in Chrome** — https://support.claude.com/en/articles/12902428-using-claude-in-chrome-safely (read 2026-10-15)
- Advises a separate browser profile without sensitive accounts; prompt injection is "the biggest risk facing browser-using AI tools"; Claude "takes screenshots of the tabs it's working in". Per-domain approval before running JavaScript is reported in Anthropic's help centre (seen in search results, not re-read here).

**Hidden tabs** — https://developer.chrome.com/blog/timer-throttling-in-chrome-88 (2021-01-18) and https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- Hidden pages: timers checked once per second, once per minute after 5 minutes hidden; "`requestAnimationFrame` will wait for the page to be visible"; MDN: rAF calls "are paused in most browsers when running in background tabs".

**Claude vision** — https://platform.claude.com/docs/en/build-with-claude/vision (read 2026-10-15)
- Coordinates and localisation are approximate, counts approximate, images under 200 px unreliable; images above the model's long-edge limit are downscaled; "Do not use Claude for tasks requiring perfect precision … without human oversight."

## Recommendations (opinion)

- Default stack: `capture-states.mjs` + `compare.mjs`. Free, local, scriptable, and it measures
  values (ΔE, px), so a fix is a concrete value change rather than "make it look closer".
- Measure colour and typography on computed styles; use pixels to find what the element map
  misses, then add those elements to the map.
- Keep pixel thresholds per viewport. 2 % of a 1440 × 900 frame is about 26,000 pixels, enough to
  hide a wrong button. Small changes are caught by the style diff, not by the ratio.
- Hosted services pay off for large teams that review screenshots daily. They are not needed to
  compare an implementation with a prototype.
