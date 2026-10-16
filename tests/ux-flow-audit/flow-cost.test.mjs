import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { FIXTURES, asset, outputDir, run } from './helpers.mjs';

const SCRIPT = asset('flow-cost.mjs');
const { analyze, toMarkdown, DEFAULT_OPERATORS } = await import(SCRIPT);
const fixture = () => JSON.parse(readFileSync(path.join(FIXTURES, 'flow-tasks.json'), 'utf8'));

const find = (report, id, variant = 'current') => report.tasks.find((t) => t.id === id && t.variant === variant);
const flagsOf = (task) => task.flags.map((f) => `${f.step ?? '-'}:${f.kind}`).sort();

describe('flow-cost: KLM operators', () => {
  test('defaults follow Card, Moran & Newell as reported by Kieras', () => {
    assert.deepEqual(DEFAULT_OPERATORS, { K: 0.28, P: 1.1, B: 0.1, H: 0.4, M: 1.35 });
  });

  test('a mixed task sums operators with hand homing between mouse and keyboard', () => {
    const report = analyze(fixture());
    const t = find(report, 'registrar-recepcion');
    assert.equal(t.seconds, 26.73);
    assert.deepEqual(t.operators, { K: 21, P: 6, B: 12, H: 4, M: 7, W: 2 });
    assert.deepEqual(t.counts, {
      steps: 7, clicks: 6, typedChars: 20, keystrokes: 21, fields: 3,
      contextSwitches: 1, waits: 1, waitSeconds: 2, confirmations: 1,
    });
  });

  test('operator overrides change the estimate (slower typist profile)', () => {
    const input = fixture();
    input.operators = { K: 0.2 };
    const t = find(analyze(input), 'registrar-recepcion');
    assert.equal(t.seconds, 25.05);
  });
});

describe('flow-cost: frequency and weekly cost', () => {
  test('weekly cost = KLM time x executions per week', () => {
    const report = analyze(fixture());
    const a = find(report, 'registrar-recepcion');
    assert.equal(a.perWeek, 60);
    assert.equal(a.weeklySeconds, 1603.8);
    const b = find(report, 'consultar-stock');
    assert.equal(b.seconds, 8.95);
    assert.equal(b.perWeek, 120);
    assert.equal(b.weeklySeconds, 1074);
  });

  test('per-month frequency converts with 12/52 weeks', () => {
    const input = { tasks: [{ id: 'cierre', role: 'admin', frequency: { count: 13, per: 'month' }, steps: [{ op: 'click' }] }] };
    const t = analyze(input).tasks[0];
    assert.equal(t.perWeek, 3);
    assert.equal(t.weeklySeconds, 7.95);
    assert.deepEqual(analyze(input).assumptions, []);
  });

  test('unknown frequency is never invented: weekly cost null and flagged', () => {
    const t = find(analyze(fixture()), 'aprobar-ajuste');
    assert.equal(t.seconds, 7.95);
    assert.equal(t.perWeek, null);
    assert.equal(t.weeklySeconds, null);
    assert.ok(t.flags.some((f) => f.kind === 'unknown-frequency'));
  });

  test('a missing calendar is reported as an explicit assumption', () => {
    const input = fixture();
    delete input.calendar;
    const report = analyze(input);
    assert.ok(report.assumptions.some((a) => a.code === 'calendar-default'));
    assert.equal(find(report, 'consultar-stock').perWeek, 120);
  });
});

describe('flow-cost: redundant input', () => {
  test('flags repeated, derivable, known and confirmation steps', () => {
    const report = analyze(fixture());
    assert.deepEqual(flagsOf(find(report, 'registrar-recepcion')), [
      '2:known-by-system',
      '2:repeated-across-tasks',
      '4:repeated-in-task',
      '5:derivable',
      '6:confirmation',
    ]);
    assert.deepEqual(flagsOf(find(report, 'consultar-stock')), ['2:repeated-across-tasks']);
  });

  test('cross-task repetition stays inside one role and one variant', () => {
    const report = analyze(fixture());
    assert.ok(!find(report, 'aprobar-ajuste').flags.some((f) => f.kind === 'repeated-across-tasks'));
    assert.deepEqual(flagsOf(find(report, 'registrar-recepcion', 'proposed')), []);
  });

  test('potential saving counts removable entry steps only', () => {
    const t = find(analyze(fixture()), 'registrar-recepcion');
    assert.equal(t.potentialSavingSeconds, 13.18);
    assert.equal(t.weeklySavingSeconds, 790.8);
  });
});

describe('flow-cost: current vs proposed', () => {
  test('pairs variants by task id', () => {
    const report = analyze(fixture());
    assert.deepEqual(report.comparisons, [{
      id: 'registrar-recepcion',
      role: 'deposito',
      currentSeconds: 26.73,
      proposedSeconds: 8.5,
      deltaSeconds: 18.23,
      weeklyDeltaSeconds: 1093.8,
    }]);
  });

  test('markdown lists every task, the flags and the comparison', () => {
    const md = toMarkdown(analyze(fixture()));
    for (const text of ['registrar-recepcion', 'consultar-stock', 'aprobar-ajuste', 'repeated-in-task', '18.23']) {
      assert.ok(md.includes(text), `markdown should include ${text}`);
    }
  });
});

describe('flow-cost: CLI', () => {
  test('writes JSON and Markdown into --out', async () => {
    const out = outputDir('flow-cost');
    const r = await run(SCRIPT, [path.join(FIXTURES, 'flow-tasks.json'), '--out', out]);
    assert.equal(r.status, 0, r.stderr);
    const json = JSON.parse(readFileSync(path.join(out, 'flow-cost.json'), 'utf8'));
    assert.equal(json.tasks.length, 4);
    assert.ok(existsSync(path.join(out, 'flow-cost.md')));
  });

  test('prints Markdown to stdout with --format md', async () => {
    const r = await run(SCRIPT, [path.join(FIXTURES, 'flow-tasks.json'), '--format', 'md']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /\| *Tarea/);
  });

  test('rejects an unknown step operation with exit 1', async () => {
    const out = outputDir('flow-cost-bad');
    const bad = path.join(out, 'bad.json');
    writeFileSync(bad, JSON.stringify({ tasks: [{ id: 'x', role: 'r', steps: [{ op: 'drag' }] }] }));
    const r = await run(SCRIPT, [bad]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /drag/);
  });
});
