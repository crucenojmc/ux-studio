// chart-check.mjs: CLI contract, schema validation and the reading rules, on fictional fixtures.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { FIXTURES, asset, outputDir, readJson, run, seeded } from './helpers.mjs';

const script = asset('chart-check.mjs');
const clean = path.join(FIXTURES, 'clean.json');
const base = readJson(FIXTURES, 'clean.json');
const { cases } = readJson(FIXTURES, 'cases.json');
const report = (out) => JSON.parse(readFileSync(path.join(out, 'chart-check.json'), 'utf8'));
const triples = (findings) => findings.map((f) => [f.rule, f.severity, f.path]).sort();

/** Write one spec per case and check them all in one invocation. */
function checkCases(name) {
  const out = outputDir(name);
  const files = cases.map((c) => {
    const file = path.join(out, `${c.name}.json`);
    writeFileSync(file, JSON.stringify(seeded(base, c), null, 2));
    return file;
  });
  const r = run(script, [...files, '--out', out]);
  const byFile = Object.fromEntries(report(out).charts.map((c) => [path.basename(c.file, '.json'), c]));
  return { r, byFile };
}

describe('chart-check CLI', () => {
  test('--help exits 0 and documents usage', () => {
    const r = run(script, ['--help']);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Usage/);
    assert.match(r.stdout, /--out/);
  });

  test('missing spec or unknown flag exits 64', () => {
    assert.equal(run(script, []).status, 64);
    assert.equal(run(script, [clean, '--nope']).status, 64);
  });

  test('--out is required so parallel runs never share a file', () => {
    const r = run(script, [clean]);
    assert.equal(r.status, 64);
    assert.match(r.stderr, /--out/);
  });

  test('a clean spec exits 0 and writes chart-check.json and chart-check.md', () => {
    const out = outputDir('clean');
    const r = run(script, [clean, '--out', out]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(path.join(out, 'chart-check.md')));
    const rep = report(out);
    assert.equal(rep.tool, 'data-viz/chart-check');
    assert.deepEqual(rep.summary, { charts: 1, passed: 1, failed: 0, errors: 0, warnings: 0 });
    assert.deepEqual(rep.charts[0].findings, []);
    assert.equal(rep.charts[0].status, 'pass');
  });

  test('an error finding exits 1; warnings alone exit 0', () => {
    const out = outputDir('exit');
    const bad = path.join(out, 'bad.json');
    const warn = path.join(out, 'warn.json');
    writeFileSync(bad, JSON.stringify(seeded(base, cases.find((c) => c.name === 'three-d'))));
    writeFileSync(warn, JSON.stringify(seeded(base, cases.find((c) => c.name === 'dual-axis-justified'))));
    assert.equal(run(script, [bad, '--out', out]).status, 1);
    assert.equal(run(script, [warn, '--out', out]).status, 0);
  });

  test('unreadable JSON exits 1 with a message naming the file', () => {
    const out = outputDir('invalid');
    const broken = path.join(out, 'broken.json');
    writeFileSync(broken, '{"version": ');
    const r = run(script, [broken, '--out', out]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /broken\.json/);
  });

  test('a file may hold an array of specs, one chart each', () => {
    const out = outputDir('array');
    const file = path.join(out, 'dashboard.json');
    writeFileSync(file, JSON.stringify([base, { ...base, id: 'otro' }]));
    assert.equal(run(script, [file, '--out', out]).status, 0);
    assert.deepEqual(report(out).charts.map((c) => c.id), ['pedidos-por-mes', 'otro']);
  });

  test('the markdown summarizes each chart and lists the findings in Spanish', () => {
    const out = outputDir('md');
    const file = path.join(out, 'pie.json');
    writeFileSync(file, JSON.stringify(seeded(base, cases.find((c) => c.name === 'pie-six-slices'))));
    run(script, [file, '--out', out]);
    const md = readFileSync(path.join(out, 'chart-check.md'), 'utf8');
    assert.match(md, /^# Revisión de gráficos/m);
    assert.match(md, /pie-slices/);
    assert.match(md, /Hallazgos/);
  });
});

