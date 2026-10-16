#!/usr/bin/env node
// Checks chart specs before a chart is built: validates each one against chart-spec.schema.json
// and applies the reading rules of references/chart-selection.md. Read-only, no dependencies
// (node built-ins only; the schema is validated by the small validator below).
//
//   node chart-check.mjs <spec.json> [<spec.json> ...] --out <dir>
//
// A file holds one spec object, or an array of specs (the charts of one page).
// Output (in --out, one folder per invocation): chart-check.json and chart-check.md.
// Exit codes: 0 no error findings (warnings allowed) · 1 an error finding or unreadable input · 64 usage error.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = JSON.parse(readFileSync(path.join(HERE, 'chart-spec.schema.json'), 'utf8'));

const USAGE = `Usage: node chart-check.mjs <spec.json> [<spec.json> ...] --out <dir>

Validates each chart spec against chart-spec.schema.json, then applies the reading rules:
bars and columns start at zero; pie and donut have at most 5 slices whose parts add up to the
whole (±0.5 %); a second axis needs a justification (warning) or is an error; a log scale is
labelled; samples show n; estimates show uncertainty; no 3D for 2D data; at most 7 category
colours, never colour alone; every «Ficha del gráfico» field filled with real text; demo data
labelled as such. A file holds one spec or an array of specs.
Writes chart-check.json and chart-check.md into <dir>.
--out is required and must be unique per invocation (parallel-safe).
Exit: 0 no errors (warnings allowed), 1 errors or unreadable input, 64 usage error.`;

/** JSON Schema keywords the built-in validator understands; the spec schema uses no others. */
export const SUPPORTED_KEYWORDS = new Set([
  '$schema', '$id', '$defs', '$ref', 'title', 'description', 'type', 'const', 'enum', 'required', 'properties',
  'additionalProperties', 'items', 'minItems', 'maxItems', 'minLength', 'pattern', 'minimum', 'maximum',
  'exclusiveMinimum', 'exclusiveMaximum',
]);

/* ------------------------------------------------------------------ schema validation */

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
const isType = (v, t) => {
  if (t === 'integer') return Number.isInteger(v);
  if (t === 'number') return typeof v === 'number' && Number.isFinite(v);
  return typeOf(v) === t;
};
const join = (base, key) => (base ? `${base}.${key}` : String(key));
const resolve = (ref, root) => {
  if (!ref.startsWith('#/')) throw new Error(`Unsupported $ref ${ref}`);
  return ref.slice(2).split('/').reduce((node, key) => node[key], root);
};

/** Errors of `value` against `schema`, as { path, message } with dotted paths ("card.source.period"). */
export function validateSchema(value, schema = SCHEMA, at = '', root = SCHEMA, errors = []) {
  if (schema.$ref) validateSchema(value, resolve(schema.$ref, root), at, root, errors);
  const err = (p, message) => errors.push({ path: p, message });
  if (schema.type) {
    const types = [].concat(schema.type);
    if (!types.some((t) => isType(value, t))) {
      err(at, `se esperaba ${types.join(' o ')} y llegó ${typeOf(value)}`);
      return errors;
    }
  }
  if ('const' in schema && value !== schema.const) err(at, `debe valer ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) err(at, `valor no admitido ${JSON.stringify(value)}; admitidos: ${schema.enum.join(', ')}`);
  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) err(at, schema.minLength === 1 ? 'no puede estar vacío' : `al menos ${schema.minLength} caracteres`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) err(at, `no cumple el formato ${schema.pattern}`);
  }
  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) err(at, `debe ser ≥ ${schema.minimum}`);
    if (schema.maximum != null && value > schema.maximum) err(at, `debe ser ≤ ${schema.maximum}`);
    if (schema.exclusiveMinimum != null && value <= schema.exclusiveMinimum) err(at, `debe ser > ${schema.exclusiveMinimum}`);
    if (schema.exclusiveMaximum != null && value >= schema.exclusiveMaximum) err(at, `debe ser < ${schema.exclusiveMaximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) err(at, `al menos ${schema.minItems} elemento(s)`);
    if (schema.maxItems != null && value.length > schema.maxItems) err(at, `como máximo ${schema.maxItems} elemento(s)`);
    if (schema.items) value.forEach((item, i) => validateSchema(item, schema.items, join(at, i), root, errors));
  }
  if (typeOf(value) === 'object') {
    for (const key of schema.required ?? []) if (!(key in value)) err(join(at, key), 'falta este campo obligatorio');
    for (const [key, v] of Object.entries(value)) {
      if (schema.properties && key in schema.properties) validateSchema(v, schema.properties[key], join(at, key), root, errors);
      else if (schema.additionalProperties === false) err(join(at, key), 'campo no admitido');
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') validateSchema(v, schema.additionalProperties, join(at, key), root, errors);
    }
  }
  return errors;
}

