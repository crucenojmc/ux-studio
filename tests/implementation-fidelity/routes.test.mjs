// implementation.routes: request fixtures answered before navigation, so the app renders the prototype's demo data.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { startFixtureServer } from './fixture-server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const CAPTURE = path.join(ROOT, 'plugins/ux-studio/skills/implementation-fidelity/assets/capture-states.mjs');
const OUT = path.join(ROOT, 'test-results/implementation-fidelity/routes');

let fixture;

const run = (args) =>
  new Promise((resolve) => {
    execFile(process.execPath, [CAPTURE, ...args], { cwd: HERE, timeout: 120_000 }, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout, stderr });
    });
  });

function writeConfig(name, routes, files = {}) {
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'fixtures'), { recursive: true });
  for (const [rel, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, rel), body);
  const file = path.join(dir, 'fidelity.config.json');
  fs.writeFileSync(
    file,
    JSON.stringify({
      outDir: '.',
      prototype: { url: `${fixture.base}/proto.html` },
      implementation: { url: fixture.base, routes },
      viewports: [{ id: 'web', width: 400, height: 300, capture: 'web' }],
      themes: ['light'],
      states: [{ id: 'api', implementation: { path: '/impl-api.html', steps: [{ waitFor: 'body[data-tone]' }] } }],
      elements: { out: { prototype: '[data-proto=title]', implementation: '#out', properties: ['color'] } },
    })
  );
  return { dir, file };
}

const colorOf = (dir) =>
  JSON.parse(fs.readFileSync(path.join(dir, 'captures/implementation/api__web__light.json'), 'utf8')).elements.out.values.color;

before(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fixture = await startFixtureServer();
});
after(() => fixture?.server.close());

test('without routes the app gets the real (failing) endpoint', async () => {
  const { dir, file } = writeConfig('none', []);
  assert.equal((await run(['--config', file, '--side', 'implementation'])).code, 0);
  assert.equal(colorOf(dir), 'rgb(200, 0, 0)');
});

test('a route fulfils the request with the JSON file, relative to the config', async () => {
  const { dir, file } = writeConfig('fulfil', [{ url: '**/api/summary', fulfill: 'fixtures/summary.json' }], {
    'fixtures/summary.json': JSON.stringify({ tone: 'ok', label: 'Demo order 42' }),
  });
  const res = await run(['--config', file, '--side', 'implementation']);
  assert.equal(res.code, 0, res.stderr + res.stdout);
  assert.equal(colorOf(dir), 'rgb(0, 128, 0)');
});

test('routes never touch the prototype side', async () => {
  const { file } = writeConfig('proto-side', [{ url: '**/proto.html*', fulfill: 'fixtures/x.json' }], { 'fixtures/x.json': '{}' });
  assert.equal((await run(['--config', file, '--side', 'prototype'])).code, 0);
});

test('status is honoured', async () => {
  const { dir, file } = writeConfig('status', [{ url: '**/api/summary', fulfill: 'fixtures/summary.json', status: 500 }], {
    'fixtures/summary.json': JSON.stringify({ tone: 'ok', label: 'x' }),
  });
  assert.equal((await run(['--config', file, '--side', 'implementation'])).code, 0);
  const snap = JSON.parse(fs.readFileSync(path.join(dir, 'captures/implementation/api__web__light.json'), 'utf8'));
  assert.ok(snap.meta.problems.some((p) => p.startsWith('HTTP 500') && p.includes('/api/summary')), snap.meta.problems.join('\n'));
});

test('a route with a missing fixture file or without url is a usage error', async () => {
  const missing = writeConfig('missing-file', [{ url: '**/api/summary', fulfill: 'fixtures/nope.json' }]);
  const res = await run(['--config', missing.file, '--side', 'implementation']);
  assert.equal(res.code, 64);
  assert.match(res.stderr, /nope\.json/);
  const noUrl = writeConfig('no-url', [{ fulfill: 'fixtures/summary.json' }]);
  const res2 = await run(['--config', noUrl.file, '--side', 'implementation']);
  assert.equal(res2.code, 64);
  assert.match(res2.stderr, /routes\[0\]/);
});
