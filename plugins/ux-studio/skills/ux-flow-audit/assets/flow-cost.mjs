#!/usr/bin/env node
// Flow cost with the Keystroke-Level Model (Card, Moran & Newell 1980/1983; conventions after Kieras).
//
//   node flow-cost.mjs <tasks.json> [--out <dir>] [--format json|md]
//
// Input: an array of tasks, or { tasks, operators?, calendar? }.
//   task  = { id, role, title?, variant?: "current"|"proposed", actors?, frequency: {count, per: hour|day|week|month} | null,
//             steps: [{ op: click|type|select|navigate|wait|confirm, field?, chars?, seconds?, focus?: click|tab|none,
//                       derivable?, knownBySystem?, label? }] }
//   operators (seconds) default K 0.28 · P 1.1 · B 0.1 · H 0.4 · M 1.35; calendar default 8 h/day · 5 days/week
//   (a defaulted calendar is reported in `assumptions`, never silently used).
//
// Step expansion (hands start on the mouse; H is added whenever the hand must move):
//   click / navigate / confirm  M P B B           (Kieras: locate the target before pointing)
//   select                      M P B B M P B B   (open the list, find and pick the option)
//   type, focus "click"         M P B B H K×chars (obtain the value, click the field, type)
//   type, focus "tab"           M K K×chars       (Tab into the field)
//   type, focus "none"          M K×chars         (field already focused, e.g. scanner or autofocus)
//   wait                        W(seconds)        any other step may add W with `seconds`
//
// Output per task: KLM seconds, operator counts, clicks, typed chars, fields, context switches, waits,
// executions per week, weekly cost, redundant-input flags and the potential saving; plus current vs proposed.
// Exit codes: 0 ok · 1 invalid input or usage.

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { cell, emit, isMain, runCli } from './lib/cli.mjs';

export const DEFAULT_OPERATORS = Object.freeze({ K: 0.28, P: 1.1, B: 0.1, H: 0.4, M: 1.35 });
export const DEFAULT_CALENDAR = Object.freeze({ hoursPerDay: 8, daysPerWeek: 5 });

const OPS = ['click', 'type', 'select', 'navigate', 'wait', 'confirm'];
const PERIODS = ['hour', 'day', 'week', 'month'];
const ENTRY_OPS = new Set(['type', 'select']);
const REMOVABLE = new Set(['repeated-in-task', 'derivable', 'known-by-system']);

const round = (n, d = 2) => (n == null ? null : Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d);

const FLAG_TEXT = {
  'repeated-in-task': 'El mismo dato se ingresa otra vez en la tarea',
  'repeated-across-tasks': 'El mismo dato se ingresa también en otras tareas del rol',
  derivable: 'El sistema puede derivarlo del contexto',
  'known-by-system': 'El sistema ya lo conoce (dato maestro, último valor, contexto)',
  confirmation: 'Confirmación: verificar que aporte valor',
  'unknown-frequency': 'Frecuencia desconocida: va al cuestionario',
  'unknown-wait': 'Espera sin duración medida',
  'unknown-chars': 'Largo del dato desconocido',
};

function fail(msg) {
  throw new Error(msg);
}

function validate(input) {
  const doc = Array.isArray(input) ? { tasks: input } : input;
  if (!doc || !Array.isArray(doc.tasks)) fail('Input must be an array of tasks or { tasks: [...] }.');
  doc.tasks.forEach((t, i) => {
    const where = `Task ${t?.id ? `"${t.id}"` : `#${i + 1}`}`;
    if (!t || typeof t.id !== 'string' || !t.id) fail(`${where}: "id" is required.`);
    if (typeof t.role !== 'string' || !t.role) fail(`${where}: "role" is required.`);
    if (t.variant != null && !['current', 'proposed'].includes(t.variant)) fail(`${where}: variant must be "current" or "proposed".`);
    if (!Array.isArray(t.steps) || t.steps.length === 0) fail(`${where}: "steps" must be a non-empty array.`);
    if (t.frequency != null) {
      const { count, per } = t.frequency;
      if (count != null && !(typeof count === 'number' && count >= 0)) fail(`${where}: frequency.count must be a number >= 0 or null.`);
      if (count != null && !PERIODS.includes(per)) fail(`${where}: frequency.per must be one of ${PERIODS.join(', ')}.`);
    }
    t.steps.forEach((s, j) => {
      if (!OPS.includes(s?.op)) fail(`${where} step ${j + 1}: unknown op "${s?.op}" (use ${OPS.join(', ')}).`);
      if (s.focus != null && !['click', 'tab', 'none'].includes(s.focus)) fail(`${where} step ${j + 1}: focus must be click, tab or none.`);
    });
  });
  return doc;
}