/* ------------------------------------------------------------------ reading rules */

// Length-encoded marks: the value is the bar's length, so the scale starts at zero.
const BARS = new Set(['column', 'bar', 'grouped-column', 'grouped-bar', 'stacked-column', 'stacked-bar', 'diverging-bar',
  'lollipop', 'histogram', 'waterfall', 'bullet']);
const PIES = new Set(['pie', 'donut']);
const MAX_PIE_SLICES = 5; // convention
const PIE_TOLERANCE = 0.005; // ±0.5 % of the whole
const MAX_CATEGORIES = 7; // convention

const CARD_LABELS = {
  question: 'Pregunta que responde',
  why: 'Por qué este gráfico',
  alternatives: 'Alternativas descartadas y por qué',
  source: 'Fuente de los datos',
  math: 'Matemática',
  limitations: 'Limitaciones y cómo leerlo',
};

const PLACEHOLDER_EXACT = /^(?:tbd|tba|todo|fixme|n\/?a|none|null|undefined|x{2,}|\?+|-+|—+|…+|pendiente|por definir|a definir|sin definir|completar|placeholder|texto|lorem ipsum)$/i;
const PLACEHOLDER_INSIDE = /lorem ipsum|\{\{|\}\}|<\p{L}[\p{L} _-]*>/iu;
const TRACKER = /\b(?:TODO|TBD|FIXME)\b/; // upper case only: «todo» is ordinary Spanish
const DEMO = /demostraci[oó]n|\bdemo\b|fictici[oa]s?|ilustrativ[oa]s?/i;

/** Blank, a stock filler («TBD», «N/A», «…») or a template slot («<fórmula>», «{{x}}»). */
export function isPlaceholder(text) {
  if (typeof text !== 'string') return false;
  const norm = text.trim().replace(/[.:;!]+$/, '').trim();
  return norm === '' || PLACEHOLDER_EXACT.test(norm) || PLACEHOLDER_INSIDE.test(text) || TRACKER.test(text);
}

/** Every text of the card with its dotted path. */
function cardTexts(card) {
  const out = [];
  for (const key of ['question', 'why', 'limitations']) out.push([`card.${key}`, key, card[key]]);
  card.alternatives.forEach((a, i) => {
    out.push([`card.alternatives.${i}.chart`, 'alternatives', a.chart]);
    out.push([`card.alternatives.${i}.reason`, 'alternatives', a.reason]);
  });
  for (const [group, obj] of [['source', card.source], ['math', card.math]]) {
    for (const [key, v] of Object.entries(obj)) if (typeof v === 'string') out.push([`card.${group}.${key}`, group, v]);
  }
  return out;
}

const fmt = (n) => String(Math.round(n * 100) / 100).replace('.', ',');

