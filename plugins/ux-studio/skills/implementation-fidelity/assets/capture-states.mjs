#!/usr/bin/env node
// Capture paired states of the prototype and the real implementation for a fidelity comparison.
//
// For every side x state x viewport x theme it: opens a fresh page with the same viewport, DPR,
// colour scheme, reduced motion, locale, time zone and frozen clock; disables CSS transitions and
// animations; runs the state's steps; waits for fonts; takes a screenshot; and snapshots the
// computed styles of the mapped elements (colours normalised to sRGB, motion values read with the
// animation-kill stylesheet off, rendered font through CDP) plus the rectangles to mask.
//
// Usage (run from a folder where playwright-core resolves: the workspace, a parent, NODE_PATH or a global install):
//   node capture-states.mjs --config fidelity.config.json [--side prototype|implementation|both]
//                           [--only <stateId>] [--out <dir>]
//   node capture-states.mjs --config fidelity.config.json --save-auth [--wait-for <css-selector>] [--timeout <seconds>]
//        Opens a visible browser on the implementation; you log in yourself. With --wait-for (or
//        implementation.auth.readySelector) the session is saved as soon as that selector is visible,
//        with no stdin; otherwise press Enter (needs a terminal). The wait gives up after --timeout
//        seconds (default 600). Writes implementation.auth.storageState (never commit that file).
//   node capture-states.mjs --config fidelity.config.json --print-snippet <stateId> [--side implementation]
//        Prints the in-page measuring expression, for capture through Claude in Chrome or
//        Chrome DevTools MCP when the app cannot be automated here (see references/method.md).
//
// Output: <outDir>/captures/<side>/<state>__<viewport>__<theme>.png and .json
// Exit codes: 0 ok, 1 error, 2 missing dependency or browser, 64 bad usage or arguments.
// --help prints the usage; --debug adds the stack trace to errors.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const KILL_STYLE_ID = '__fidelity_kill_motion__';
export const KILL_CSS =
  '*,*::before,*::after{transition:none!important;animation:none!important;scroll-behavior:auto!important}';
export const DEFAULT_PROPERTIES = [
  'color',
  'background-color',
  'border-top-color',
  'border-top-width',
  'border-top-left-radius',
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'font-feature-settings',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'width',
  'height',
  'box-shadow',
  'opacity',
];
export const SIDES = ['prototype', 'implementation'];

/* ------------------------------------------------------------------ shared helpers */

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
  if (!modulesDir || !fs.existsSync(path.join(modulesDir, name, 'package.json'))) return null;
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

/** Import an installed package (resolution order above), or null. */
export async function loadDependency(name) {
  const resolved = resolveDependency(name);
  return resolved ? import(pathToFileURL(resolved).href) : null;
}

/** Load all dependencies or print one install hint and exit 2. */
export async function requireDependencies(names) {
  const mods = {};
  const missing = [];
  for (const name of names) {
    const mod = await loadDependency(name);
    if (mod) mods[name] = mod;
    else missing.push(name);
  }
  if (missing.length) {
    process.stderr.write(
      `${installHint(missing)}\n`
    );
    process.exit(2);
  }
  return mods;
}

export class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
  }
}

