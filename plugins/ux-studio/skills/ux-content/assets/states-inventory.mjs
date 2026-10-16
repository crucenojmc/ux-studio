#!/usr/bin/env node
// Inventory of the UI states every screen and component needs, and which of them already have copy.
// Read-only, no dependencies (node built-ins only).
//
//   node states-inventory.mjs <screens.json> --out <dir>
//
// Input: { project?, platform: "web"|"mobile"|"web+mobile", language?,
//          screens: [Item], components?: [Item] }
//   Item: { id, title?, kind: "list"|"detail"|"form"|"dashboard"|"static", hasForm?, hasList?, dataBound?,
//           copy?: { empty, loading, partial, success, offline,
//                    error: { network, permission, validation, notFound } } }
//   A copy value is a string or { text }. Blank or missing = no copy yet.
// Output (in --out, one folder per invocation): content-inventory.json and content-inventory.md.
// Exit codes: 0 ok · 1 invalid input · 64 usage error (missing input or --out, unknown flag).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

const USAGE = `Usage: node states-inventory.mjs <screens.json> --out <dir>

Builds the inventory of required UI states per screen and component
(empty, loading, error network/permission/validation/not-found, success,
partial, offline) and flags which already have copy.
Writes content-inventory.json and content-inventory.md into <dir>.
--out is required and must be unique per invocation (parallel-safe).
Exit: 0 ok, 1 invalid input, 64 usage error.`;

export const STATES = ['empty', 'loading', 'error-network', 'error-permission', 'error-not-found', 'error-validation', 'partial', 'success', 'offline'];

const COPY_PATH = {
  empty: ['empty'],
  loading: ['loading'],
  partial: ['partial'],
  success: ['success'],
  offline: ['offline'],
  'error-network': ['error', 'network'],
  'error-permission': ['error', 'permission'],
  'error-not-found': ['error', 'notFound'],
  'error-validation': ['error', 'validation'],
};

const copyText = (item, state) => {
  let v = item.copy;
  for (const key of COPY_PATH[state]) v = v?.[key];
  const text = typeof v === 'string' ? v : v?.text;
  return typeof text === 'string' && text.trim() ? text.trim() : null;
};

/** Which states an item can show, and whether each is required. Rules are conventions (see references/patterns.md). */
export function statesFor(item, platform) {
  const kind = item.kind ?? 'static';
  const isList = item.hasList ?? (kind === 'list' || kind === 'dashboard');
  const hasForm = item.hasForm ?? kind === 'form';
  const dataBound = item.dataBound ?? kind !== 'static';
  const mobile = /mobile/.test(platform);
  const rows = [];
  const add = (state, required) => rows.push({ state, required });
  if (isList) add('empty', true);
  if (dataBound) add('loading', true);
  add('error-network', dataBound);
  add('error-permission', true);
  add('error-not-found', kind === 'detail' || kind === 'form');
  if (hasForm) add('error-validation', true);
  if (isList) add('partial', true);
  if (hasForm) add('success', true);
  if (mobile && dataBound) add('offline', true);
  return rows.filter((r) => r.required || r.state === 'error-not-found');
}

export function buildInventory(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.screens)) throw new Error('Invalid input: "screens" must be an array');
  if (input.components != null && !Array.isArray(input.components)) throw new Error('Invalid input: "components" must be an array');
  const platform = input.platform ?? 'web';
  const owners = [
    ...input.screens.map((s) => ({ ...s, ownerType: 'screen' })),
    ...(input.components ?? []).map((c) => ({ ...c, ownerType: 'component' })),
  ];
  const items = [];
  for (const o of owners) {
    if (!o.id) throw new Error('Invalid input: every screen and component needs an "id"');
    for (const { state, required } of statesFor(o, platform)) {
      const text = copyText(o, state);
      items.push({ owner: o.id, ownerType: o.ownerType, title: o.title ?? o.id, state, required, hasCopy: text != null, copy: text });
    }
  }
  const ownerRows = owners.map((o) => {
    const req = items.filter((i) => i.owner === o.id && i.required);
    const covered = req.filter((i) => i.hasCopy).length;
    return { id: o.id, ownerType: o.ownerType, required: req.length, covered, missing: req.length - covered };
  });
  const required = items.filter((i) => i.required);
  return {
    tool: 'ux-content/states-inventory',
    project: input.project ?? null,
    platform,
    language: input.language ?? null,
    generatedAt: new Date().toISOString(),
    summary: { owners: owners.length, required: required.length, covered: required.filter((i) => i.hasCopy).length, missing: required.filter((i) => !i.hasCopy).length },
    owners: ownerRows,
    items,
  };
}

const cell = (v) => String(v ?? '—').replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function toMarkdown(r) {
  const lines = [`# Inventario de estados — ${r.project ?? 'sin nombre'}`, '', `Plataforma: ${r.platform} · Pantallas y componentes: ${r.summary.owners} · Estados requeridos: ${r.summary.required} · Con texto: ${r.summary.covered} · Faltan: ${r.summary.missing}`, ''];
  lines.push('## Cobertura', '', '| Id | Tipo | Requeridos | Con texto | Faltan |', '|---|---|--:|--:|--:|');
  for (const o of r.owners) lines.push(`| ${cell(o.id)} | ${o.ownerType} | ${o.required} | ${o.covered} | ${o.missing} |`);
  lines.push('', '## Faltan', '');
  const missing = r.items.filter((i) => i.required && !i.hasCopy);
  if (!missing.length) lines.push('Todos los estados requeridos tienen texto.');
  else {
    lines.push('| Id | Estado |', '|---|---|');
    for (const i of missing) lines.push(`| ${cell(i.owner)} | ${i.state} |`);
  }
  lines.push('', '## Con texto', '');
  const done = r.items.filter((i) => i.required && i.hasCopy);
  if (!done.length) lines.push('Ninguno todavía.');
  else {
    lines.push('| Id | Estado | Texto |', '|---|---|---|');
    for (const i of done) lines.push(`| ${cell(i.owner)} | ${i.state} | ${cell(i.copy)} |`);
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
  if (values.help) { process.stdout.write(`${USAGE}\n`); return 0; }
  if (positionals.length !== 1 || !values.out) {
    process.stderr.write(`Missing <screens.json> or --out <dir>\n${USAGE}\n`);
    return 64;
  }
  let report;
  try {
    report = buildInventory(JSON.parse(readFileSync(positionals[0], 'utf8')));
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    return 1;
  }
  mkdirSync(values.out, { recursive: true });
  const json = path.join(values.out, 'content-inventory.json');
  const md = path.join(values.out, 'content-inventory.md');
  writeFileSync(json, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(md, toMarkdown(report));
  process.stdout.write(`${json}\n${md}\n`);
  return 0;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) process.exitCode = main();
