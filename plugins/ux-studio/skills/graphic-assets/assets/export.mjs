#!/usr/bin/env node
// Render an SVG or a one-file HTML piece to PNG at given sizes and device pixel ratios, with presets
// for app icons, social formats and the favicon set (plus favicon.ico). Uses playwright-core and an
// existing Chromium-family browser; never downloads one.
//
// SVG inputs are inlined in a blank page and scaled to the viewport (preserveAspectRatio applies);
// currentColor takes --color; the background is transparent unless --background is given. SVG
// inputs must be self-contained (no relative image references). HTML inputs open from disk, so
// their relative assets (tokens.css, fonts, images) load; the viewport is the requested size.
// Motion is disabled and fonts are awaited before each capture.
//
// Usage (run from a folder where playwright-core resolves: the workspace, a parent, NODE_PATH or a global install):
//   node export.mjs --input <file.svg|file.html> (--out <dir> | --topic <name>)
//                   (--preset <name>[,<name>…] | --size <W>x<H>[,…]) [--dpr 1,2,3] [--name <base>]
//                   [--background <css colour>|transparent] [--color <css colour>] [--wait <ms>]
//   node export.mjs --list-presets
//
// Output: PNGs and manifest.json (every output with its source file and SHA-256) in the output folder.
// Exit codes: 0 ok, 1 error, 2 missing dependency or browser, 64 bad usage or arguments.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  EXIT,
  UsageError,
  assertKnownOptions,
  isMain,
  parseArgs,
  requireValue,
  resolveOutDir,
  runCli,
  sourceRecord,
  writeFileAtomic,
  writeManifest,
} from './lib/cli.mjs';

const TOOL = 'export.mjs';
const KILL_CSS = '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}';
const MAX_PIXELS = 16384;

const square = (id, size) => ({ id, width: size, height: size });

/** Presets. `fixed`: final pixel sizes (DPR 1 only). Favicon targets carry conventional file names. */
export const PRESETS = {
  'app-icon': {
    fixed: true,
    description: 'iOS and Android launcher sizes, final pixels; needs an opaque --background',
    targets: [
      square('ios-marketing', 1024),
      square('ios-iphone-3x', 180),
      square('ios-ipad-pro-2x', 167),
      square('ios-ipad-2x', 152),
      square('ios-iphone-2x', 120),
      square('android-play', 512),
      square('android-xxxhdpi', 192),
      square('android-xxhdpi', 144),
      square('android-xhdpi', 96),
      square('android-hdpi', 72),
      square('android-mdpi', 48),
    ],
  },
  favicon: {
    fixed: true,
    description: 'favicon 16/32/48, apple-touch-icon 180, android-chrome 192/512 and favicon.ico (16, 32, 48)',
    targets: [
      { file: 'favicon-16x16.png', width: 16, height: 16 },
      { file: 'favicon-32x32.png', width: 32, height: 32 },
      { file: 'favicon-48x48.png', width: 48, height: 48 },
      { file: 'apple-touch-icon.png', width: 180, height: 180 },
      { file: 'android-chrome-192x192.png', width: 192, height: 192 },
      { file: 'android-chrome-512x512.png', width: 512, height: 512 },
    ],
    ico: [16, 32, 48],
  },
  'social-square': { description: 'feed post 1:1', targets: [{ id: 'social-square', width: 1080, height: 1080 }] },
  'social-portrait': { description: 'feed post 4:5', targets: [{ id: 'social-portrait', width: 1080, height: 1350 }] },
  'social-link': { description: 'link preview card 1.91:1', targets: [{ id: 'social-link', width: 1200, height: 630 }] },
  'social-landscape': { description: 'banner, cover or slide 16:9', targets: [{ id: 'social-landscape', width: 1920, height: 1080 }] },
};
const GROUPS = { social: ['social-square', 'social-portrait', 'social-link', 'social-landscape'] };

/* ------------------------------------------------------------------ dependencies and browser */

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