/** Flags that never take a value, so the next token is not swallowed as one. */
const BOOLEAN_FLAGS = new Set(['help', 'debug', 'save-auth', 'headless']);

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h') {
      args.help = true;
      continue;
    }
    if (!a.startsWith('--')) {
      args._.push(a);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (BOOLEAN_FLAGS.has(key) || next === undefined || next.startsWith('--')) args[key] = true;
    else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

/** Throws a UsageError for any option the script does not know. */
export function assertKnownOptions(args, known) {
  for (const key of Object.keys(args)) {
    if (key !== '_' && !known.includes(key)) throw new UsageError(`unknown option --${key}`);
  }
}

/** The value of a flag that needs one (`--config x`), or a UsageError. */
export function requireValue(args, key, what) {
  const v = args[key];
  if (v === undefined || v === true) throw new UsageError(`missing ${what} (--${key})`);
  return v;
}

/**
 * Runs a CLI main: one-line errors with a usage hint (exit 64 for bad usage, 1 otherwise);
 * the stack only with --debug.
 */
export async function runCli(script, main, argv = process.argv.slice(2)) {
  try {
    await main();
  } catch (err) {
    const usage = err instanceof UsageError;
    const message = String(err?.message ?? err).split('\n')[0];
    process.stderr.write(`error: ${message}\n`);
    if (usage) process.stderr.write(`Run \`node ${script} --help\` for the usage.\n`);
    if (argv.includes('--debug')) process.stderr.write(`${err?.stack || err}\n`);
    process.exit(usage ? 64 : 1);
  }
}

/** Read the config and resolve outDir (relative to the config file, or --out relative to cwd). */
export function loadConfig(file, outOverride) {
  if (!file || file === true) throw new UsageError('missing --config <fidelity.config.json>');
  const configPath = path.resolve(file);
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    throw new UsageError(`cannot read the config ${configPath}: ${err.code === 'ENOENT' ? 'file not found' : err.message}`);
  }
  const dir = path.dirname(configPath);
  config.__dir = dir;
  config.__path = configPath;
  config.__out = outOverride ? path.resolve(outOverride) : path.resolve(dir, config.outDir || 'fidelity');
  config.viewports ||= [
    { id: 'web', width: 1440, height: 900, deviceScaleFactor: 1, capture: 'web' },
    { id: 'phone', width: 390, height: 844, deviceScaleFactor: 1, capture: 'phone', isMobile: true },
  ];
  config.themes ||= ['light'];
  config.states ||= [];
  config.elements ||= {};
  if (config.tokensCss) {
    const file = path.resolve(dir, config.tokensCss);
    if (!fs.existsSync(file)) throw new UsageError(`tokensCss file not found: ${file}`);
    config.__tokensCss = { path: file, css: fs.readFileSync(file, 'utf8') };
  }
  config.__routes = (config.implementation?.routes || []).map((route, i) => {
    const where = `implementation.routes[${i}]`;
    if (typeof route?.url !== 'string' || !route.url) throw new UsageError(`${where}: "url" (a glob or URL) is required`);
    if (typeof route.fulfill !== 'string' || !route.fulfill) throw new UsageError(`${where}: "fulfill" (a JSON file path) is required`);
    const file = path.resolve(dir, route.fulfill);
    if (!fs.existsSync(file)) throw new UsageError(`${where}: fixture file not found: ${file}`);
    const status = route.status ?? 200;
    if (!Number.isInteger(status) || status < 100 || status > 599) throw new UsageError(`${where}: "status" must be an HTTP status code`);
    return { url: route.url, status, body: fs.readFileSync(file) };
  });
  for (const state of config.states) {
    if (state.pending && (typeof state.reason !== 'string' || !state.reason.trim()))
      throw new UsageError(`state "${state.id}" is pending: add a "reason" saying why it is not measured yet`);
  }
  return config;
}

export const isPending = (state) => state.pending === true;

export const stateKey = (state, viewport, theme) => `${state.id}__${viewport.id}__${theme}`;

export const elementNamesFor = (config, state) =>
  (state.elements || Object.keys(config.elements)).filter((n) => !n.startsWith('$'));

export function propertiesFor(def) {
  const props = def.properties || DEFAULT_PROPERTIES;
  return props.includes('font-family') && !props.includes('rendered-font') ? [...props, 'rendered-font'] : props;
}

/* ------------------------------------------------------------------ in-page measurement */

/**
 * Runs inside the page (serialised by page.evaluate or pasted as a snippet): must stay self-contained.
 * Returns { meta, elements, masks }.
 */
