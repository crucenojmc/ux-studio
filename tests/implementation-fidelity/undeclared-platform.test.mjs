import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { startFixtureServer } from './fixture-server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SCRIPT = path.join(ROOT, 'plugins/ux-studio/skills/implementation-fidelity/assets/capture-states.mjs');
const OUT = path.join(ROOT, 'test-results/implementation-fidelity/undeclared-platform');

let fixture;
before(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fixture = await startFixtureServer();
});
after(() => fixture?.server.close());

const run = (args) =>
  new Promise((resolve) => {
    const started = Date.now();
    execFile(process.execPath, [SCRIPT, ...args], { cwd: HERE, timeout: 120_000 }, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout, stderr, ms: Date.now() - started });
    });
  });

function writeConfig(name, state) {
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'fidelity.config.json');
  fs.writeFileSync(
    file,
    JSON.stringify({
      outDir: '.',
      prototype: { url: `${fixture.base}/proto-web-only.html` },
      implementation: { url: fixture.base },
      viewports: [{ id: 'phone', width: 390, height: 844, capture: 'phone' }],
      themes: ['light'],
      states: [state],
      elements: { title: { prototype: '[data-proto=title]', implementation: '.page-title', properties: ['color'] } },
    })
  );
  return file;
}

for (const [name, state] of [
  ['without-open', { id: 'summary', prototype: {}, implementation: { path: '/impl-faithful.html' } }],
  ['with-open', { id: 'summary', prototype: { open: { screen: 'summary' } }, implementation: { path: '/impl-faithful.html' } }],
]) {
  test(`an undeclared platform fails fast with the page's reason (${name})`, async () => {
    const res = await run(['--config', writeConfig(name, state), '--side', 'prototype']);
    assert.notEqual(res.code, 0, 'capture must not succeed');
    assert.match(res.stderr, /LAYOUT\.platforms declares only web/, res.stderr);
    assert.equal(res.stderr.trim().split('\n').length, 1, `one line: ${res.stderr}`);
    assert.ok(res.ms < 12_000, `failed fast, took ${res.ms} ms`);
  });
}