/** Load all dependencies or print one install hint and exit 2. */
export async function requireDependencies(names) {
  const mods = {};
  const missing = [];
  for (const name of names) {
    const resolved = resolveDependency(name);
    if (resolved) mods[name] = await import(pathToFileURL(resolved).href);
    else missing.push(name);
  }
  if (missing.length) {
    process.stderr.write(`${installHint(missing)}\n`);
    process.exit(EXIT.MISSING_DEPENDENCY);
  }
  return mods;
}

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
export function findChrome() {
  if (process.env.CHROME_PATH) return isExec(process.env.CHROME_PATH) ? process.env.CHROME_PATH : null;
  const home = os.homedir();
  const local = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  const candidates = [...findFiles(path.join(home, '.cache/hyperframes/chrome'), /^chrome-headless-shell(\.exe)?$/, 5)];
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

/* ------------------------------------------------------------------ targets */

const list = (v) => String(v).split(',').map((s) => s.trim()).filter(Boolean);

/** Expand --preset and --size into render targets { file, width, height, dpr, preset }. */
export function planTargets({ presets = [], sizes = [], dprs = [1], base }) {
  const names = presets.flatMap((p) => GROUPS[p] ?? [p]);
  for (const p of names) if (!PRESETS[p]) throw new UsageError(`unknown preset "${p}" (run --list-presets)`);
  const fixed = names.filter((p) => PRESETS[p].fixed);
  if (fixed.length && dprs.some((d) => d !== 1)) throw new UsageError(`${fixed.join(', ')} sizes are final pixels: use --dpr 1 with ${fixed.length > 1 ? 'them' : 'it'}`);
  if (!names.length && !sizes.length) throw new UsageError('missing what to render (--preset <name> or --size <W>x<H>)');

  const targets = [];
  for (const p of names) {
    for (const t of PRESETS[p].targets) {
      if (t.file) targets.push({ file: t.file, width: t.width, height: t.height, dpr: 1, preset: p });
      else if (PRESETS[p].fixed) targets.push({ file: `${base}-${t.id}-${t.width}x${t.height}.png`, width: t.width, height: t.height, dpr: 1, preset: p });
      else for (const dpr of dprs) targets.push({ file: `${base}-${t.id}-${t.width}x${t.height}@${dpr}x.png`, width: t.width, height: t.height, dpr, preset: p });
    }
  }
  for (const s of sizes) {
    const m = /^(\d+)x(\d+)$/.exec(s);
    if (!m) throw new UsageError(`--size takes <width>x<height> in CSS pixels, such as 24x24 (got "${s}")`);
    const [width, height] = [Number(m[1]), Number(m[2])];
    for (const dpr of dprs) targets.push({ file: `${base}-${width}x${height}@${dpr}x.png`, width, height, dpr, preset: null });
  }
  for (const t of targets) {
    if (!(t.width > 0 && t.height > 0 && t.width * t.dpr <= MAX_PIXELS && t.height * t.dpr <= MAX_PIXELS))
      throw new UsageError(`${t.file}: each side must be between 1 and ${MAX_PIXELS} device pixels`);
  }
  return [...new Map(targets.map((t) => [t.file, t])).values()];
}

/** A multi-size .ico whose entries embed PNG data. */
export function icoFromPngs(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, buffer }, k) => {
    const e = 6 + 16 * k;
    header[e] = size >= 256 ? 0 : size;
    header[e + 1] = size >= 256 ? 0 : size;
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(buffer.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += buffer.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.buffer)]);
}

const pngSize = (buf) => ({ width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) });

/* ------------------------------------------------------------------ rendering */

/** The SVG markup ready to inline: no prolog or doctype, a viewBox so it scales. */
export function inlineSvg(text) {
  const svg = text.replace(/<\?xml[\s\S]*?\?>/, '').replace(/<!DOCTYPE[^>]*>/i, '').trim();
  const root = /^(?:<!--[\s\S]*?-->\s*)*<svg\b[^>]*>/.exec(svg)?.[0];
  if (!root) throw new Error('the SVG input has no <svg> root element');
  if (/\sviewBox=/.test(root)) return svg;
  const dim = (name) => Number(new RegExp(`\\s${name}="([\\d.]+)(?:px)?"`).exec(root)?.[1]);
  const [w, h] = [dim('width'), dim('height')];
  if (!(w > 0 && h > 0)) throw new Error('the SVG input needs a viewBox (or numeric width and height) to scale');
  return svg.replace(root, root.replace(/^<svg\b/, `<svg viewBox="0 0 ${w} ${h}"`));
}

