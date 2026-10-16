// Shared helpers for the prototype-showcase smoke tests.
// Uses an existing Chromium-family binary; never downloads browsers.
import { existsSync, readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir } from 'node:os';
import { chromium } from 'playwright-core';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, '../..');
export const SKILL = join(REPO, 'plugins/ux-studio/skills/prototype-showcase');
export const TEMPLATE = join(SKILL, 'assets/showcase-template.html');
export const PREVIEW = join(SKILL, 'assets/preview.mjs');
export const OUT = join(REPO, 'test-results/prototype-showcase');

function findFiles(dir, names, depth = 6, found = []) {
  if (depth < 0 || !existsSync(dir)) return found;
  let entries = [];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return found; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) findFiles(p, names, depth - 1, found);
    else if (names.includes(e.name)) found.push(p);
  }
  return found;
}

function newestFirst(paths) {
  return paths.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
}

function which(bin) {
  try {
    return execFileSync('sh', ['-c', `command -v ${bin}`], { encoding: 'utf8' }).trim() || null;
  } catch { return null; }
}

/** Resolve an existing Chromium-family executable. Order: CHROME_PATH, HyperFrames shell, Playwright cache, system. */
export function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const home = homedir();
  const hyper = newestFirst(findFiles(join(home, '.cache/hyperframes/chrome'), ['chrome-headless-shell']));
  if (hyper.length) return hyper[0];
  const pw = newestFirst(findFiles(join(home, '.cache/ms-playwright'), ['chrome']));
  if (pw.length) return pw[0];
  for (const bin of ['google-chrome', 'chromium', 'chromium-browser']) {
    const p = which(bin);
    if (p) return p;
  }
  return null;
}

const LAYOUT_RE = /const LAYOUT = (\{[^;]*\});/;

/** The template's own `const LAYOUT = {...};` object. */
export function templateLayout() {
  const m = readFileSync(TEMPLATE, 'utf8').match(LAYOUT_RE);
  if (!m) throw new Error('showcase-template.html declares no `const LAYOUT = {...};`');
  return new Function(`return (${m[1]});`)();
}

/**
 * Wrap the template fragment with preview.mjs and return a file:// URL.
 * `layout` overrides keys of the template's LAYOUT (mode, sections, ...);
 * `edit` rewrites the template source (for product shapes such as a removed frame).
 */
export function buildPreview(name = 'preview.html', { layout, edit } = {}) {
  mkdirSync(OUT, { recursive: true });
  let fragment = TEMPLATE;
  if (layout || edit) {
    let src = readFileSync(TEMPLATE, 'utf8');
    if (layout) src = src.replace(LAYOUT_RE, `const LAYOUT = ${JSON.stringify({ ...templateLayout(), ...layout })};`);
    if (edit) src = edit(src);
    fragment = join(OUT, name.replace(/\.html$/, '.fragment.html'));
    writeFileSync(fragment, src);
  }
  const out = join(OUT, name);
  execFileSync(process.execPath, [PREVIEW, fragment, out], { stdio: 'pipe' });
  return pathToFileURL(out).href;
}

export async function launch() {
  const executablePath = findChrome();
  if (!executablePath) throw new Error('No Chromium-family browser found. Set CHROME_PATH.');
  return chromium.launch({ executablePath, headless: true });
}

/**
 * Open the showcase in a fresh context. Google Fonts requests are answered with an
 * empty stylesheet so the run is deterministic and offline-safe.
 */
export async function openPage(browser, { url, viewport = { width: 1440, height: 900 }, colorScheme = 'light', reducedMotion = 'no-preference' } = {}) {
  const context = await browser.newContext({ viewport, colorScheme, reducedMotion });
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  await page.waitForFunction(() => window.SHOWCASE && window.SHOWCASE.version === '1', null, { timeout: 10000 });
  return { context, page, errors };
}

/** WCAG relative-luminance contrast between two CSS colors resolved by the browser. */
export async function contrastPairs(page, pairs) {
  return page.evaluate((list) => {
    const probe = document.createElement('div');
    document.body.appendChild(probe);
    const rgb = (token) => {
      probe.style.color = `var(${token})`;
      const m = getComputedStyle(probe).color.match(/[\d.]+/g).map(Number);
      return m.slice(0, 3);
    };
    const lum = ([r, g, b]) => {
      const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const out = list.map(([fg, bg]) => {
      const a = lum(rgb(fg)); const b = lum(rgb(bg));
      return { fg, bg, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
    });
    probe.remove();
    return out;
  }, pairs);
}