describe('chart-check reading rules (one fixture per seeded violation)', () => {
  const { r, byFile } = checkCases('rules');

  test('the batch fails because some cases carry errors', () => {
    assert.equal(r.status, 1, r.stderr);
  });

  for (const c of cases) {
    test(`${c.name}: reports exactly ${c.expect.length ? c.expect.map((e) => e[0]).join(', ') : 'nothing'}`, () => {
      const chart = byFile[c.name];
      assert.ok(chart, `${c.name} was checked`);
      assert.deepEqual(triples(chart.findings), [...c.expect].sort());
      const errors = c.expect.some((e) => e[1] === 'error');
      assert.equal(chart.status, errors ? 'fail' : 'pass');
      for (const f of chart.findings) assert.ok(f.message.length > 10, `${f.rule} explains itself`);
    });
  }
});

describe('placeholder text in the card', () => {
  test('flags blanks, stock fillers and template slots, never ordinary Spanish', async () => {
    const { isPlaceholder } = await import(script);
    for (const t of ['', '  ', 'TBD', 'N/A', 'n/a.', '...', '—', 'Pendiente', 'por definir', '<fuente>', '{{n}}', 'Lorem ipsum dolor', 'Ver TODO abajo']) {
      assert.equal(isPlaceholder(t), true, JSON.stringify(t));
    }
    for (const t of ['Ninguna.', 'Se usa todo el período.', 'Todo el semestre, sin filtros.', '%', 'x < y > z no aplica', 'No aplica: es el conteo completo.']) {
      assert.equal(isPlaceholder(t), false, JSON.stringify(t));
    }
  });
});

describe('chart-spec.schema.json', () => {
  const schema = readJson(path.dirname(script), 'chart-spec.schema.json');
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictTuples: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  test('the clean fixture and the shipped example are valid', () => {
    assert.equal(validate(base), true, ajv.errorsText(validate.errors));
    const example = readJson(path.dirname(script), 'chart-spec.example.json');
    assert.equal(validate(example), true, ajv.errorsText(validate.errors));
  });

  test('chart-check agrees with a standard validator on every seeded case', () => {
    for (const c of cases) {
      const schemaFinding = c.expect.some((e) => e[0] === 'schema');
      assert.equal(validate(seeded(base, c)), !schemaFinding, c.name);
    }
  });

  test('the card fields are required properties', () => {
    const card = schema.$defs.card;
    assert.deepEqual([...card.required].sort(), ['alternatives', 'limitations', 'math', 'question', 'source', 'why']);
    assert.deepEqual([...card.properties.source.required].sort(), ['cutoff', 'extraction', 'filters', 'n', 'origin', 'period']);
    assert.deepEqual([...card.properties.math.required].sort(),
      ['aggregation', 'assumptions', 'formula', 'outliers', 'transformations', 'uncertainty', 'units']);
  });

  test('a spec names its question, type, encodings and data reference', () => {
    for (const key of ['question', 'type', 'encodings', 'data', 'card']) assert.ok(schema.required.includes(key), key);
    assert.ok(schema.$defs.data.required.includes('ref'));
    assert.ok(schema.$defs.data.required.includes('demo'));
  });

  test('uses only the keywords the built-in validator of chart-check supports', async () => {
    const { SUPPORTED_KEYWORDS } = await import(script);
    const used = new Set();
    const walk = (node, inProperties) => {
      if (Array.isArray(node)) return node.forEach((n) => walk(n, false));
      if (!node || typeof node !== 'object') return;
      for (const [k, v] of Object.entries(node)) {
        if (!inProperties) used.add(k);
        walk(v, !inProperties && (k === 'properties' || k === '$defs'));
      }
    };
    walk(schema, false);
    for (const k of used) assert.ok(SUPPORTED_KEYWORDS.has(k), `unsupported keyword ${k}`);
  });
});