const svgPage = (svg, { background, color }) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;` +
  `background:${background ?? 'transparent'};color:${color}}body>svg{display:block;width:100%;height:100%}${KILL_CSS}</style></head><body>${svg}</body></html>`;

async function renderTargets(chromium, executable, job, targets) {
  const browser = await chromium.launch({ executablePath: executable, headless: true });
  const transparent = job.background === 'transparent' || (job.kind === 'svg' && !job.background);
  try {
    for (const t of targets) {
      const context = await browser.newContext({ viewport: { width: t.width, height: t.height }, deviceScaleFactor: t.dpr, reducedMotion: 'reduce' });
      try {
        const page = await context.newPage();
        if (job.kind === 'svg') await page.setContent(svgPage(job.svg, { ...job, background: transparent ? 'transparent' : job.background }), { waitUntil: 'load' });
        else {
          await page.goto(job.url, { waitUntil: 'load' });
          const bg = transparent ? 'transparent' : job.background;
          await page.addStyleTag({ content: KILL_CSS + (bg ? `html,body{background:${bg}!important}` : '') });
        }
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        if (job.wait) await page.waitForTimeout(job.wait);
        // A fresh context may not have produced a frame yet; capturing then fails under load.
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        t.buffer = await page.screenshot({ type: 'png', omitBackground: transparent });
        const got = pngSize(t.buffer);
        const want = { width: Math.round(t.width * t.dpr), height: Math.round(t.height * t.dpr) };
        if (got.width !== want.width || got.height !== want.height)
          throw new Error(`${t.file}: rendered ${got.width}×${got.height}, expected ${want.width}×${want.height}`);
        Object.assign(t, { pixelWidth: got.width, pixelHeight: got.height });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

/* ------------------------------------------------------------------ CLI */

export const USAGE = `Usage:
  node export.mjs --input <file.svg|file.html> (--out <dir> | --topic <name>)
                  (--preset <name>[,<name>…] | --size <W>x<H>[,…]) [--dpr 1,2,3] [--name <base>]
                  [--background <css colour>|transparent] [--color <css colour>] [--wait <ms>]
  node export.mjs --list-presets
  node export.mjs --help

