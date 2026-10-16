#!/usr/bin/env node
// Capture every step of the showcase user flows as deterministic screenshots.
//
//   node capture-flows.mjs --url <http-url-of-wrapped-showcase> --out <dir>
//        [--view web|phone] [--size 1920x1080] [--scale 1] [--theme dark|light]
//        [--flow <id>|all] [--timeout 30000]
//
// Talks to the page through the window.SHOWCASE v1 contract (see
// references/capture-contract.md): loads the URL with ?capture=<view>&motion=reduced
// [&theme=...], waits for SHOWCASE.version === "1", then for each selected flow and step
// awaits SHOWCASE.open(step.to, { view }), screenshots the viewport to
// <out>/<flow>/<NN>-<slug>.png and records SHOWCASE.targetRect(step.target, view).
// Writes <out>/storyboard.json.
//
// Needs playwright-core resolvable from the current folder, NODE_PATH or the global npm root
// (workspace `npm i -D playwright-core` or once `npm i -g playwright-core`; it never downloads browsers) and an existing Chromium-family binary: CHROME_PATH, the
// HyperFrames cache, the Playwright cache, or google-chrome / chromium on PATH.
//
// Exit codes: 0 ok · 1 usage or capture error · 2 playwright-core missing · 3 no browser.

import { spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, mkdirSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export const EXIT = Object.freeze({ OK: 0, ERROR: 1, NO_PLAYWRIGHT: 2, NO_BROWSER: 3 });

const DEFAULT_SIZE = { web: { width: 1920, height: 1080 }, phone: { width: 390, height: 844 } };
const DEFAULT_SCALE = { web: 1, phone: 2 };

const USAGE = `Usage: node capture-flows.mjs --url <http-url-of-wrapped-showcase> --out <dir>
       [--view web|phone] [--size WxH] [--scale 1-4] [--theme dark|light]
       [--flow <id>|all] [--timeout <ms>]
Defaults: web 1920x1080 @1x, phone 390x844 @2x, all flows, 30000 ms.`;

export function slugify(text, max = 48) {
  const slug = String(text ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
  return slug || 'step';
}

// ---------------------------------------------------------------------------
// Browser discovery: never downloads, only finds what is already installed.

function isExecutable(file, platform) {
  try {
    if (!statSync(file).isFile()) return false;
    if (platform !== 'win32') accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findFiles(dir, names, depth) {
  const found = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (names.includes(entry.name) && !entry.isDirectory()) found.push(full);
    else if (entry.isDirectory() && depth > 0) found.push(...findFiles(full, names, depth - 1));
  }
  return found;
}

const newestFirst = (paths) => {
  const collator = new Intl.Collator('en', { numeric: true });
  return [...paths].sort((a, b) => collator.compare(b, a));
};

function playwrightCacheDirs(env, platform, home) {
  if (env.PLAYWRIGHT_BROWSERS_PATH && env.PLAYWRIGHT_BROWSERS_PATH !== '0') return [env.PLAYWRIGHT_BROWSERS_PATH];
  if (platform === 'darwin') return [path.join(home, 'Library/Caches/ms-playwright')];
  if (platform === 'win32') return [path.join(env.LOCALAPPDATA || path.join(home, 'AppData/Local'), 'ms-playwright')];
  return [path.join(env.XDG_CACHE_HOME || path.join(home, '.cache'), 'ms-playwright')];
}

export function findBrowser({ env = process.env, platform = process.platform, home = os.homedir() } = {}) {
  const ok = (file) => file && isExecutable(file, platform);

  if (ok(env.CHROME_PATH)) return { path: env.CHROME_PATH, source: 'CHROME_PATH' };

  const hyperframesCache = path.join(home, '.cache/hyperframes/chrome');
  const shell = newestFirst(findFiles(hyperframesCache, ['chrome-headless-shell', 'chrome-headless-shell.exe'], 6)).find(ok);
  if (shell) return { path: shell, source: 'hyperframes-cache' };

  const pwNames = ['chrome', 'chrome.exe', 'Chromium', 'Google Chrome for Testing'];
  for (const dir of playwrightCacheDirs(env, platform, home)) {
    const pw = newestFirst(findFiles(dir, pwNames, 7)).find(ok);
    if (pw) return { path: pw, source: 'playwright-cache' };
  }

  const delimiter = platform === 'win32' ? ';' : ':';
  const commands = platform === 'win32'
    ? ['chrome.exe', 'chromium.exe']
    : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
  for (const dir of String(env.PATH ?? '').split(delimiter).filter(Boolean)) {
    for (const cmd of commands) {
      const file = path.join(dir, cmd);
      if (ok(file)) return { path: file, source: 'PATH' };
    }
  }

  const system = platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium']
    : platform === 'win32'
      ? [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA]
          .filter(Boolean)
          .map((root) => path.join(root, 'Google/Chrome/Application/chrome.exe'))
      : [];
  const installed = system.find(ok);
  return installed ? { path: installed, source: 'system' } : null;
}

// ---------------------------------------------------------------------------
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

async function loadPlaywright() {
  const resolved = resolveDependency('playwright-core');
  if (!resolved) return null;
  const mod = await import(pathToFileURL(resolved).href);
  return mod.chromium ? mod : mod.default;
}

// ---------------------------------------------------------------------------

class UsageError extends Error {}

export function parseCliArgs(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        url: { type: 'string' },
        out: { type: 'string' },
        view: { type: 'string', default: 'web' },
        size: { type: 'string' },
        scale: { type: 'string' },
        theme: { type: 'string' },
        flow: { type: 'string', default: 'all' },
        timeout: { type: 'string', default: '30000' },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
  } catch (err) {
    throw new UsageError(err.message);
  }
  const v = parsed.values;
  if (v.help) return { help: true };
  if (!v.url) throw new UsageError('Missing --url <http-url-of-wrapped-showcase>.');
  if (!v.out) throw new UsageError('Missing --out <dir>.');
  let url;
  try {
    url = new URL(v.url);
  } catch {
    throw new UsageError(`--url is not a valid URL: ${v.url}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UsageError(
      '--url must be http(s). Wrap the fragment with preview.mjs, serve its folder ' +
        '(e.g. `python3 -m http.server 8080`) and pass http://localhost:8080/preview.html.',
    );
  }
  if (!['web', 'phone'].includes(v.view)) throw new UsageError('--view must be web or phone.');
  if (v.theme !== undefined && !['dark', 'light'].includes(v.theme)) throw new UsageError('--theme must be dark or light.');
  let size = DEFAULT_SIZE[v.view];
  if (v.size !== undefined) {
    const m = /^(\d{2,5})x(\d{2,5})$/.exec(v.size);
    if (!m) throw new UsageError('--size must look like 1920x1080.');
    size = { width: Number(m[1]), height: Number(m[2]) };
  }
  const scale = v.scale === undefined ? DEFAULT_SCALE[v.view] : Number(v.scale);
  if (!Number.isFinite(scale) || scale < 1 || scale > 4) throw new UsageError('--scale must be a number from 1 to 4.');
  const timeout = Number(v.timeout);
  if (!Number.isInteger(timeout) || timeout <= 0) throw new UsageError('--timeout must be a positive integer (ms).');
  return { url, out: path.resolve(v.out), view: v.view, size, scale, theme: v.theme ?? null, flow: v.flow, timeout };
}

const round = (n) => Math.round(n * 100) / 100;

function normalizeRect(rect) {
  if (!rect || typeof rect !== 'object') return null;
  const keys = ['x', 'y', 'width', 'height'];
  if (!keys.every((k) => Number.isFinite(rect[k]))) return null;
  return Object.fromEntries(keys.map((k) => [k, round(rect[k])]));
}

async function capture(chromium, executablePath, opts, warn) {
  const { url, out, view, size, scale, theme, timeout } = opts;
  url.searchParams.set('capture', view);
  url.searchParams.set('motion', 'reduced');
  if (theme) url.searchParams.set('theme', theme);

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none'],
  });
  try {
    const context = await browser.newContext({
      viewport: size,
      deviceScaleFactor: scale,
      reducedMotion: 'reduce',
      ...(theme ? { colorScheme: theme } : {}),
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => msg.type() === 'error' && pageErrors.push(msg.text()));

    await page.goto(url.href, { waitUntil: 'load', timeout });
    try {
      await page.waitForFunction(() => window.SHOWCASE && 'version' in window.SHOWCASE, null, { timeout });
    } catch {
      // A showcase that refuses the request (e.g. ?capture= of an undeclared platform) says why.
      const reason = pageErrors.length ? ` The page reported: ${pageErrors.join(' | ')}` : '';
      throw new Error(
        `window.SHOWCASE did not appear within ${timeout} ms at ${url.href}. ` +
          'Is this the wrapped showcase page (preview.mjs output) served over http?' +
          reason,
      );
    }
    const version = await page.evaluate(() => window.SHOWCASE.version);
    if (version !== '1') {
      throw new Error(`Unsupported window.SHOWCASE version ${JSON.stringify(version)}; this script speaks version "1".`);
    }

    const flows = await page.evaluate(() => window.SHOWCASE.flows());
    const selected = opts.flow === 'all' ? flows : flows.filter((f) => f.id === opts.flow);
    if (selected.length === 0) {
      throw new Error(`Unknown flow "${opts.flow}". Available: ${flows.map((f) => f.id).join(', ') || '(none)'}.`);
    }

    mkdirSync(out, { recursive: true });
    const storyboard = { source: url.href, view, size, scale, theme, flows: [] };
    const usedDirs = new Set();
    for (const flow of selected) {
      let dir = slugify(flow.id);
      for (let n = 2; usedDirs.has(dir); n++) dir = `${slugify(flow.id)}-${n}`;
      usedDirs.add(dir);
      mkdirSync(path.join(out, dir), { recursive: true });

      const steps = [];
      for (const [i, step] of (flow.steps ?? []).entries()) {
        const where = `flow "${flow.id}" step ${i + 1}`;
        try {
          await page.evaluate(
            async ([to, v, ms]) => {
              const opened = window.SHOWCASE.open(to, { view: v });
              const late = new Promise((_, reject) => setTimeout(() => reject(new Error(`open() took over ${ms} ms`)), ms));
              await Promise.race([opened, late]);
              if (document.fonts) await document.fonts.ready;
              await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            },
            [step.to, view, timeout],
          );
        } catch (err) {
          throw new Error(`SHOWCASE.open failed on ${where}: ${err.message}`);
        }
        const image = `${dir}/${String(i + 1).padStart(2, '0')}-${slugify(step.label)}.png`;
        await page.screenshot({ path: path.join(out, image), type: 'png', animations: 'disabled', caret: 'hide' });

        const target = step.target ?? null;
        let targetRect = null;
        if (target) {
          targetRect = normalizeRect(
            await page.evaluate(([sel, v]) => window.SHOWCASE.targetRect(sel, v), [target, view]),
          );
          if (!targetRect) warn(`target ${target} not found on ${where}.`);
          else if (
            targetRect.x < 0 || targetRect.y < 0 ||
            targetRect.x + targetRect.width > size.width || targetRect.y + targetRect.height > size.height
          ) {
            warn(`target ${target} on ${where} lies partly outside the ${size.width}x${size.height} viewport.`);
          }
        }
        steps.push({ index: i + 1, label: step.label ?? '', say: step.say ?? null, to: step.to, image, target, targetRect });
      }
      storyboard.flows.push({
        id: flow.id,
        title: flow.title ?? '',
        role: flow.role ?? null,
        lede: flow.lede ?? null,
        steps,
      });
    }
    writeFileSync(path.join(out, 'storyboard.json'), `${JSON.stringify(storyboard, null, 2)}\n`);
    if (pageErrors.length) {
      warn(`the page reported ${pageErrors.length} error(s): ${pageErrors.slice(0, 5).join(' | ')}`);
    }
    return storyboard;
  } finally {
    await browser.close();
  }
}

export async function main(argv) {
  let opts;
  try {
    opts = parseCliArgs(argv);
  } catch (err) {
    if (!(err instanceof UsageError)) throw err;
    console.error(`${err.message}\n${USAGE}`);
    return EXIT.ERROR;
  }
  if (opts.help) {
    console.log(USAGE);
    return EXIT.OK;
  }

  const playwright = await loadPlaywright();
  if (!playwright) {
    console.error(installHint(['playwright-core']));
    return EXIT.NO_PLAYWRIGHT;
  }
  const browser = findBrowser();
  if (!browser) {
    console.error(
      'No Chromium-family browser found. Set CHROME_PATH to an existing Chrome/Chromium binary, ' +
        'or (with the user\'s OK, ~260 MB) run `npx hyperframes browser ensure`, then retry.',
    );
    return EXIT.NO_BROWSER;
  }
  if (process.env.CHROME_PATH && browser.source !== 'CHROME_PATH') {
    console.error(`Warning: CHROME_PATH is not an executable file; using ${browser.path} (${browser.source}).`);
  }

  try {
    const sb = await capture(playwright.chromium, browser.path, opts, (msg) => console.error(`Warning: ${msg}`));
    const steps = sb.flows.reduce((n, f) => n + f.steps.length, 0);
    console.log(
      `Captured ${steps} step(s) from ${sb.flows.length} flow(s) ` +
        `(${sb.view} ${sb.size.width}x${sb.size.height} @${sb.scale}x, ${browser.source}) -> ` +
        path.join(opts.out, 'storyboard.json'),
    );
    return EXIT.OK;
  } catch (err) {
    console.error(`Error: ${err.message}`);
    return EXIT.ERROR;
  }
}

const isMain = (() => {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (isMain) process.exitCode = await main(process.argv.slice(2));