/** Expand one step into KLM operators given the current hand position. */
export function expandStep(step, hand) {
  const seq = [];
  let clicks = 0;
  const toMouse = () => { if (hand === 'keyboard') { seq.push('H'); hand = 'mouse'; } };
  const toKeyboard = () => { if (hand === 'mouse') { seq.push('H'); hand = 'keyboard'; } };
  const pointAndClick = () => { toMouse(); seq.push('M', 'P', 'B', 'B'); clicks += 1; };
  const chars = Number.isInteger(step.chars) && step.chars > 0 ? step.chars : 0;

  switch (step.op) {
    case 'click':
    case 'navigate':
    case 'confirm':
      pointAndClick();
      break;
    case 'select':
      pointAndClick();
      pointAndClick();
      break;
    case 'type': {
      const focus = step.focus ?? 'click';
      if (focus === 'click') {
        pointAndClick();
        toKeyboard();
      } else {
        toKeyboard();
        seq.push('M');
        if (focus === 'tab') seq.push('K');
      }
      for (let i = 0; i < chars; i += 1) seq.push('K');
      break;
    }
    default:
      break;
  }
  const wait = typeof step.seconds === 'number' && step.seconds > 0 ? step.seconds : 0;
  return { seq, hand, clicks, wait, typedChars: step.op === 'type' ? chars : 0 };
}

function perWeekOf(frequency, calendar) {
  if (!frequency || frequency.count == null) return null;
  const factor = {
    hour: calendar.hoursPerDay * calendar.daysPerWeek,
    day: calendar.daysPerWeek,
    week: 1,
    month: 12 / 52,
  }[frequency.per];
  return frequency.count * factor;
}

function costOf(counts, ops) {
  return ['K', 'P', 'B', 'H', 'M'].reduce((s, k) => s + counts[k] * ops[k], 0) + counts.W;
}

function analyzeTask(task, ops, calendar) {
  let hand = 'mouse';
  const operators = { K: 0, P: 0, B: 0, H: 0, M: 0, W: 0 };
  const counts = { steps: task.steps.length, clicks: 0, typedChars: 0, keystrokes: 0, fields: 0, contextSwitches: 0, waits: 0, waitSeconds: 0, confirmations: 0 };
  const flags = [];
  const seen = new Set();
  const fields = new Set();
  let anonymousFields = 0;
  const stepSeconds = [];
  const sequence = [];

  task.steps.forEach((step, i) => {
    const n = i + 1;
    const e = expandStep(step, hand);
    hand = e.hand;
    const local = { K: 0, P: 0, B: 0, H: 0, M: 0, W: e.wait };
    for (const op of e.seq) local[op] += 1;
    if (step.op === 'wait') {
      counts.waits += 1;
      if (!(typeof step.seconds === 'number' && step.seconds > 0)) flags.push({ step: n, kind: 'unknown-wait' });
    }
    for (const k of Object.keys(operators)) operators[k] += local[k];
    stepSeconds.push(costOf(local, ops));
    sequence.push(e.seq.join(' ') + (e.wait ? `${e.seq.length ? ' ' : ''}W(${e.wait})` : ''));
    counts.clicks += e.clicks;
    counts.typedChars += e.typedChars;
    counts.waitSeconds += e.wait;
    if (step.op === 'navigate') counts.contextSwitches += 1;
    if (step.op === 'confirm') {
      counts.confirmations += 1;
      flags.push({ step: n, kind: 'confirmation' });
    }
    if (step.op === 'type' && !(Number.isInteger(step.chars) && step.chars >= 0)) flags.push({ step: n, kind: 'unknown-chars' });
    if (ENTRY_OPS.has(step.op)) {
      if (step.field) {
        if (seen.has(step.field)) flags.push({ step: n, field: step.field, kind: 'repeated-in-task' });
        seen.add(step.field);
        fields.add(step.field);
      } else {
        anonymousFields += 1;
      }
      if (step.derivable) flags.push({ step: n, field: step.field ?? null, kind: 'derivable' });
      if (step.knownBySystem) flags.push({ step: n, field: step.field ?? null, kind: 'known-by-system' });
    }
  });

  counts.keystrokes = operators.K;
  counts.fields = fields.size + anonymousFields;
  const seconds = costOf(operators, ops);
  const removableSteps = new Set(flags.filter((f) => REMOVABLE.has(f.kind)).map((f) => f.step));
  const saving = [...removableSteps].reduce((s, n) => s + stepSeconds[n - 1], 0);
  const perWeek = perWeekOf(task.frequency, calendar);
  if (perWeek == null) flags.push({ step: null, kind: 'unknown-frequency' });
  const actors = Number.isFinite(task.actors) && task.actors > 0 ? task.actors : null;

  return {
    id: task.id,
    role: task.role,
    title: task.title ?? null,
    variant: task.variant ?? 'current',
    frequency: task.frequency ?? null,
    seconds: round(seconds),
    operators,
    counts,
    perWeek: round(perWeek),
    weeklySeconds: perWeek == null ? null : round(seconds * perWeek),
    actors,
    weeklySecondsAllActors: perWeek == null || actors == null ? null : round(seconds * perWeek * actors),
    potentialSavingSeconds: round(saving),
    weeklySavingSeconds: perWeek == null ? null : round(saving * perWeek),
    sequence,
    flags,
    _raw: { seconds, perWeek },
  };
}

