#!/usr/bin/env node
/**
 * extract-styles.mjs — screenshot a page at several widths and inventory the computed styles
 * of its visible elements, ranked by frequency. Input for the existing-site audit.
 *
 *   node extract-styles.mjs <url-or-file> --out <dir> [--widths 1440,390]
 *
 * Writes <dir>/screenshot-<width>.png (full page) and <dir>/styles.json.
 * Needs `playwright-core` resolvable from the current folder, NODE_PATH or the global npm root
 * (workspace `npm i -D playwright-core`, or once `npm i -g playwright-core`) and a
 * local Chromium-family browser: CHROME_PATH, HyperFrames' chrome-headless-shell, a Playwright
 * browser cache, google-chrome or chromium. It never downloads a browser.
 *
 * Exit codes: 0 ok · 1 capture failed · 2 usage error or playwright-core missing · 3 no browser.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const USAGE = 'usage: node extract-styles.mjs <url-or-file> --out <dir> [--widths 1440,390]';
const MAX_SAMPLES = 3;
const MAX_ENTRIES = 120;

// ---------------------------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { input: null, out: null, widths: [1440, 390], help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--out' || arg === '--widths') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} needs a value`);
      i += 1;
      if (arg === '--out') args.out = value;
      else {
        args.widths = value.split(',').map((w) => Number.parseInt(w.trim(), 10));
        if (args.widths.some((w) => !Number.isInteger(w) || w < 200 || w > 3840)) {
          throw new Error(`--widths takes comma-separated pixel widths between 200 and 3840, got ${value}`);
        }
      }
    } else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}`);
    else if (args.input) throw new Error(`unexpected argument ${arg}`);
    else args.input = arg;
  }
  return args;
}

function toUrl(input) {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) return input;
  const file = path.resolve(input);
  if (!existsSync(file)) throw new Error(`${input} is neither a URL nor an existing file`);
  return pathToFileURL(file).href;
}

// ---------------------------------------------------------------------------------------------
// playwright-core and a browser binary
// ---------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Dependency resolution (kept per skill on purpose, so each skill stays self-contained).
// Order: the current folder and its parents, NODE_PATH, the global npm node_modules
// (UX_STUDIO_GLOBAL_NODE_MODULES, else `npm root -g`, else derived from the node binary),
// then next to this script.

let globalRootCache;

function globalNodeModules() {
  const override = process.env.UX_STUDIO_GLOBAL_NODE_MODULES;
  if (override) return override;
  if (globalRootCache !== undefined) return globalRootCache;
  const win = process.platform === 'win32';
  let root = null;
  try {
    const res = win
      ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm.cmd root -g'], { encoding: 'utf8', timeout: 5000 })
      : spawnSync('npm', ['root', '-g'], { encoding: 'utf8', timeout: 5000 });
    const line = res.status === 0 ? String(res.stdout).trim().split(/\r?\n/).pop() : '';
    if (line) root = line;
  } catch {
    // npm not runnable: derive the location below
  }
  if (!root) {
    const bin = path.dirname(process.execPath);
    root = win ? path.join(bin, 'node_modules') : path.join(path.dirname(bin), 'lib', 'node_modules');
  }
  globalRootCache = root;
  return root;
}

function resolveIn(modulesDir, name) {
  if (!modulesDir || !existsSync(path.join(modulesDir, name, 'package.json'))) return null;
  try {
    return createRequire(path.join(modulesDir, 'noop.js')).resolve(name);
  } catch {
    return null;
  }
}

/** Absolute entry file of an installed package, or null. */
function resolveDependency(name) {
  try {
    return createRequire(path.join(process.cwd(), 'noop.js')).resolve(name);
  } catch {
    // not in the project tree
  }
  for (const dir of String(process.env.NODE_PATH ?? '').split(path.delimiter)) {
    const found = resolveIn(dir, name);
    if (found) return found;
  }
  const global = resolveIn(globalNodeModules(), name);
  if (global) return global;
  try {
    return createRequire(fileURLToPath(import.meta.url)).resolve(name);
  } catch {
    return null;
  }
}

