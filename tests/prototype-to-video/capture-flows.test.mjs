import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const script = path.join(repoRoot, 'plugins/ux-studio/skills/prototype-to-video/assets/capture-flows.mjs');
const outRoot = path.join(repoRoot, 'test-results/prototype-to-video/capture');

const { findBrowser, slugify } = await import(script);

let hasPlaywright = true;
try {
  createRequire(path.join(here, 'package.json')).resolve('playwright-core');
} catch {
  hasPlaywright = false;
}
const browser = findBrowser();
const skipBrowser = !hasPlaywright
  ? 'playwright-core is not installed: run `npm install` in tests/prototype-to-video'
  : !browser
    ? 'no Chromium-family browser found (set CHROME_PATH); tests never download one'
    : false;

function run(args, { cwd = here, env = process.env } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], { cwd, env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

function pngSize(file) {
  const buf = readFileSync(file);
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${file} is not a PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

function makeExe(file) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, '#!/bin/sh\nexit 0\n');
  chmodSync(file, 0o755);
  return file;
}

describe('slugify', () => {
  test('keeps file names ASCII, lowercase and readable', () => {
    assert.equal(slugify('Confirmar la aprobación'), 'confirmar-la-aprobacion');
    assert.equal(slugify('  ¿Qué pasa con el Año?  '), 'que-pasa-con-el-ano');
    assert.equal(slugify(''), 'step');
    assert.ok(slugify('a'.repeat(200)).length <= 48);
  });
});

describe('findBrowser', () => {
  const root = path.join(outRoot, 'fake-browsers');
  before(() => rmSync(root, { recursive: true, force: true }));

  test('CHROME_PATH wins when it points to an executable', () => {
    const exe = makeExe(path.join(root, 'a/custom/chrome'));
    const home = path.join(root, 'a/home');
    makeExe(path.join(home, '.cache/hyperframes/chrome/chrome-headless-shell/linux-1/chrome-headless-shell-linux64/chrome-headless-shell'));
    const found = findBrowser({ env: { CHROME_PATH: exe, PATH: '' }, platform: 'linux', home });
    assert.deepEqual(found, { path: exe, source: 'CHROME_PATH' });
  });

  test('the HyperFrames cache comes before the Playwright cache', () => {
    const home = path.join(root, 'b/home');
    const hf = makeExe(path.join(home, '.cache/hyperframes/chrome/chrome-headless-shell/linux-1/chrome-headless-shell-linux64/chrome-headless-shell'));
    makeExe(path.join(home, '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'));
    const found = findBrowser({ env: { CHROME_PATH: path.join(root, 'missing'), PATH: '' }, platform: 'linux', home });
    assert.deepEqual(found, { path: hf, source: 'hyperframes-cache' });
  });

  test('the newest Playwright Chromium is preferred', () => {
    const home = path.join(root, 'c/home');
    makeExe(path.join(home, '.cache/ms-playwright/chromium-1217/chrome-linux64/chrome'));
    const newest = makeExe(path.join(home, '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'));
    makeExe(path.join(home, '.cache/ms-playwright/chromium-999/chrome-linux64/chrome'));
    const found = findBrowser({ env: { PATH: '' }, platform: 'linux', home });
    assert.deepEqual(found, { path: newest, source: 'playwright-cache' });
  });

  test('falls back to google-chrome or chromium on PATH', () => {
    const home = path.join(root, 'd/home');
    mkdirSync(home, { recursive: true });
    const bin = path.join(root, 'd/bin');
    const exe = makeExe(path.join(bin, 'chromium'));
    const found = findBrowser({ env: { PATH: bin }, platform: 'linux', home });
    assert.deepEqual(found, { path: exe, source: 'PATH' });
  });

  test('returns null when nothing is installed', () => {
    const home = path.join(root, 'e/home');
    mkdirSync(home, { recursive: true });
    assert.equal(findBrowser({ env: { PATH: '' }, platform: 'linux', home }), null);
  });
});

describe('capture-flows CLI without a browser', () => {
  test('missing --url prints usage and exits 1', async () => {
    const r = await run(['--out', path.join(outRoot, 'nourl')]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /--url/);
  });

  test('a non-http URL is rejected with a hint to serve the page', async () => {
    const r = await run(['--url', 'file:///tmp/preview.html', '--out', path.join(outRoot, 'file')]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /http/i);
  });

  test('missing playwright-core exits 2 with the install command', async () => {
    const cwd = path.join(outRoot, 'no-node-modules');
    mkdirSync(cwd, { recursive: true });
    const r = await run(['--url', 'http://127.0.0.1:9/x.html', '--out', path.join(cwd, 'out')], {
      cwd,
      env: { ...process.env, NODE_PATH: '' },
    });
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /npm i -D playwright-core/);
  });

  test('no browser exits 3 and explains CHROME_PATH', { skip: hasPlaywright ? false : 'playwright-core not installed' }, async () => {
    const home = path.join(outRoot, 'empty-home');
    mkdirSync(home, { recursive: true });
    const r = await run(['--url', 'http://127.0.0.1:9/x.html', '--out', path.join(outRoot, 'nobrowser')], {
      env: { HOME: home, USERPROFILE: home, PATH: path.join(outRoot, 'empty-bin'), CHROME_PATH: path.join(home, 'nope') },
    });
    assert.equal(r.status, 3, r.stderr);
    assert.match(r.stderr, /CHROME_PATH/);
  });
});

