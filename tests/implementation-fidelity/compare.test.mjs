// End-to-end tests for assets/capture-states.mjs + assets/compare.mjs.
// Serves three fixture pages from a tiny HTTP server, captures prototype and implementation
// with the skill's own scripts, and checks what compare.mjs reports.
// Output lives under <repo>/test-results/implementation-fidelity/ (gitignored), never /tmp.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PNG } from 'pngjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const ASSETS = path.join(ROOT, 'plugins/ux-studio/skills/implementation-fidelity/assets');
const CAPTURE = path.join(ASSETS, 'capture-states.mjs');
const COMPARE = path.join(ASSETS, 'compare.mjs');
const OUT = path.join(ROOT, 'test-results/implementation-fidelity');
const KEY = 'summary__web__light';

let server;
let base;

const run = (script, args, cwd = HERE) =>
  new Promise((resolve) => {
    execFile(process.execPath, [script, ...args], { cwd, timeout: 120_000 }, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout, stderr });
    });
  });

const ELEMENTS = {
  pageBackground: { prototype: 'body', implementation: 'body', properties: ['background-color'] },
  title: {
    prototype: '[data-proto=title]',
    implementation: '.page-title',
    properties: ['color', 'font-size', 'font-weight', 'line-height', 'font-family'],
  },
  card: {
    prototype: '[data-proto=card]',
    implementation: '.summary-card',
    level: 'component',
    properties: ['background-color', 'border-top-color', 'border-top-left-radius', 'padding-top', 'padding-left', 'width', 'height'],
  },
  cta: {
    prototype: '[data-proto=cta]',
    implementation: '.btn-primary',
    properties: ['background-color', 'color', 'font-size', 'font-weight', 'border-top-left-radius', 'transition-duration'],
    tokens: { 'background-color': '--color-accent', 'font-size': '--text-sm' },
  },
};

function writeConfig(name, implPath) {
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const config = {
    outDir: '.',
    frozenTime: '2026-01-15T12:00:00Z',
    timezoneId: 'UTC',
    locale: 'es-AR',
    prototype: { url: `${base}/proto.html` },
    implementation: { url: base, auth: { method: 'none' } },
    viewports: [{ id: 'web', width: 400, height: 300, deviceScaleFactor: 1, capture: 'web' }],
    themes: ['light'],
    states: [
      {
        id: 'summary',
        prototype: { hash: 'screen=summary' },
        implementation: { path: implPath },
        masks: { prototype: ['[data-proto=nonce]'], implementation: ['.nonce'] },
      },
    ],
    elements: ELEMENTS,
    tolerances: { deltaE: 2, px: 1, fontSize: 0, fontWeight: 0, pixelRatio: 0.02, pixelThreshold: 0.1 },
  };
  const file = path.join(dir, 'fidelity.config.json');
  fs.writeFileSync(file, JSON.stringify(config, null, 2));
  return { dir, file };
}

async function measure(name, implPath, extra = []) {
  const { dir, file } = writeConfig(name, implPath);
  const cap = await run(CAPTURE, ['--config', file]);
  assert.equal(cap.code, 0, `capture failed:\n${cap.stdout}\n${cap.stderr}`);
  const cmp = await run(COMPARE, ['--config', file, ...extra]);
  assert.equal(cmp.code, 0, `compare failed:\n${cmp.stdout}\n${cmp.stderr}`);
  return { dir, report: JSON.parse(fs.readFileSync(path.join(dir, 'fidelity.json'), 'utf8')) };
}

