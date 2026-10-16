import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { FIXTURES, asset, outputDir, run } from './helpers.mjs';

const script = asset('states-inventory.mjs');
const input = path.join(FIXTURES, 'screens.json');
const generate = (name, extra = []) => {
  const out = outputDir(name);
  const r = run(script, [input, '--out', out, ...extra]);
  assert.equal(r.status, 0, r.stderr);
  return { out, report: JSON.parse(readFileSync(path.join(out, 'content-inventory.json'), 'utf8')) };
};
const find = (report, owner, state) => report.items.find((i) => i.owner === owner && i.state === state);

describe('states-inventory CLI', () => {
  test('--help exits 0 and documents usage', () => {
    const r = run(script, ['--help']);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Usage/);
  });

  test('missing input or unknown flag exits 64', () => {
    assert.equal(run(script, []).status, 64);
    assert.equal(run(script, [input, '--nope']).status, 64);
  });

  test('--out is required so parallel runs never share a file', () => {
    const r = run(script, [input]);
    assert.equal(r.status, 64);
    assert.match(r.stderr, /--out/);
  });

  test('two runs with different --out write disjoint files', () => {
    const a = outputDir('parallel-a');
    const b = outputDir('parallel-b');
    assert.equal(run(script, [input, '--out', a]).status, 0);
    assert.equal(run(script, [input, '--out', b]).status, 0);
    const ra = run(script, [input, '--out', a]);
    assert.equal(ra.stdout.split('\n').filter(Boolean).every((f) => f.startsWith(a)), true);
    assert.ok(existsSync(path.join(a, 'content-inventory.json')) && existsSync(path.join(b, 'content-inventory.json')));
  });

  test('invalid JSON or schema exits 1 with a message', () => {
    const out = outputDir('invalid');
    const bad = path.join(out, 'bad.json');
    writeFileSync(bad, '{"screens": "x"}');
    const r = run(script, [bad, '--out', out]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /screens/);
  });

  test('writes content-inventory.json and .md and touches nothing else', () => {
    const { out } = generate('writes');
    assert.ok(existsSync(path.join(out, 'content-inventory.md')));
  });
});

describe('states-inventory rules', () => {
  const { report } = generate('rules');

  test('a list screen requires empty, loading, errors, partial; mobile adds offline', () => {
    for (const s of ['empty', 'loading', 'error-network', 'error-permission', 'partial', 'offline']) {
      assert.equal(find(report, 'ordenes', s)?.required, true, s);
    }
    assert.equal(find(report, 'ordenes', 'error-not-found')?.required, false);
    assert.equal(find(report, 'ordenes', 'validation'), undefined);
  });

  test('a detail screen with a form requires not-found, validation and success', () => {
    for (const s of ['error-not-found', 'error-validation', 'success']) {
      assert.equal(find(report, 'orden-detalle', s)?.required, true, s);
    }
    assert.equal(find(report, 'orden-detalle', 'empty'), undefined);
  });

  test('flags covered and missing states from the copy given', () => {
    assert.equal(find(report, 'ordenes', 'empty').hasCopy, true);
    assert.equal(find(report, 'ordenes', 'error-network').hasCopy, true);
    assert.equal(find(report, 'ordenes', 'error-permission').hasCopy, false);
    assert.equal(find(report, 'orden-detalle', 'success').hasCopy, true);
  });

  test('blank copy does not count as covered', () => {
    assert.equal(find(report, 'buscador', 'empty').hasCopy, false);
    assert.equal(find(report, 'buscador', 'empty').ownerType, 'component');
  });

  test('a static screen only requires the errors that can still happen', () => {
    assert.equal(find(report, 'ajustes', 'loading'), undefined);
    assert.equal(find(report, 'ajustes', 'empty'), undefined);
    assert.equal(find(report, 'ajustes', 'error-permission')?.required, true);
  });

  test('summary counts required, covered and missing per owner', () => {
    const o = report.owners.find((x) => x.id === 'ordenes');
    assert.equal(o.required, o.covered + o.missing);
    assert.equal(o.missing > 0, true);
    assert.equal(report.summary.missing, report.items.filter((i) => i.required && !i.hasCopy).length);
  });

  test('offline is not required on a web-only product', () => {
    const out = outputDir('web');
    const file = path.join(out, 'web.json');
    writeFileSync(file, JSON.stringify({ project: 'x', platform: 'web', screens: [{ id: 'a', title: 'A', kind: 'list' }] }));
    assert.equal(run(script, [file, '--out', out]).status, 0);
    const r = JSON.parse(readFileSync(path.join(out, 'content-inventory.json'), 'utf8'));
    assert.equal(find(r, 'a', 'offline'), undefined);
  });

  test('markdown lists the missing states', () => {
    const { out } = generate('md');
    const md = readFileSync(path.join(out, 'content-inventory.md'), 'utf8');
    assert.match(md, /Faltan/);
    assert.match(md, /ordenes/);
    assert.match(md, /error-permission/);
  });
});