/** Install guidance for missing packages: git-ignored workspace or one global install. */
function installHint(names) {
  const list = names.join(' ');
  return [
    `${list} ${names.length > 1 ? 'are' : 'is'} not installed where this script can find it. Install ${names.length > 1 ? 'them' : 'it'} either:`,
    `  - in the git-ignored workspace (per project; run the script from there): npm init -y && npm i -D ${list}   (inside e.g. tmp/)`,
    `  - once for every project: npm i -g ${list}`,
    "Never add it to a product's package.json. Neither option downloads a browser.",
  ].join('\n');
}

async function loadChromium() {
  const resolved = resolveDependency('playwright-core');
  if (!resolved) return null;
  const mod = await import(pathToFileURL(resolved).href);
  return mod.chromium ?? mod.default?.chromium ?? null;
}

/** Executable files named one of `names` under `dir` (bounded depth), newest version first. */
function findUnder(dir, names, depth = 6) {
  if (!dir || !existsSync(dir)) return [];
  const found = [];
  const walk = (current, level) => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory() && level < depth) walk(full, level + 1);
      else if (entry.isFile() && names.includes(entry.name)) found.push(full);
    }
  };
  walk(dir, 0);
  return found.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
}

function onPath(name) {
  const exts = process.platform === 'win32' ? ['.exe', ''] : [''];
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    for (const ext of exts) {
      const full = path.join(dir, name + ext);
      try {
        if (dir && statSync(full).isFile()) return full;
      } catch {
        // not here
      }
    }
  }
  return null;
}