before(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  server = http.createServer((req, res) => {
    const name = path.basename(new URL(req.url, 'http://x').pathname) || 'proto.html';
    const file = path.join(HERE, 'fixtures', name);
    if (!fs.existsSync(file)) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(fs.readFileSync(file));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server?.close());

test('drifted implementation: reports exactly the three deliberate deviations', async () => {
  const { dir, report } = await measure('drift', '/impl-drift.html');

  const got = report.findings.map((f) => `${f.element}.${f.property}`).sort();
  assert.deepEqual(got, ['card.padding-left', 'card.padding-top', 'cta.font-size', 'title.color']);

  const by = Object.fromEntries(report.findings.map((f) => [`${f.element}.${f.property}`, f]));
  assert.ok(by['title.color'].delta > 2, `title colour dE00 ${by['title.color'].delta}`);
  assert.equal(by['title.color'].priority, 'A');
  assert.equal(by['card.padding-top'].delta, 8);
  assert.equal(by['card.padding-top'].priority, 'B');
  assert.equal(by['cta.font-size'].delta, 2);
  assert.equal(by['cta.font-size'].priority, 'A');
  assert.equal(by['cta.font-size'].token, '--text-sm');
  assert.match(by['cta.font-size'].change, /14px/);

  // The background drift (#f8fafc -> #f7f9fb) is inside tolerance: measured, not reported.
  const bg = report.measurements.find((m) => m.element === 'pageBackground' && m.property === 'background-color');
  assert.ok(bg && bg.pass && bg.delta > 0 && bg.delta < 1, `background dE00 ${bg?.delta}`);

  const pair = report.pairs.find((p) => p.key === KEY);
  assert.ok(pair.score < 100);
  assert.equal(pair.score, Math.round((pair.withinTolerance / pair.measured) * 1000) / 10);
  assert.ok(pair.pixel.ratio > 0, 'pixel diff ratio must be > 0');
  const diff = PNG.sync.read(fs.readFileSync(path.join(dir, pair.pixel.diff)));
  assert.equal(diff.width, 400);
  assert.equal(diff.height, 300);
  assert.ok(fs.existsSync(path.join(dir, pair.pixel.sideBySide)), 'side-by-side image');
  const md = fs.readFileSync(path.join(dir, 'fidelity.md'), 'utf8');
  assert.match(md, /Puntaje de fidelidad/);
  assert.match(md, /title/);

  // Motion values are read without the animation-kill stylesheet.
  const snap = JSON.parse(fs.readFileSync(path.join(dir, 'captures/implementation', `${KEY}.json`), 'utf8'));
  assert.equal(snap.elements.cta.values['transition-duration'], '0.2s');
  assert.ok(Array.isArray(snap.masks) && snap.masks.length === 1, 'mask rectangle recorded');
});

test('faithful implementation: score 100% and zero pixel difference outside masks', async () => {
  const { report } = await measure('faithful', '/impl-faithful.html');
  assert.deepEqual(report.findings, []);
  const pair = report.pairs.find((p) => p.key === KEY);
  assert.equal(pair.score, 100);
  assert.equal(pair.pixel.ratio, 0);
  assert.equal(report.summary.score, 100);
});

test('re-measurement against a previous report lists the resolved findings', async () => {
  const previous = path.join(OUT, 'drift', 'fidelity.json');
  assert.ok(fs.existsSync(previous), 'run after the drift test');
  const { report } = await measure('remeasure', '/impl-faithful.html', ['--previous', previous]);
  assert.equal(report.delta.resolved.length, 4);
  assert.equal(report.delta.new.length, 0);
  assert.equal(report.delta.open.length, 0);
  assert.ok(report.delta.after > report.delta.before);
});

test('print-snippet: the pasted expression measures the same values as the automated capture', async () => {
  const { dir, file } = writeConfig('snippet', '/impl-drift.html');
  const res = await run(CAPTURE, ['--config', file, '--print-snippet', 'summary', '--side', 'implementation']);
  assert.equal(res.code, 0, res.stderr);
  const { chromium } = await import('playwright-core');
  const { findChrome } = await import(pathToFileURL(CAPTURE).href);
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
    await page.goto(`${base}/impl-drift.html`);
    const snap = await page.evaluate(res.stdout);
    assert.equal(snap.elements.title.values.color, 'rgb(51, 65, 85)');
    assert.equal(snap.elements.card.values['padding-top'], '24px');
    assert.equal(snap.elements.cta.values['transition-duration'], '0.2s');
    assert.equal(snap.masks.length, 1);
    const left = await page.evaluate(() => !!document.getElementById('__fidelity_kill_motion__'));
    assert.equal(left, false, 'the snippet removes the stylesheet it injected');
  } finally {
    await browser.close();
  }
  assert.ok(fs.existsSync(dir));
});

test('missing dependency: prints the install hint and exits 2', async () => {
  const empty = path.join(OUT, 'no-deps');
  fs.rmSync(empty, { recursive: true, force: true });
  fs.mkdirSync(empty, { recursive: true });
  const res = await run(CAPTURE, ['--config', 'whatever.json'], empty);
  assert.equal(res.code, 2);
  assert.match(res.stderr + res.stdout, /npm i -D playwright-core/);
});