export function snapshotInPage(arg) {
  const { elements, masks, killStyleId, killCss, extraCss } = arg;
  const MOTION = /^(transition|animation)(-|$)/;
  const GEOMETRY = { width: 1, height: 1, x: 1, y: 1 };
  const isColorProp = (p) => /(^|-)color$/.test(p) || p === 'fill' || p === 'stroke';
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const round = (v) => Math.round(v * 100) / 100;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const toRgba = (value) => {
    if (!value || !CSS.supports('color', value)) return null;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 1000) / 1000})`;
  };

  let kill = document.getElementById(killStyleId);
  let created = false;
  if (!kill) {
    kill = document.createElement('style');
    kill.id = killStyleId;
    kill.textContent = killCss + (extraCss || '');
    (document.head || document.documentElement).appendChild(kill);
    created = true;
  }

  const chosen = {};
  const out = {};
  for (const [name, spec] of Object.entries(elements)) {
    const all = [...document.querySelectorAll(spec.selector)];
    const el = all.find(visible) || null;
    out[name] = { selector: spec.selector, found: !!el, count: all.length, values: {}, colors: {} };
    if (!el) continue;
    chosen[name] = el;
    el.setAttribute('data-fidelity-key', name);
  }

  const read = (motion) => {
    for (const [name, el] of Object.entries(chosen)) {
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      for (const prop of elements[name].properties) {
        if (prop === 'rendered-font' || MOTION.test(prop) !== motion) continue;
        let value;
        if (GEOMETRY[prop]) {
          const v = prop === 'x' ? rect.left + scrollX : prop === 'y' ? rect.top + scrollY : rect[prop];
          value = `${round(v)}px`;
        } else value = cs.getPropertyValue(prop).trim();
        out[name].values[prop] = value;
        if (isColorProp(prop)) {
          const rgba = toRgba(value);
          if (rgba) out[name].colors[prop] = rgba;
        }
      }
    }
  };

  // Motion values first, with the kill stylesheet off (synchronous: no frame is painted in between).
  if (kill.sheet) kill.sheet.disabled = true;
  read(true);
  if (kill.sheet) kill.sheet.disabled = false;
  read(false);

  const maskRects = [];
  for (const sel of masks || []) {
    for (const el of document.querySelectorAll(sel)) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      maskRects.push({ selector: sel, x: round(r.left), y: round(r.top), width: round(r.width), height: round(r.height) });
    }
  }
  if (created && arg.removeKillStyle) kill.remove();

  return {
    meta: {
      url: location.href,
      innerWidth,
      innerHeight,
      devicePixelRatio,
      scrollX,
      scrollY,
      fontsStatus: document.fonts ? document.fonts.status : 'unknown',
      prefersDark: matchMedia('(prefers-color-scheme: dark)').matches,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      measuredAt: new Date().toISOString(),
    },
    elements: out,
    masks: maskRects,
  };
}

function pageArgs(config, state, side) {
  const elements = {};
  for (const name of elementNamesFor(config, state)) {
    const def = config.elements[name];
    if (!def || !def[side]) continue;
    elements[name] = { selector: def[side], properties: propertiesFor(def) };
  }
  const masks = [...(config.masks?.[side] || []), ...(state.masks?.[side] || [])];
  return { elements, masks, killStyleId: KILL_STYLE_ID, killCss: KILL_CSS, extraCss: config[side]?.css || '' };
}

/* ------------------------------------------------------------------ browser discovery */

const isExec = (p) => {
  try {
    const st = fs.statSync(p);
    return st.isFile() && (process.platform === 'win32' || (st.mode & 0o111) !== 0);
  } catch {
    return false;
  }
};

function findFiles(root, nameRe, depth) {
  const found = [];
  const walk = (dir, d) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory() && d > 0) walk(p, d - 1);
      else if (nameRe.test(e.name) && isExec(p)) found.push(p);
    }
  };
  walk(root, depth);
  const nums = (p) => (p.match(/\d+/g) || []).map(Number);
  return found.sort((a, b) => {
    const x = nums(a);
    const y = nums(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) if ((y[i] || 0) !== (x[i] || 0)) return (y[i] || 0) - (x[i] || 0);
    return 0;
  });
}

const which = (bin) => {
  const exts = process.platform === 'win32' ? ['.exe', ''] : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    for (const ext of exts) if (dir && isExec(path.join(dir, bin + ext))) return path.join(dir, bin + ext);
  }
  return null;
};

/** CHROME_PATH, then cached Chromium builds, then an installed Chrome/Chromium. */
export function findChrome({ headful = false } = {}) {
  if (process.env.CHROME_PATH) return isExec(process.env.CHROME_PATH) ? process.env.CHROME_PATH : null;
  const home = os.homedir();
  const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  const candidates = [];
  if (!headful) candidates.push(...findFiles(path.join(home, '.cache/hyperframes/chrome'), /^chrome-headless-shell(\.exe)?$/, 5));
  for (const root of [path.join(home, '.cache/ms-playwright'), path.join(home, 'Library/Caches/ms-playwright'), path.join(local, 'ms-playwright')]) {
    candidates.push(...findFiles(root, /^(chrome|chrome\.exe|Chromium|Google Chrome for Testing)$/, 6));
  }
  for (const bin of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome']) {
    const p = which(bin);
    if (p) candidates.push(p);
  }
  candidates.push(
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(local, 'Google\\Chrome\\Application\\chrome.exe')
  );
  return candidates.find(isExec) || null;
}

/* ------------------------------------------------------------------ navigation */

function toUrl(target, dir) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return new URL(target);
  return pathToFileURL(path.resolve(dir, target));
}

export function prototypeUrl(config, state, viewport, theme) {
  const url = toUrl(config.prototype.url, config.__dir);
  if (viewport.capture) url.searchParams.set('capture', viewport.capture);
  const hash = new URLSearchParams((state.prototype?.hash || '').replace(/^#/, ''));
  if (!hash.has('theme')) hash.set('theme', theme);
  if (!hash.has('motion')) hash.set('motion', 'reduced');
  url.hash = hash.toString();
  return url.href;
}

export function implementationUrl(config, state) {
  const base = toUrl(config.implementation.url, config.__dir);
  return new URL(state.implementation?.path || '', base).href;
}

/** The first VISIBLE match of a selector: a screen rendered twice (web frame + phone frame) hides one copy. */
const firstVisible = (page, selector) => page.locator(`${selector} >> visible=true`).first();

async function runSteps(page, steps = []) {
  for (const step of steps) {
    if ('click' in step) await firstVisible(page, step.click).click();
    else if ('fill' in step) await firstVisible(page, step.fill).fill(String(step.value ?? ''));
    else if ('hover' in step) await firstVisible(page, step.hover).hover();
    else if ('press' in step) await page.keyboard.press(step.press);
    else if ('waitFor' in step) await firstVisible(page, step.waitFor).waitFor({ state: 'visible' });
    else if ('wait' in step) await page.waitForTimeout(step.wait);
    else if ('goto' in step) await page.goto(new URL(step.goto, page.url()).href);
    else if ('scroll' in step) await firstVisible(page, step.scroll).scrollIntoViewIfNeeded();
    else if ('open' in step) await openShowcase(page, step.open);
    else if ('evaluate' in step) await page.evaluate(step.evaluate);
    else throw new Error(`Unknown step: ${JSON.stringify(step)}`);
  }
}

/** The showcase replaces itself with a `.sc-fatal` note and throws when it refuses to start (e.g. an undeclared ?capture= platform). */
async function failOnShowcaseReason(page) {
  const reason = await page.evaluate(() => document.querySelector('.sc-fatal')?.textContent?.trim() || null);
  if (reason) throw new Error(`The prototype refused to load: ${reason.replace(/\s+/g, ' ')}`);
}

async function openShowcase(page, to) {
  await page.waitForFunction(() => document.querySelector('.sc-fatal') || (window.SHOWCASE && typeof window.SHOWCASE.open === 'function'), null, { timeout: 15_000 });
  await failOnShowcaseReason(page);
  await page.evaluate((target) => window.SHOWCASE.open(target), to);
}

async function settle(page, side, config) {
  await page.waitForLoadState('load');
  await page.waitForLoadState('networkidle', { timeout: config.networkIdleTimeout ?? 5_000 }).catch(() => {});
  await page.evaluate(
    async ({ id, css }) => {
      if (!document.getElementById(id)) {
        const s = document.createElement('style');
        s.id = id;
        s.textContent = css;
        (document.head || document.documentElement).appendChild(s);
      }
      if (document.fonts) await document.fonts.ready;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    },
    { id: KILL_STYLE_ID, css: KILL_CSS + (config[side]?.css || '') }
  );
  if (config.settleMs) await page.waitForTimeout(config.settleMs);
}

/** Family name of the platform font that renders most glyphs of each tagged element (Chromium CDP). */
async function renderedFonts(page, names) {
  const out = {};
  if (!names.length) return out;
  let cdp;
  try {
    cdp = await page.context().newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: 1 });
    for (const name of names) {
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `[data-fidelity-key="${name}"]` });
      if (!nodeId) continue;
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      if (fonts?.length) out[name] = [...fonts].sort((a, b) => b.glyphCount - a.glyphCount)[0].familyName;
    }
  } catch {
    // Not Chromium or CDP unavailable: rendered-font simply stays unmeasured.
  } finally {
    await cdp?.detach().catch(() => {});
  }
  return out;
}

/* ------------------------------------------------------------------ main */

/**
 * A page opened from file:// that reads its own URL (fetch / XHR) is blocked as cross-origin:
 * Chromium reports net::ERR_FAILED and nothing is missing. Scripts, styles, images and any other
 * failure stay listed.
 */
export function isHarmlessFailure(request) {
  return (
    request.url().startsWith('file:') &&
    request.failure()?.errorText === 'net::ERR_FAILED' &&
    ['fetch', 'xhr', 'other'].includes(request.resourceType())
  );
}

async function captureSide(browser, config, side, states, executable) {
  const dir = path.join(config.__out, 'captures', side);
  fs.mkdirSync(dir, { recursive: true });
  const auth = side === 'implementation' ? config.implementation.auth || { method: 'none' } : { method: 'none' };
  let storageState;
  if (auth.method === 'storageState') {
    storageState = path.resolve(config.__dir, auth.storageState);
    if (!fs.existsSync(storageState)) throw new Error(`storageState not found: ${storageState} (create it with --save-auth)`);
  } else if (auth.method !== 'none') {
    throw new Error(`auth.method "${auth.method}" cannot be automated here; use --print-snippet (see references/method.md)`);
  }

  for (const viewport of config.viewports) {
    for (const theme of config.themes) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.deviceScaleFactor ?? 1,
        isMobile: !!viewport.isMobile,
        hasTouch: !!viewport.isMobile,
        colorScheme: theme === 'dark' ? 'dark' : 'light',
        reducedMotion: 'reduce',
        locale: config.locale,
        timezoneId: config.timezoneId,
        storageState,
      });
      if (config.frozenTime) await context.clock.setFixedTime(new Date(config.frozenTime));
      await context.addInitScript(
        ({ id, css }) => {
          const add = () => {
            if (document.getElementById(id) || !document.documentElement) return;
            const s = document.createElement('style');
            s.id = id;
            s.textContent = css;
            (document.head || document.documentElement).appendChild(s);
          };
          add();
          document.addEventListener('DOMContentLoaded', add);
        },
        { id: KILL_STYLE_ID, css: KILL_CSS + (config[side]?.css || '') }
      );

      for (const state of states) {
        if (isPending(state)) continue;
        const key = stateKey(state, viewport, theme);
        const page = await context.newPage();
        const problems = [];
        page.on('requestfailed', (r) => problems.length < 20 && !isHarmlessFailure(r) && problems.push(`failed ${r.url()} (${r.failure()?.errorText})`));
        page.on('response', (r) => r.status() >= 400 && problems.length < 20 && problems.push(`HTTP ${r.status()} ${r.url()}`));
        try {
          const spec = state[side] || {};
          if (side === 'prototype') {
            await page.goto(prototypeUrl(config, state, viewport, theme));
            await failOnShowcaseReason(page);
            if (spec.open) {
              await settle(page, side, config);
              await openShowcase(page, spec.open);
            }
          } else {
            for (const route of config.__routes) {
              await page.route(route.url, (r) => r.fulfill({ status: route.status, contentType: 'application/json', body: route.body }));
            }
            await page.goto(implementationUrl(config, state));
            await settle(page, side, config);
            await runSteps(page, config.implementation.themeSteps?.[theme]);
          }
          await settle(page, side, config);
          await runSteps(page, spec.steps);
          await settle(page, side, config);

          const scale = viewport.scale || 'css';
          await page.screenshot({
            path: path.join(dir, `${key}.png`),
            fullPage: !!state.fullPage,
            animations: 'disabled',
            caret: 'hide',
            scale,
          });
          const arg = pageArgs(config, state, side);
          const snap = await page.evaluate(snapshotInPage, arg);
          const fontNames = Object.keys(arg.elements).filter(
            (n) => snap.elements[n].found && arg.elements[n].properties.includes('rendered-font')
          );
          const fonts = await renderedFonts(page, fontNames);
          for (const [name, family] of Object.entries(fonts)) snap.elements[name].values['rendered-font'] = family;
          if (state.fullPage) for (const m of snap.masks) (m.x += snap.meta.scrollX), (m.y += snap.meta.scrollY);

          snap.meta = {
            ...snap.meta,
            side,
            state: state.id,
            viewport: { ...viewport, scale },
            theme,
            fullPage: !!state.fullPage,
            browser: browser.version(),
            executable: path.basename(executable),
            frozenTime: config.frozenTime || null,
            png: `${key}.png`,
            problems,
          };
          fs.writeFileSync(path.join(dir, `${key}.json`), JSON.stringify(snap, null, 1));
          console.log(`${side.padEnd(14)} ${key}`);
        } finally {
          await page.close();
        }
      }
      await context.close();
    }
  }
}

const DEFAULT_AUTH_TIMEOUT_S = 600;

async function saveAuth(chromium, config, args) {
  const auth = config.implementation.auth || {};
  const target = auth.storageState;
  if (!target) throw new UsageError('set implementation.auth.storageState to the file to write');
  const selector = args['wait-for'] !== undefined ? requireValue(args, 'wait-for', 'CSS selector') : auth.readySelector;
  const timeoutS = args.timeout !== undefined ? Number(args.timeout) : (auth.timeoutSeconds ?? DEFAULT_AUTH_TIMEOUT_S);
  if (!Number.isFinite(timeoutS) || timeoutS <= 0) throw new UsageError('--timeout must be a positive number of seconds');
  if (!selector && !process.stdin.isTTY)
    throw new UsageError(
      '--save-auth waits for Enter on a terminal and there is none here: pass --wait-for <css-selector> ' +
        '(or set implementation.auth.readySelector) with a selector that only exists once you are logged in'
    );
  const executablePath = findChrome({ headful: true });
  if (!executablePath) throw new Error('No visible Chrome/Chromium found; set CHROME_PATH');
  const browser = await chromium.launch({ executablePath, headless: !!args.headless });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(toUrl(config.implementation.url, config.__dir).href);
    if (selector) {
      console.log(`Log in in the opened window; the session is saved when ${selector} is visible (up to ${timeoutS} s)...`);
      try {
        await page.waitForSelector(selector, { state: 'visible', timeout: timeoutS * 1000 });
      } catch (err) {
        if (err?.name === 'TimeoutError') throw new Error(`Timed out after ${timeoutS} s waiting for ${selector} to be visible; nothing was saved`);
        throw err;
      }
    } else {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      let timer;
      const timedOut = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out after ${timeoutS} s waiting for Enter; nothing was saved`)), timeoutS * 1000);
      });
      try {
        await Promise.race([new Promise((r) => rl.question('Log in in the opened window, then press Enter here to save the session... ', r)), timedOut]);
      } finally {
        clearTimeout(timer);
        rl.close();
      }
    }
    const file = path.resolve(config.__dir, target);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const state = await context.storageState();
    fs.writeFileSync(file, JSON.stringify(state, null, 2), { mode: 0o600 });
    fs.chmodSync(file, 0o600); // mode only applies when the file is created
    console.log(`Session saved to ${file}. It holds live cookies: keep it out of version control and delete it when done.`);
  } finally {
    await browser.close();
  }
}