Options:
  --input <file>        an SVG (self-contained) or a one-file HTML piece
  --out <dir>           output folder; use a distinct one per parallel run. Inside a git work tree it
                        must be git-ignored (never a product repository)
  --topic <name>        instead of --out: tmp/<name>/graphics/ at the git root of the current folder
  --preset <names>      comma-separated presets (--list-presets); "social" is every social size
  --size <WxH,…>        CSS-pixel sizes, such as 24x24,32x32
  --dpr <list>          device pixel ratios for --size and the social presets, 1 to 4 (default 1);
                        app-icon and favicon sizes are final pixels (DPR 1 only)
  --name <base>         file name base (default: the input file name)
  --background <css>    background colour, or transparent (default: transparent for SVG, the
                        page's own for HTML)
  --color <css>         currentColor for SVG inputs (default #000000); use the token's value
  --wait <ms>           extra settle time before each capture (default 0)
  --list-presets        print the presets and their sizes
  --debug               print the stack trace of errors
  -h, --help            this text

Run it from a folder where playwright-core resolves. Writes PNGs (favicon.ico with the favicon
preset) and manifest.json. Exit codes: 0 ok, 1 error, 2 missing dependency or browser,
64 bad usage or arguments.
`;

const OPTIONS = ['input', 'out', 'topic', 'preset', 'size', 'dpr', 'name', 'background', 'color', 'wait', 'list-presets', 'debug', 'help'];

function presetTable() {
  const rows = Object.entries(PRESETS).map(([name, p]) => {
    const sizes = p.targets.map((t) => (t.file ? `${t.file.replace(/\.png$/, '')}` : `${t.width}x${t.height}`)).join(', ');
    return `${name.padEnd(17)} ${p.description}\n${' '.repeat(18)}${sizes}${p.ico ? `, favicon.ico (${p.ico.join(', ')})` : ''}`;
  });
  rows.push(`${'social'.padEnd(17)} every social preset: ${GROUPS.social.join(', ')}`);
  return `${rows.join('\n')}\n`;
}

/** A CSS colour value that cannot break out of the style rule it is written into. */
function cssColour(args, key) {
  if (args[key] === undefined) return undefined;
  const v = requireValue(args, key, 'CSS colour');
  if (!/^[#\w\s(),.%/+-]{1,64}$/.test(v)) throw new UsageError(`--${key} must be a plain CSS colour such as #1d2330, rgb(…) or transparent`);
  return v;
}

async function main() {
  const args = parseArgs(process.argv.slice(2), new Set(['list-presets', 'debug', 'help']));
  if (args.help) return void process.stdout.write(USAGE);
  if (args['list-presets']) return void process.stdout.write(presetTable());
  assertKnownOptions(args, OPTIONS);

  const input = path.resolve(requireValue(args, 'input', 'input file'));
  if (!fs.existsSync(input)) throw new UsageError(`cannot read the input ${input}: file not found`);
  const ext = path.extname(input).toLowerCase();
  if (!['.svg', '.html', '.htm'].includes(ext)) throw new UsageError(`--input must be an .svg or .html file (got ${path.basename(input)})`);
  const base = args.name !== undefined ? requireValue(args, 'name', 'file name base') : path.basename(input, path.extname(input));
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(base)) throw new UsageError(`--name must hold only letters, digits, dots, hyphens and underscores (got "${base}")`);
  const dprs = args.dpr === undefined ? [1] : list(requireValue(args, 'dpr', 'DPR list')).map(Number);
  if (!dprs.length || dprs.some((d) => !(d >= 1 && d <= 4))) throw new UsageError('--dpr takes ratios between 1 and 4, such as 1,2,3');
  const targets = planTargets({
    presets: args.preset === undefined ? [] : list(requireValue(args, 'preset', 'preset name')),
    sizes: args.size === undefined ? [] : list(requireValue(args, 'size', 'size')),
    dprs,
    base,
  });
  const background = cssColour(args, 'background');
  const color = cssColour(args, 'color') ?? '#000000';
  const wait = args.wait === undefined ? 0 : Number(requireValue(args, 'wait', 'milliseconds'));
  if (!(Number.isInteger(wait) && wait >= 0 && wait <= 60000)) throw new UsageError('--wait takes whole milliseconds between 0 and 60000');
  const out = resolveOutDir(args);

  const job = { kind: ext === '.svg' ? 'svg' : 'html', background, color, wait };
  if (job.kind === 'svg') job.svg = inlineSvg(fs.readFileSync(input, 'utf8'));
  else job.url = pathToFileURL(input).href;
  if (targets.some((t) => PRESETS[t.preset]?.fixed) && (!background || background === 'transparent'))
    process.stderr.write('warning: app icons and touch icons need an opaque --background (iOS fills transparency with black)\n');

  const { 'playwright-core': pw } = await requireDependencies(['playwright-core']);
  const chromium = pw.chromium || pw.default?.chromium;
  const executable = findChrome();
  if (!executable) {
    process.stderr.write(
      (process.env.CHROME_PATH ? `CHROME_PATH=${process.env.CHROME_PATH} is not an executable file.\n` : '') +
        'No Chromium-family browser found. Set CHROME_PATH to a Chrome/Chromium binary, or install Google Chrome.\n' +
        'Looked in: CHROME_PATH, ~/.cache/hyperframes/chrome/**/chrome-headless-shell, ~/.cache/ms-playwright/**/chrome, google-chrome, chromium.\n'
    );
    process.exit(EXIT.MISSING_DEPENDENCY);
  }
  await renderTargets(chromium, executable, job, targets);

  const record = { tool: TOOL, ...sourceRecord(input, out), generatedAt: new Date().toISOString() };
  const entries = [];
  for (const t of targets) {
    writeFileAtomic(path.join(out, t.file), t.buffer);
    entries.push({ file: t.file, kind: 'png', preset: t.preset, width: t.pixelWidth, height: t.pixelHeight, cssWidth: t.width, cssHeight: t.height, dpr: t.dpr, background: background ?? null, ...record });
  }
  const icoSizes = [...new Set(targets.flatMap((t) => PRESETS[t.preset]?.ico ?? []))];
  if (icoSizes.length) {
    const images = icoSizes.map((size) => ({ size, buffer: targets.find((t) => t.preset === 'favicon' && t.width === size).buffer }));
    writeFileAtomic(path.join(out, 'favicon.ico'), icoFromPngs(images));
    entries.push({ file: 'favicon.ico', kind: 'ico', preset: 'favicon', sizes: icoSizes, background: background ?? null, ...record });
  }
  writeManifest(out, entries);
  for (const e of entries) process.stdout.write(`${e.file}${e.width ? ` ${e.width}×${e.height}` : ''}\n`);
  process.stdout.write(`${entries.length} files → ${out} (manifest.json)\n`);
}

if (isMain(import.meta.url)) runCli(TOOL, main);