describe('capture-flows CLI against the fixture showcase', { skip: skipBrowser }, () => {
  let server;
  let base;
  const requests = [];

  before(async () => {
    const fixture = readFileSync(path.join(here, 'fixture.html'));
    const pages = {
      '/fixture.html': fixture,
      '/blank.html': Buffer.from('<!doctype html><title>blank</title><p>sin API</p>'),
      '/v2.html': Buffer.from('<!doctype html><script>window.SHOWCASE={version:"2"}</script>'),
      // What the showcase template does for ?capture= of a platform LAYOUT.platforms does not declare.
      '/refused.html': Buffer.from('<!doctype html><script>throw new Error("?capture=phone is not available: LAYOUT.platforms declares only web.")</script>'),
    };
    server = createServer((req, res) => {
      requests.push(req.url);
      const body = pages[new URL(req.url, 'http://x').pathname];
      if (!body) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(body);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => server && server.close());

  test('web view: one PNG per step and a storyboard.json with rects', async () => {
    const out = path.join(outRoot, 'web');
    rmSync(out, { recursive: true, force: true });
    const r = await run(['--url', `${base}/fixture.html`, '--out', out, '--size', '1280x720', '--theme', 'dark']);
    assert.equal(r.status, 0, r.stderr);

    const hit = requests.find((u) => u.startsWith('/fixture.html?'));
    const q = new URL(hit, 'http://x').searchParams;
    assert.equal(q.get('capture'), 'web');
    assert.equal(q.get('motion'), 'reduced');
    assert.equal(q.get('theme'), 'dark');

    const sb = JSON.parse(readFileSync(path.join(out, 'storyboard.json'), 'utf8'));
    assert.equal(sb.view, 'web');
    assert.deepEqual(sb.size, { width: 1280, height: 720 });
    assert.equal(sb.scale, 1);
    assert.equal(sb.theme, 'dark');
    assert.match(sb.source, /\/fixture\.html\?/);
    assert.deepEqual(sb.flows.map((f) => f.id), ['aprobar-pedido', 'cambiar-ajuste']);

    const [approve, settings] = sb.flows;
    assert.equal(approve.title, 'Aprobar un pedido');
    assert.equal(approve.role, 'supervisor');
    assert.equal(approve.steps.length, 3);
    assert.deepEqual(approve.steps.map((s) => s.image), [
      'aprobar-pedido/01-abrir-la-bandeja.png',
      'aprobar-pedido/02-revisar-el-detalle.png',
      'aprobar-pedido/03-confirmar-la-aprobacion.png',
    ]);
    const first = approve.steps[0];
    assert.equal(first.index, 1);
    assert.equal(first.label, 'Abrir la bandeja');
    assert.equal(first.say, 'La bandeja muestra los pedidos pendientes.');
    assert.equal(first.target, '#btn-primero');
    assert.deepEqual(first.to, { screen: 'bandeja', role: 'supervisor' });

    for (const step of approve.steps) {
      const rect = step.targetRect;
      assert.ok(rect, `step ${step.index} has no rect`);
      for (const k of ['x', 'y', 'width', 'height']) assert.equal(typeof rect[k], 'number');
      assert.ok(rect.width > 0 && rect.height > 0);
      assert.ok(rect.x >= 0 && rect.x + rect.width <= 1280 && rect.y >= 0 && rect.y + rect.height <= 720);
      assert.deepEqual(pngSize(path.join(out, step.image)), { width: 1280, height: 720 });
    }
    const hashes = approve.steps.map((s) => sha(path.join(out, s.image)));
    assert.equal(new Set(hashes).size, 3, 'every step should render a different screen');

    const last = settings.steps[2];
    assert.equal(last.target, null);
    assert.equal(last.targetRect, null);
    assert.equal(last.say, null);
    assert.ok(existsSync(path.join(out, last.image)));
  });

  test('phone view: --flow, --scale and phone rects', async () => {
    const out = path.join(outRoot, 'phone');
    rmSync(out, { recursive: true, force: true });
    const r = await run([
      '--url', `${base}/fixture.html`, '--out', out,
      '--view', 'phone', '--size', '390x844', '--scale', '2', '--flow', 'aprobar-pedido',
    ]);
    assert.equal(r.status, 0, r.stderr);
    const sb = JSON.parse(readFileSync(path.join(out, 'storyboard.json'), 'utf8'));
    assert.equal(sb.view, 'phone');
    assert.equal(sb.scale, 2);
    assert.equal(sb.theme, null);
    assert.deepEqual(sb.flows.map((f) => f.id), ['aprobar-pedido']);
    const step = sb.flows[0].steps[0];
    assert.deepEqual(pngSize(path.join(out, step.image)), { width: 780, height: 1688 });
    // The fixture pins the phone button 16 px from both edges and 24 px from the bottom.
    assert.equal(step.targetRect.x, 16);
    assert.equal(step.targetRect.width, 390 - 32);
    assert.equal(step.targetRect.y + step.targetRect.height, 844 - 24);
    assert.equal(existsSync(path.join(out, 'cambiar-ajuste')), false);
  });

  test('an unknown --flow exits 1 and lists the available ids', async () => {
    const r = await run(['--url', `${base}/fixture.html`, '--out', path.join(outRoot, 'unknown'), '--flow', 'nope']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /aprobar-pedido/);
    assert.match(r.stderr, /cambiar-ajuste/);
  });

  test('a page without window.SHOWCASE times out with a clear error', async () => {
    const r = await run(['--url', `${base}/blank.html`, '--out', path.join(outRoot, 'blank'), '--timeout', '1500']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /window\.SHOWCASE/);
  });

  test('a page that refuses the capture reports its reason', async () => {
    const r = await run(['--url', `${base}/refused.html`, '--out', path.join(outRoot, 'refused'), '--view', 'phone', '--timeout', '1500']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /LAYOUT\.platforms declares only web/);
  });

  test('an unsupported SHOWCASE version is refused', async () => {
    const r = await run(['--url', `${base}/v2.html`, '--out', path.join(outRoot, 'v2'), '--timeout', '1500']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /version/i);
  });
});