export const USAGE = `Usage:
  node capture-states.mjs --config <fidelity.config.json> [--side prototype|implementation|both]
                          [--only <stateId>] [--out <dir>] [--debug]
  node capture-states.mjs --config <file> --save-auth [--wait-for <css-selector>] [--timeout <seconds>]
  node capture-states.mjs --config <file> --print-snippet <stateId> [--side implementation]
  node capture-states.mjs --help

Options:
  --config <file>        fidelity.config.json (paths inside it are relative to the file)
  --side <side>          prototype, implementation or both (default both)
  --only <stateId>       capture a single state
  --out <dir>            output folder (default: outDir of the config)
  --save-auth            open a visible browser, log in yourself, save the session to
                         implementation.auth.storageState
  --wait-for <selector>  with --save-auth: save automatically once this CSS selector is visible
                         (config: implementation.auth.readySelector); no stdin needed
  --timeout <seconds>    with --save-auth: give up waiting (default 600)
  --headless             with --save-auth: do not show the browser (automation and tests)
  --print-snippet <id>   print the in-page measuring expression for a state
  --debug                print the stack trace of errors
  -h, --help             this text

Run it from a folder where playwright-core resolves. Exit codes: 0 ok, 1 error,
2 missing dependency or browser, 64 bad usage or arguments.
`;