/** Reading-rule findings of a schema-valid spec. */
export function readingRules(spec) {
  const findings = [];
  const add = (rule, severity, at, message) => findings.push({ rule, severity, path: at, message });
  const enc = spec.encodings;
  const data = spec.data;

  if (BARS.has(spec.type)) {
    for (const ch of ['x', 'y']) {
      const c = enc[ch];
      if (!c || c.type !== 'quantitative' || c.bin) continue;
      const domainHasZero = !c.domain || (c.domain[0] <= 0 && c.domain[1] >= 0);
      if (c.zero === false || c.scale === 'log' || !domainHasZero) {
        add('bar-zero', 'error', `encodings.${ch}`, 'Las barras y columnas muestran el valor con su largo: el eje debe empezar en cero (sin «zero: false», sin escala logarítmica y con un dominio que incluya el cero).');
      }
    }
  }

  if (PIES.has(spec.type)) {
    const values = data.values ?? [];
    if (values.length > MAX_PIE_SLICES) {
      add('pie-slices', 'error', 'data.values', `Una torta o una dona admite hasta ${MAX_PIE_SLICES} porciones y esta tiene ${values.length}: agrupar en «Otros» o usar barras ordenadas.`);
    }
    const field = enc.theta?.field;
    const parts = values.map((row) => row?.[field]);
    if (!field || !values.length || typeof data.total !== 'number' || parts.some((p) => typeof p !== 'number')) {
      add('pie-sum', 'error', 'data.values', 'Para verificar que las partes sumen el todo hacen falta «data.values» con un número en el campo de «encodings.theta» y «data.total».');
    } else {
      const sum = parts.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - data.total) > PIE_TOLERANCE * Math.abs(data.total)) {
        add('pie-sum', 'error', 'data.values', `Las partes suman ${fmt(sum)} y el todo es ${fmt(data.total)} (tolerancia ±0,5 %): una torta solo muestra partes de un mismo todo.`);
      }
    }
  }

  if (enc.y2) {
    const reason = enc.y2.justification;
    if (reason && !isPlaceholder(reason)) {
      add('dual-axis', 'warning', 'encodings.y2', 'Doble eje: la escala de cada eje es arbitraria y los cruces entre series no significan nada. Hay justificación; repetirla en «Por qué este gráfico».');
    } else {
      add('dual-axis', 'error', 'encodings.y2', 'Doble eje sin justificación: preferir dos gráficos alineados o un índice común, o justificar el segundo eje en «encodings.y2.justification».');
    }
  }

  for (const [ch, c] of Object.entries(enc)) {
    if (c.scale === 'log' && !/log/i.test(c.label ?? '')) {
      add('log-label', 'error', `encodings.${ch}`, 'La escala logarítmica tiene que decirse en la etiqueta del eje, por ejemplo «(escala logarítmica)».');
    }
  }

  if (data.sample && spec.display?.showN !== true) {
    add('sample-n', 'error', 'display.showN', 'Los datos son una muestra: el gráfico tiene que mostrar n (en el subtítulo o en una anotación), además de la ficha.');
  }

  if (data.estimate && spec.uncertainty?.shown !== true) {
    add('estimate-uncertainty', 'error', 'uncertainty', 'Los valores son estimaciones: el gráfico tiene que mostrar su incertidumbre (intervalo, banda o barras de error) y la ficha decir cómo se calculó.');
  }

  if (spec.display?.threeD && !enc.z) {
    add('no-3d', 'error', 'display.threeD', 'Gráfico en 3D para datos de dos dimensiones: la perspectiva deforma largos y áreas. Usar la versión plana.');
  }

  const color = enc.color;
  if (color && (color.type === 'nominal' || color.type === 'ordinal')) {
    const distinct = new Set((data.values ?? []).map((row) => row?.[color.field]).filter((v) => v != null)).size;
    const categories = Math.max(color.palette?.length ?? 0, distinct);
    if (categories > MAX_CATEGORIES) {
      add('palette-size', 'error', 'encodings.color', `${categories} colores de categoría y el máximo es ${MAX_CATEGORIES}: agrupar categorías, resaltar una y dejar el resto en gris, o separar en paneles.`);
    }
    if (!color.legend && !color.directLabels) {
      add('color-only', 'error', 'encodings.color', 'Las categorías se distinguen solo por el color: agregar una leyenda o etiquetas directas sobre las marcas.');
    }
  }

  for (const [at, group, text] of cardTexts(spec.card)) {
    if (isPlaceholder(text)) {
      add('card-field', 'error', at, `«${CARD_LABELS[group]}» está vacío o es texto de relleno: escribir el contenido real o, si no se conoce, convertirlo en una pregunta del cuestionario.`);
    }
  }

  if (data.demo && !DEMO.test(spec.card.source.origin)) {
    add('demo-label', 'error', 'card.source.origin', 'Los datos son de demostración: «Fuente de los datos» tiene que decirlo, por ejemplo «Datos de demostración: …».');
  }

  return findings;
}

