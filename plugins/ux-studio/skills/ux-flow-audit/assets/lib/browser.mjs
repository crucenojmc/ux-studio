// Shared by nav-graph.mjs and space-audit.mjs: find an existing Chromium-family
// browser (never downloads one) and load playwright-core.
//
// Browser search order: CHROME_PATH, ~/.cache/hyperframes/chrome/**/chrome-headless-shell,
// the Playwright cache (~/.cache/ms-playwright/**/chrome), then google-chrome / chromium on PATH.
// playwright-core is resolved from the current project, NODE_PATH, the global npm root, then next to this script.

import { spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MissingDependency } from './cli.mjs';

export const BROWSER_HINT = [
  'No Chromium-family browser found. This tool never downloads one. Either:',
  '  - set CHROME_PATH=/path/to/chrome (any Chrome, Chromium or chrome-headless-shell), or',
  '  - install HyperFrames (its cache provides chrome-headless-shell), or',
  '  - install Google Chrome / Chromium so google-chrome or chromium is on PATH.',
  'Run the ux-studio:ux-env-setup skill for guided checks.',
].join('\n');

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
export function resolveDependency(name) {
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

export const PLAYWRIGHT_HINT = installHint(['playwright-core']);

function isExecutable(file) {
  try {
    if (!statSync(file).isFile()) return false;
    if (process.platform !== 'win32') accessSync(file, constants.X_OK);
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
    if (!entry.isDirectory() && names.includes(entry.name)) found.push(full);
    else if (entry.isDirectory() && depth > 0) found.push(...findFiles(full, names, depth - 1));
  }
  return found;
}

const newestFirst = (paths) => {
  const collator = new Intl.Collator('en', { numeric: true });
  return [...paths].sort((a, b) => collator.compare(b, a));
};

/** Resolve an installed Chromium-family executable, or null. */
export function findBrowser(env = process.env) {
  if (env.CHROME_PATH && isExecutable(env.CHROME_PATH)) return { path: env.CHROME_PATH, source: 'CHROME_PATH' };
  const home = env.HOME || os.homedir();
  const cache = env.XDG_CACHE_HOME || path.join(home, '.cache');

  const headless = newestFirst(findFiles(path.join(home, '.cache/hyperframes/chrome'), ['chrome-headless-shell', 'chrome-headless-shell.exe'], 6))
    .find(isExecutable);
  if (headless) return { path: headless, source: 'hyperframes-cache' };

  const pwDir = env.PLAYWRIGHT_BROWSERS_PATH && env.PLAYWRIGHT_BROWSERS_PATH !== '0'
    ? env.PLAYWRIGHT_BROWSERS_PATH
    : path.join(cache, 'ms-playwright');
  const pw = newestFirst(findFiles(pwDir, ['chrome', 'chrome.exe'], 7)).find(isExecutable);
  if (pw) return { path: pw, source: 'playwright-cache' };

  const delimiter = process.platform === 'win32' ? ';' : ':';
  const commands = process.platform === 'win32'
    ? ['chrome.exe', 'chromium.exe']
    : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
  for (const dir of String(env.PATH ?? '').split(delimiter).filter(Boolean)) {
    for (const cmd of commands) {
      const file = path.join(dir, cmd);
      if (isExecutable(file)) return { path: file, source: 'PATH' };
    }
  }
  return null;
}

async function loadPlaywright() {
  const resolved = resolveDependency('playwright-core');
  if (!resolved) return null;
  const mod = await import(pathToFileURL(resolved).href);
  return mod.chromium ? mod : mod.default;
}

/** Launch headless Chromium or throw MissingDependency with an actionable hint. */
export async function launchBrowser() {
  const pw = await loadPlaywright();
  if (!pw) throw new MissingDependency(PLAYWRIGHT_HINT);
  const found = findBrowser();
  if (!found) throw new MissingDependency(BROWSER_HINT);
  return pw.chromium.launch({ executablePath: found.path, headless: true, args: ['--hide-scrollbars'] });
}

/**
 * A showcase that refuses to start (e.g. `?capture=` for a platform `LAYOUT.platforms` does not
 * declare) replaces itself with a `.sc-fatal` note and throws, so `window.SHOWCASE` never appears.
 * Throws a one-line error with that reason; does nothing on any other page.
 */
export async function failOnShowcaseReason(page) {
  const reason = await page.evaluate(() => document.querySelector('.sc-fatal')?.textContent?.trim() || null);
  if (reason) throw new Error(`The prototype refused to load: ${reason.replace(/\s+/g, ' ')}`);
}