const CAPTURE_OPTIONS = ['config', 'side', 'only', 'out', 'save-auth', 'wait-for', 'timeout', 'headless', 'print-snippet', 'debug', 'help'];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(USAGE);
    return;
  }
  assertKnownOptions(args, CAPTURE_OPTIONS);
  requireValue(args, 'config', 'config file');
  if (args.side !== undefined && !(args.side !== true && [...SIDES, 'both'].includes(args.side)))
    throw new UsageError('--side must be prototype, implementation or both');

  if (args['print-snippet']) {
    const config = loadConfig(args.config, args.out);
    const state = config.states.find((s) => s.id === args['print-snippet']);
    if (!state) throw new UsageError(`unknown state: ${args['print-snippet']}`);
    const side = args.side ?? 'implementation';
    if (!SIDES.includes(side)) throw new UsageError('--side must be prototype or implementation for --print-snippet');
    const arg = { ...pageArgs(config, state, side), removeKillStyle: true };
    process.stdout.write(`(${snapshotInPage.toString()})(${JSON.stringify(arg)})\n`);
    return;
  }

  const { 'playwright-core': pw } = await requireDependencies(['playwright-core']);
  const chromium = pw.chromium || pw.default?.chromium;
  const config = loadConfig(args.config, args.out);
  if (args['save-auth']) return saveAuth(chromium, config, args);

  const executable = findChrome();
  if (!executable) {
    process.stderr.write(
      (process.env.CHROME_PATH ? `CHROME_PATH=${process.env.CHROME_PATH} is not an executable file.\n` : '') +
        'No Chromium-family browser found. Set CHROME_PATH to a Chrome/Chromium binary, or install Google Chrome.\n' +
        'Looked in: CHROME_PATH, ~/.cache/hyperframes/chrome/**/chrome-headless-shell, ~/.cache/ms-playwright/**/chrome, google-chrome, chromium.\n'
    );
    process.exit(2);
  }
  const sides = !args.side || args.side === 'both' ? SIDES : [args.side];
  const states = config.states.filter((s) => !args.only || s.id === args.only);
  if (!states.length) throw new UsageError('no states to capture (check "states" and --only)');

  for (const state of states.filter(isPending)) console.log(`${'pending'.padEnd(14)} ${state.id} (${state.reason.trim()})`);
  if (states.every(isPending)) {
    console.log('Every selected state is pending: nothing to capture.');
    return;
  }
  const browser = await chromium.launch({ executablePath: executable, headless: true });
  try {
    for (const side of sides) await captureSide(browser, config, side, states, executable);
  } finally {
    await browser.close();
  }
  console.log(`Captures in ${path.join(config.__out, 'captures')} (browser ${path.basename(executable)})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runCli('capture-states.mjs', main);
}