/** Schema findings when the spec is invalid (the rules need a valid spec); otherwise the reading rules. */
export function checkSpec(spec) {
  const errors = validateSchema(spec);
  if (errors.length) return errors.map((e) => ({ rule: 'schema', severity: 'error', path: e.path, message: `Especificación inválida en «${e.path || 'raíz'}»: ${e.message}.` }));
  return readingRules(spec);
}

export function buildReport(files) {
  const charts = [];
  for (const file of files) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      throw new Error(`${file}: ${err.message}`);
    }
    [].concat(parsed).forEach((spec, index) => {
      const findings = checkSpec(spec);
      const errors = findings.filter((f) => f.severity === 'error').length;
      charts.push({
        file,
        index,
        id: spec?.id ?? null,
        title: spec?.title ?? null,
        type: spec?.type ?? null,
        status: errors ? 'fail' : 'pass',
        errors,
        warnings: findings.length - errors,
        findings,
      });
    });
  }
  const sum = (key) => charts.reduce((a, c) => a + c[key], 0);
  return {
    tool: 'data-viz/chart-check',
    generatedAt: new Date().toISOString(),
    summary: {
      charts: charts.length,
      passed: charts.filter((c) => c.status === 'pass').length,
      failed: charts.filter((c) => c.status === 'fail').length,
      errors: sum('errors'),
      warnings: sum('warnings'),
    },
    charts,
  };
}

const cell = (v) => String(v ?? '—').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const SEVERITY = { error: 'error', warning: 'advertencia' };

export function toMarkdown(r) {
  const s = r.summary;
  const lines = ['# Revisión de gráficos', '',
    `Gráficos: ${s.charts} · Sin errores: ${s.passed} · Con errores: ${s.failed} · Errores: ${s.errors} · Advertencias: ${s.warnings}`, '',
    '## Gráficos', '', '| Gráfico | Tipo | Estado | Errores | Advertencias |', '|---|---|---|--:|--:|'];
  for (const c of r.charts) {
    lines.push(`| ${cell(c.id)} — ${cell(c.title)} | ${cell(c.type)} | ${c.status === 'pass' ? 'sin errores' : 'con errores'} | ${c.errors} | ${c.warnings} |`);
  }
  lines.push('', '## Hallazgos', '');
  const rows = r.charts.flatMap((c) => c.findings.map((f) => ({ chart: c.id ?? path.basename(c.file), ...f })));
  if (!rows.length) lines.push('Ningún hallazgo: cada gráfico cumple las reglas de lectura y tiene su ficha completa.');
  else {
    lines.push('| Gráfico | Regla | Severidad | Dónde | Detalle |', '|---|---|---|---|---|');
    for (const f of rows) lines.push(`| ${cell(f.chart)} | ${f.rule} | ${SEVERITY[f.severity]} | ${cell(f.path || 'raíz')} | ${cell(f.message)} |`);
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  let parsed;
  try {
    parsed = parseArgs({ allowPositionals: true, options: { out: { type: 'string' }, help: { type: 'boolean', short: 'h' } } });
  } catch (err) {
    process.stderr.write(`${err.message}\n${USAGE}\n`);
    return 64;
  }
  const { values, positionals } = parsed;
  if (values.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  if (!positionals.length || !values.out) {
    process.stderr.write(`Missing <spec.json> or --out <dir>\n${USAGE}\n`);
    return 64;
  }
  let report;
  try {
    report = buildReport(positionals);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    return 1;
  }
  mkdirSync(values.out, { recursive: true });
  const json = path.join(values.out, 'chart-check.json');
  const md = path.join(values.out, 'chart-check.md');
  writeFileSync(json, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(md, toMarkdown(report));
  process.stdout.write(`${json}\n${md}\n`);
  return report.summary.errors ? 1 : 0;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) process.exitCode = main();