function markCrossTask(tasks, source) {
  const groups = new Map();
  tasks.forEach((task, ti) => {
    const key = `${task.role}\u0000${task.variant}`;
    const firstByField = new Map();
    source[ti].steps.forEach((step, i) => {
      if (ENTRY_OPS.has(step.op) && step.field && !firstByField.has(step.field)) firstByField.set(step.field, i + 1);
    });
    for (const [field, step] of firstByField) {
      if (!groups.has(key)) groups.set(key, new Map());
      const byField = groups.get(key);
      if (!byField.has(field)) byField.set(field, []);
      byField.get(field).push({ task, step });
    }
  });
  for (const byField of groups.values()) {
    for (const [field, hits] of byField) {
      if (hits.length < 2) continue;
      for (const { task, step } of hits) {
        const others = hits.filter((h) => h.task !== task).map((h) => h.task.id);
        task.flags.push({ step, field, kind: 'repeated-across-tasks', tasks: others });
      }
    }
  }
}

/** Analyze tasks: KLM time, counts, weekly cost, redundancy flags and current vs proposed. */
export function analyze(input) {
  const doc = validate(structuredClone(input));
  const ops = { ...DEFAULT_OPERATORS, ...(doc.operators ?? {}) };
  const usesCalendar = doc.tasks.some((t) => ['hour', 'day'].includes(t.frequency?.per) && t.frequency?.count != null);
  const given = doc.calendar ?? {};
  const calendar = { ...DEFAULT_CALENDAR, ...given };
  const assumptions = [];
  if (usesCalendar && (given.hoursPerDay == null || given.daysPerWeek == null)) {
    assumptions.push({
      code: 'calendar-default',
      detail: `Se asumió ${calendar.hoursPerDay} h/día y ${calendar.daysPerWeek} días/semana para convertir la frecuencia; confirmar con el cliente.`,
    });
  }

  const tasks = doc.tasks.map((t) => analyzeTask(t, ops, calendar));
  markCrossTask(tasks, doc.tasks);
  for (const t of tasks) t.flags.sort((a, b) => (a.step ?? 0) - (b.step ?? 0) || a.kind.localeCompare(b.kind));

  const comparisons = [];
  for (const cur of tasks.filter((t) => t.variant === 'current')) {
    const prop = tasks.find((t) => t.variant === 'proposed' && t.id === cur.id);
    if (!prop) continue;
    const delta = cur._raw.seconds - prop._raw.seconds;
    comparisons.push({
      id: cur.id,
      role: cur.role,
      currentSeconds: cur.seconds,
      proposedSeconds: prop.seconds,
      deltaSeconds: round(delta),
      weeklyDeltaSeconds: cur._raw.perWeek == null ? null : round(delta * cur._raw.perWeek),
    });
  }
  for (const t of tasks) delete t._raw;

  return {
    tool: 'ux-flow-audit/flow-cost',
    model: 'KLM (Card, Moran & Newell 1980, 1983; conventions after Kieras 1993)',
    operators: ops,
    calendar,
    assumptions,
    tasks,
    comparisons,
  };
}

