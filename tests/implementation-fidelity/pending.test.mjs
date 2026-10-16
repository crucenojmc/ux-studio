// A state marked `pending: true` with a `reason` is not captured and is reported as pending, not verified.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { startFixtureServer } from './fixture-server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const ASSETS = path.join(ROOT, 'plugins/ux-studio/skills/implementation-fidelity/assets');
const OUT = path.join(ROOT, 'test-results/implementation-fidelity/pending');

let fixture;

const run = (script, args) =>
  new Promise((resolve) => {
    execFile(process.execPath, [path.join(ASSETS, script), ...args], { cwd: HERE, timeout: 120_000 }, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout, stderr });
    });
  });

function writeConfig(name, extraStates) {
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'fidelity.config.json');
  fs.writeFileSync(
    file,
    JSON.stringify({
      outDir: '.',
      frozenTime: '2026-01-15T12:00:00Z',
      prototype: { url: `${fixture.base}/proto.html` },
      implementation: { url: fixture.base },
      viewports: [{ id: 'web', width: 400, height: 300, capture: 'web' }],
      themes: ['light'],
      states: [
        { id: 'summary', prototype: { hash: 'screen=summary' }, implementation: { path: '/impl-faithful.html' }, masks: { prototype: ['[data-proto=nonce]'], implementation: ['.nonce'] } },
        ...extraStates,
      ],
      elements: { title: { prototype: '[data-proto=title]', implementation: '.page-title', properties: ['color'] } },
    })
  );
  return { dir, file };
}

before(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fixture = await startFixtureServer();
});
after(() => fixture?.server.close());

test('a pending state is skipped by capture and reported as pending, not verified', async () => {
  const { dir, file } = writeConfig('reported', [
    { id: 'later', pending: true, reason: 'The screen is not built yet', prototype: { hash: 'screen=later' }, implementation: { path: '/not-built' } },
  ]);
  const cap = await run('capture-states.mjs', ['--config', file]);
  assert.equal(cap.code, 0, cap.stderr);
  assert.match(cap.stdout, /pending\s+later/);
  for (const side of ['prototype', 'implementation']) {
    const files = fs.readdirSync(path.join(dir, 'captures', side));
    assert.ok(files.every((f) => !f.startsWith('later__')), `${side}: no capture of the pending state`);
  }

  const cmp = await run('compare.mjs', ['--config', file]);
  assert.equal(cmp.code, 0, cmp.stderr);
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'fidelity.json'), 'utf8'));
  assert.deepEqual(report.pending, [{ state: 'later', reason: 'The screen is not built yet' }]);
  assert.equal(report.summary.pendingStates, 1);
  assert.equal(report.pairs.length, 1, 'only the real state is measured');
  assert.ok(report.warnings.every((w) => !w.includes('later')), `no missing-capture warning: ${report.warnings}`);
  const md = fs.readFileSync(path.join(dir, 'fidelity.md'), 'utf8');
  assert.match(md, /Estados pendientes/);
  assert.match(md, /later.*The screen is not built yet/);
});

test('without pending states the report says there are none', async () => {
  const { dir, file } = writeConfig('none', []);
  assert.equal((await run('capture-states.mjs', ['--config', file])).code, 0);
  assert.equal((await run('compare.mjs', ['--config', file])).code, 0);
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'fidelity.json'), 'utf8'));
  assert.deepEqual(report.pending, []);
  assert.match(fs.readFileSync(path.join(dir, 'fidelity.md'), 'utf8'), /Ninguno/);
});

test('a pending state without a reason is a usage error', async () => {
  const { file } = writeConfig('no-reason', [{ id: 'later', pending: true }]);
  const cap = await run('capture-states.mjs', ['--config', file]);
  assert.equal(cap.code, 64);
  assert.match(cap.stderr, /later.*reason/);
});
