// `--only <stateId>[,<stateId>...]` (repeatable) selects states in capture-states.mjs and compare.mjs,
// so a fix round re-measures only the failing states. Same semantics in both scripts.
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
const OUT = path.join(ROOT, 'test-results/implementation-fidelity/only');
const key = (id) => `${id}__web__light`;

let fixture;

const run = (script, args) =>
  new Promise((resolve) => {
    execFile(process.execPath, [path.join(ASSETS, script), ...args], { cwd: HERE, timeout: 120_000 }, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout, stderr });
    });
  });

/** Three states: `orders` matches the prototype, `detail` and `returns` drift. `impl` overrides a state's page. */
function writeConfig(name, impl = {}) {
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const state = (id, page) => ({
    id,
    prototype: { hash: 'screen=summary' },
    implementation: { path: impl[id] ?? page },
    masks: { prototype: ['[data-proto=nonce]'], implementation: ['.nonce'] },
  });
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
      states: [state('orders', '/impl-faithful.html'), state('detail', '/impl-drift.html'), state('returns', '/impl-drift.html')],
      elements: {
        title: { prototype: '[data-proto=title]', implementation: '.page-title', properties: ['color'] },
        card: { prototype: '[data-proto=card]', implementation: '.summary-card', level: 'component', properties: ['padding-top'] },
      },
    })
  );
  return { dir, file };
}

const captured = (dir, side) => fs.readdirSync(path.join(dir, 'captures', side)).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();
const readReport = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'fidelity.json'), 'utf8'));

before(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fixture = await startFixtureServer();
});
after(() => fixture?.server.close());

test('both scripts document --only in their usage', async () => {
  for (const script of ['capture-states.mjs', 'compare.mjs']) {
    const res = await run(script, ['--help']);
    assert.equal(res.code, 0, res.stderr);
    assert.match(res.stdout, /--only <stateId>/, script);
  }
});

test('capture --only takes one id, a comma list or a repeated flag, and captures only those states', async () => {
  const cases = [
    ['single', ['--only', 'detail'], ['detail']],
    ['comma', ['--only', 'orders,detail'], ['detail', 'orders']],
    ['repeated', ['--only', 'orders', '--only', 'detail'], ['detail', 'orders']],
  ];
  for (const [name, args, ids] of cases) {
    const { dir, file } = writeConfig(`capture-${name}`);
    const cap = await run('capture-states.mjs', ['--config', file, ...args]);
    assert.equal(cap.code, 0, `${name}: ${cap.stderr}`);
    for (const side of ['prototype', 'implementation']) {
      assert.deepEqual(captured(dir, side), ids.map(key).sort(), `${name}: ${side}`);
    }
  }
});

test('--only with an unknown state, or without a value, is a usage error in both scripts', async () => {
  const { file } = writeConfig('invalid');
  for (const script of ['capture-states.mjs', 'compare.mjs']) {
    const unknown = await run(script, ['--config', file, '--only', 'orders,nope']);
    assert.equal(unknown.code, 64, `${script}: ${unknown.stderr}`);
    assert.match(unknown.stderr, /unknown state in --only: nope/);
    const bare = await run(script, ['--config', file, '--only']);
    assert.equal(bare.code, 64, `${script}: ${bare.stderr}`);
    assert.match(bare.stderr, /missing state id \(--only\)/);
  }
});

test('compare --only measures just the selected states and says the report is partial', async () => {
  const { dir, file } = writeConfig('compare-only');
  assert.equal((await run('capture-states.mjs', ['--config', file])).code, 0);
  const cmp = await run('compare.mjs', ['--config', file, '--only', 'detail']);
  assert.equal(cmp.code, 0, cmp.stderr);
  const report = readReport(dir);
  assert.deepEqual(report.pairs.map((p) => p.key), [key('detail')]);
  assert.ok(report.findings.length > 0 && report.findings.every((f) => f.pair === key('detail')), 'findings only from detail');
  assert.deepEqual(report.only, ['detail']);
  assert.ok(report.warnings.some((w) => /Medición parcial: solo detail/.test(w)), `partial warning: ${report.warnings}`);
  assert.ok(report.warnings.every((w) => !/falta la captura/.test(w)), 'unselected states are not reported as missing');
  assert.match(fs.readFileSync(path.join(dir, 'fidelity.md'), 'utf8'), /Medición parcial: solo detail/);
});

test('compare --only: a comma list and a repeated flag select the same states, in config order', async () => {
  const { dir, file } = writeConfig('compare-lists');
  assert.equal((await run('capture-states.mjs', ['--config', file])).code, 0);
  for (const args of [['--only', 'detail,orders'], ['--only', 'detail', '--only', 'orders']]) {
    const cmp = await run('compare.mjs', ['--config', file, ...args]);
    assert.equal(cmp.code, 0, cmp.stderr);
    assert.deepEqual(readReport(dir).pairs.map((p) => p.key), [key('orders'), key('detail')], args.join(' '));
  }
});

test('without --only the report is complete and not marked partial', async () => {
  const { dir, file } = writeConfig('compare-all');
  assert.equal((await run('capture-states.mjs', ['--config', file])).code, 0);
  assert.equal((await run('compare.mjs', ['--config', file])).code, 0);
  const report = readReport(dir);
  assert.equal(report.only, null);
  assert.equal(report.pairs.length, 3);
  assert.ok(report.warnings.every((w) => !/Medición parcial/.test(w)));
});

test('a fix round re-measures only the failing state and keeps the others as "not re-measured"', async () => {
  const first = writeConfig('round-1');
  assert.equal((await run('capture-states.mjs', ['--config', first.file])).code, 0);
  assert.equal((await run('compare.mjs', ['--config', first.file])).code, 0);
  const before1 = readReport(first.dir);
  assert.ok(before1.findings.some((f) => f.pair === key('detail')) && before1.findings.some((f) => f.pair === key('returns')));

  // The implementer fixed `detail`; `returns` still drifts.
  const second = writeConfig('round-2', { detail: '/impl-faithful.html' });
  const cap = await run('capture-states.mjs', ['--config', second.file, '--only', 'detail']);
  assert.equal(cap.code, 0, cap.stderr);
  assert.deepEqual(captured(second.dir, 'implementation'), [key('detail')]);
  const cmp = await run('compare.mjs', ['--config', second.file, '--only', 'detail', '--previous', path.join(first.dir, 'fidelity.json')]);
  assert.equal(cmp.code, 0, cmp.stderr);

  const report = readReport(second.dir);
  assert.deepEqual(report.pairs.map((p) => p.key), [key('detail')]);
  assert.equal(report.findings.length, 0);
  const { delta } = report;
  assert.ok(delta.resolved.length > 0 && delta.resolved.every((f) => f.pair === key('detail')), 'detail findings resolved');
  assert.deepEqual(delta.open, []);
  assert.deepEqual(delta.new, []);
  assert.ok(delta.notRemeasured.length > 0 && delta.notRemeasured.every((f) => f.pair === key('returns')), 'returns not re-measured');
  assert.ok(report.warnings.every((w) => !/falta la captura/.test(w)));
});