/** The first Chromium-family browser found, in the documented order. */
export function findBrowser() {
  if (process.env.CHROME_PATH) {
    return existsSync(process.env.CHROME_PATH)
      ? process.env.CHROME_PATH
      : { error: `CHROME_PATH is set to ${process.env.CHROME_PATH}, which does not exist` };
  }
  const home = os.homedir();
  const shells = ['chrome-headless-shell', 'chrome-headless-shell.exe'];
  const chromes = ['chrome', 'chrome.exe', 'Chromium', 'Google Chrome for Testing'];
  const playwrightCaches = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(home, '.cache', 'ms-playwright'),
    path.join(home, 'Library', 'Caches', 'ms-playwright'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright'),
  ];
  const programFiles = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
  const candidates = [
    ...findUnder(path.join(home, '.cache', 'hyperframes', 'chrome'), shells),
    ...playwrightCaches.flatMap((dir) => findUnder(dir, chromes)),
    onPath('google-chrome'),
    onPath('google-chrome-stable'),
    onPath('chromium'),
    onPath('chromium-browser'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ...programFiles.map((dir) => path.join(dir, 'Google', 'Chrome', 'Application', 'chrome.exe')),
  ];
  return candidates.find((file) => file && existsSync(file)) ?? null;
}

// ---------------------------------------------------------------------------------------------
// In-page inventory (serialized into the page by Playwright; must stay self-contained)
// ---------------------------------------------------------------------------------------------

function inventoryPage({ maxSamples }) {
  const SKIP = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'HEAD', 'TITLE', 'NOSCRIPT', 'TEMPLATE', 'BR', 'WBR']);
  const TEXT_CONTROLS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const hexCache = new Map();
  const byte = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');

  function toHex(value) {
    if (!value || value === 'transparent') return null;
    if (hexCache.has(value)) return hexCache.get(value);
    let rgba = null;
    const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(value);
    if (m) {
      const alpha = m[4] === undefined ? 1 : m[4].endsWith('%') ? Number.parseFloat(m[4]) / 100 : Number.parseFloat(m[4]);
      rgba = [Number(m[1]), Number(m[2]), Number(m[3]), alpha];
    } else {
      // oklch(), lab(), color(display-p3 …): let the canvas map it to sRGB (approximate for wide gamut).
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = value;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      rgba = [r, g, b, a / 255];
    }
    const hex = rgba[3] <= 0 ? null : `#${byte(rgba[0])}${byte(rgba[1])}${byte(rgba[2])}${rgba[3] < 1 ? byte(rgba[3] * 255) : ''}`;
    hexCache.set(value, hex);
    return hex;
  }

  function describe(el) {
    let label = el.tagName.toLowerCase();
    if (el.id) label += `#${el.id}`;
    const classes = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean) : [];
    if (classes.length) label += `.${classes.slice(0, 2).join('.')}`;
    return label.length > 60 ? `${label.slice(0, 57)}...` : label;
  }

  const bag = {};
  function add(category, value, el) {
    if (value === null || value === undefined || value === '') return;
    bag[category] ??= {};
    const entry = (bag[category][value] ??= { count: 0, samples: [] });
    entry.count += 1;
    const label = describe(el);
    if (entry.samples.length < maxSamples && !entry.samples.includes(label)) entry.samples.push(label);
  }

  const isVisible = (el, cs) => {
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  let scanned = 0;
  for (const el of document.querySelectorAll('*')) {
    if (SKIP.has(el.tagName)) continue;
    const cs = getComputedStyle(el);
    if (!isVisible(el, cs)) continue;
    scanned += 1;

    const hasText = TEXT_CONTROLS.has(el.tagName)
      || [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim() !== '');
    if (hasText) {
      add('text', toHex(cs.color), el);
      add('fontFamilies', cs.fontFamily, el);
      add('fontSizes', cs.fontSize, el);
      add('lineHeights', cs.lineHeight, el);
      add('fontWeights', cs.fontWeight, el);
    }
    add('background', toHex(cs.backgroundColor), el);
    const borderColors = new Set();
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      const width = Number.parseFloat(cs[`border${side}Width`]);
      const style = cs[`border${side}Style`];
      if (width > 0 && style !== 'none' && style !== 'hidden') borderColors.add(toHex(cs[`border${side}Color`]));
    }
    for (const color of borderColors) add('border', color, el);
    const corners = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius];
    if (corners.some((c) => Number.parseFloat(c) > 0)) add('radii', new Set(corners).size === 1 ? corners[0] : corners.join(' '), el);
    const spacing = [
      cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft,
      cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft,
      cs.rowGap, cs.columnGap,
    ];
    for (const value of new Set(spacing)) {
      if (/^\d*\.?\d+px$/.test(value) && Number.parseFloat(value) > 0) add('spacing', value, el);
    }
    if (cs.boxShadow && cs.boxShadow !== 'none') add('shadows', cs.boxShadow, el);
  }

  const ground = [document.documentElement, document.body]
    .filter(Boolean)
    .map((el) => toHex(getComputedStyle(el).backgroundColor))
    .find(Boolean);
  return { bag, scanned, pageBackground: ground ?? '#ffffff' };
}

// ---------------------------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------------------------

async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  // Walk down once so lazy content and scroll-triggered styles render, then return to the top.
  await page.evaluate(async () => {
    const step = Math.max(200, window.innerHeight * 0.8);
    for (let y = 0, i = 0; y < document.documentElement.scrollHeight && i < 40; y += step, i += 1) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
    await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 3000))]);
  }).catch(() => {});
  await page.waitForTimeout(250);
}

function merge(perWidth) {
  const categories = ['text', 'background', 'border', 'fontFamilies', 'fontSizes', 'lineHeights', 'fontWeights', 'radii', 'spacing', 'shadows'];
  const merged = {};
  for (const category of categories) {
    const byValue = new Map();
    for (const { width, bag } of perWidth) {
      for (const [value, { count, samples }] of Object.entries(bag[category] ?? {})) {
        const entry = byValue.get(value) ?? { value, count: 0, widths: [], samples: [] };
        entry.count += count;
        entry.widths.push(width);
        for (const s of samples) if (entry.samples.length < MAX_SAMPLES && !entry.samples.includes(s)) entry.samples.push(s);
        byValue.set(value, entry);
      }
    }
    merged[category] = [...byValue.values()]
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, undefined, { numeric: true }))
      .slice(0, MAX_ENTRIES);
  }
  return merged;
}