const minutes = (s) => (s == null ? '—' : round(s / 60, 1));
const freqText = (f) => (f?.count == null ? 'desconocida' : `${f.count}/${{ hour: 'hora', day: 'día', week: 'semana', month: 'mes' }[f.per]}`);

/** Render the report as Markdown (neutral Spanish). */
export function toMarkdown(report) {
  const o = report.operators;
  const lines = [
    '# Costo de flujo (KLM)',
    '',
    `Operadores (s): K ${o.K} · P ${o.P} · B ${o.B} · H ${o.H} · M ${o.M}. Modelo: ${report.model}.`,
    `Calendario: ${report.calendar.hoursPerDay} h/día · ${report.calendar.daysPerWeek} días/semana.`,
    '',
    '## Tareas',
    '',
    '| Tarea | Rol | Variante | Pasos | Clics | Caracteres | Campos | Cambios de pantalla | Espera (s) | Tiempo KLM (s) | Frecuencia | Ejec./semana | Costo semanal (min) | Ahorro posible (s/ejec.) |',
    '|---|---|---|--:|--:|--:|--:|--:|--:|--:|---|--:|--:|--:|',
    ...report.tasks.map((t) => `| ${cell(t.id)} | ${cell(t.role)} | ${t.variant} | ${t.counts.steps} | ${t.counts.clicks} | ${t.counts.typedChars} | ${t.counts.fields} | ${t.counts.contextSwitches} | ${t.counts.waitSeconds} | ${t.seconds} | ${freqText(t.frequency)} | ${t.perWeek ?? '—'} | ${minutes(t.weeklySeconds)} | ${t.potentialSavingSeconds} |`),
    '',
    '## Entradas redundantes, confirmaciones y datos faltantes',
    '',
  ];
  const flagRows = report.tasks.flatMap((t) => t.flags.map((f) => `| ${cell(t.id)} | ${t.variant} | ${f.step ?? '—'} | ${cell(f.field)} | ${f.kind} | ${cell(FLAG_TEXT[f.kind] + (f.tasks ? `: ${f.tasks.join(', ')}` : ''))} |`));
  if (flagRows.length) {
    lines.push('| Tarea | Variante | Paso | Campo | Señal | Detalle |', '|---|---|--:|---|---|---|', ...flagRows);
  } else {
    lines.push('Sin señales.');
  }
  if (report.comparisons.length) {
    lines.push('', '## Actual vs propuesto', '', '| Tarea | Rol | Actual (s) | Propuesto (s) | Ahorro (s/ejec.) | Ahorro semanal (min) |', '|---|---|--:|--:|--:|--:|',
      ...report.comparisons.map((c) => `| ${cell(c.id)} | ${cell(c.role)} | ${c.currentSeconds} | ${c.proposedSeconds} | ${c.deltaSeconds} | ${minutes(c.weeklyDeltaSeconds)} |`));
  }
  if (report.assumptions.length) {
    lines.push('', '## Supuestos (van al cuestionario)', '', ...report.assumptions.map((a) => `- ${a.detail}`));
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { out: { type: 'string' }, format: { type: 'string', default: 'json' }, help: { type: 'boolean', short: 'h' } },
  });
  if (values.help || positionals.length !== 1) {
    process.stderr.write('Usage: node flow-cost.mjs <tasks.json> [--out <dir>] [--format json|md]\n');
    return values.help ? 0 : 1;
  }
  if (!['json', 'md'].includes(values.format)) fail('--format must be json or md');
  const report = analyze(JSON.parse(readFileSync(positionals[0], 'utf8')));
  emit(report, toMarkdown(report), { out: values.out, format: values.format, name: 'flow-cost' });
  return 0;
}

if (isMain(import.meta.url)) await runCli(main);