async function capture(chromium, executablePath, url, outDir, widths) {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const perWidth = [];
    const screenshots = [];
    for (const width of widths) {
      const mobile = width < 768;
      const context = await browser.newContext({
        viewport: { width, height: mobile ? 844 : 900 },
        deviceScaleFactor: 1,
        isMobile: mobile,
        hasTouch: mobile,
      });
      try {
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'load', timeout: 45_000 });
        await settle(page);
        const file = `screenshot-${width}.png`;
        await page.screenshot({ path: path.join(outDir, file), fullPage: true });
        const { bag, scanned, pageBackground } = await page.evaluate(inventoryPage, { maxSamples: MAX_SAMPLES });
        perWidth.push({ width, bag, scanned, pageBackground });
        screenshots.push({ width, file });
      } finally {
        await context.close();
      }
    }
    const merged = merge(perWidth);
    return {
      source: url,
      capturedAt: new Date().toISOString(),
      browser: `Chromium ${browser.version()}`,
      widths,
      screenshots,
      elementsScanned: Object.fromEntries(perWidth.map((w) => [w.width, w.scanned])),
      pageBackground: perWidth[0]?.pageBackground ?? null,
      colors: { text: merged.text, background: merged.background, border: merged.border },
      fontFamilies: merged.fontFamilies,
      fontSizes: merged.fontSizes,
      lineHeights: merged.lineHeights,
      fontWeights: merged.fontWeights,
      radii: merged.radii,
      spacing: merged.spacing,
      shadows: merged.shadows,
      notes: [
        'Computed styles of visible elements only; counts are summed across widths.',
        'Colors are sRGB hex (#rrggbbaa when translucent); wide-gamut colors are mapped to sRGB and are approximate.',
        'samples name where a value appears (tag#id.class); open the screenshots to see it.',
      ],
    };
  } finally {
    await browser.close();
  }
}

export async function main(argv = process.argv.slice(2)) {
  let args;
  let url;
  try {
    args = parseArgs(argv);
    if (args.help) {
      process.stdout.write(`${USAGE}\n`);
      return 0;
    }
    if (!args.input || !args.out) throw new Error('a URL or file and --out <dir> are required');
    url = toUrl(args.input);
  } catch (error) {
    process.stderr.write(`error: ${error.message}\n${USAGE}\n`);
    return 2;
  }

  const chromium = await loadChromium();
  if (!chromium) {
    process.stderr.write(`${installHint(['playwright-core'])}\n`);
    return 2;
  }
  const browser = findBrowser();
  if (!browser || typeof browser !== 'string') {
    process.stderr.write([
      browser?.error ?? 'No Chromium-family browser found.',
      'Looked in: CHROME_PATH, ~/.cache/hyperframes/chrome/**/chrome-headless-shell, the Playwright browser cache (**/chrome), google-chrome, chromium.',
      'Install Google Chrome or Chromium, or set CHROME_PATH to a Chrome/Chromium executable.',
    ].join('\n') + '\n');
    return 3;
  }

  const outDir = path.resolve(args.out);
  mkdirSync(outDir, { recursive: true });
  try {
    const styles = await capture(chromium, browser, url, outDir, args.widths);
    writeFileSync(path.join(outDir, 'styles.json'), `${JSON.stringify(styles, null, 2)}\n`);
    const c = styles.colors;
    process.stdout.write(
      `Captured ${url} at ${args.widths.join(', ')}px with ${styles.browser}\n`
      + `  ${c.text.length} text, ${c.background.length} background, ${c.border.length} border colors; `
      + `${styles.fontFamilies.length} font stacks; ${styles.fontSizes.length} sizes; ${styles.radii.length} radii\n`
      + `  wrote ${path.join(outDir, 'styles.json')} and ${styles.screenshots.map((s) => s.file).join(', ')}\n`,
    );
    return 0;
  } catch (error) {
    process.stderr.write(`error: capture failed for ${url}: ${error.message}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main();
}
