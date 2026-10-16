#!/usr/bin/env node
// Navigation tree (sitemap) from a routes file or from a ux-flow-audit nav-graph.json.
// Read-only, no dependencies (node built-ins only).
//
//   node sitemap.mjs --routes routes.json --out <dir>
//   node sitemap.mjs --nav-graph nav-graph.json --out <dir>
//
// --routes: JSON array (or { routes: [...] }) of Angular/React-style routes:
//   { path, title?, roles?, nav?, redirectTo?, children?: [...] }
//   Paths are joined with their parents. Redirect-only routes and "**" are skipped. `roles` is inherited by
//   children unless they set their own; no roles = every role. nav:false marks a route that no navigation
//   links to (an orphan). The tree follows path ancestry: /a/:id hangs under /a.
// --nav-graph: the nav-graph.json written by ux-flow-audit's nav-graph.mjs. Only screen and page nodes count.
//   The tree is the shortest path from each role's home; screens no home reaches are orphans.
// Output (in --out, one folder per invocation): sitemap.json, sitemap.mmd (Mermaid) and sitemap.md.
// Exit codes: 0 ok · 1 unreadable or malformed input · 64 usage error.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

const USAGE = `Usage: node sitemap.mjs (--routes routes.json | --nav-graph nav-graph.json) --out <dir>

Builds the navigation tree and writes sitemap.json, sitemap.mmd (Mermaid) and
sitemap.md (depth, orphans, screens per role) into <dir>.
--out is required and must be unique per invocation (parallel-safe).
Exit: 0 ok, 1 unreadable or malformed input, 64 usage error.`;

const DEEP = 3;
const ROOT = 'root';
const newNode = (id, title, extra = {}) => ({ id, title, depth: 0, roles: null, orphan: false, children: [], ...extra });
const flatten = (node, acc = []) => { acc.push(node); node.children.forEach((c) => flatten(c, acc)); return acc; };

function metrics(tree, orphans) {
  const nodes = flatten(tree).filter((n) => n.id !== ROOT);
  return {
    screens: nodes.length + orphans.filter((o) => !nodes.some((n) => n.id === o)).length,
    maxDepth: Math.max(0, ...nodes.map((n) => n.depth)),
    deep: nodes.filter((n) => n.depth > DEEP).map((n) => n.id),
    orphans: orphans.length,
  };
}

// ---------------------------------------------------------------------------
// Routes

function flattenRoutes(list, prefix, inherited, acc) {
  for (const r of list) {
    if (!r || typeof r !== 'object' || typeof r.path !== 'string') throw new Error('Invalid routes: every route needs a string "path"');
    const hasChildren = Array.isArray(r.children) && r.children.length > 0;
    const segments = [...prefix, ...r.path.split('/').filter(Boolean)];
    const roles = Array.isArray(r.roles) ? r.roles : inherited;
    const wildcard = r.path === '**';
    if (!wildcard && !(r.redirectTo && !hasChildren)) acc.push({ id: `/${segments.join('/')}`, segments, title: r.title, roles, nav: r.nav });
    if (hasChildren && !wildcard) flattenRoutes(r.children, segments, roles, acc);
  }
}

export function fromRoutes(input) {
  const list = Array.isArray(input) ? input : input?.routes;
  if (!Array.isArray(list)) throw new Error('Invalid routes: expected an array or { routes: [...] }');
  const flat = [];
  flattenRoutes(list, [], null, flat);
  const seen = new Map();
  for (const r of flat) if (!seen.has(r.id)) seen.set(r.id, r);
  const root = newNode(ROOT, 'Raíz', { virtual: true });
  const nodes = new Map([[ROOT, root]]);
  for (const r of seen.values()) {
    const title = r.title ?? r.segments.at(-1) ?? 'Inicio';
    nodes.set(r.id, newNode(r.id, title, { roles: r.roles ? [...r.roles] : null, orphan: r.nav === false, path: r.id }));
  }
  for (const r of seen.values()) {
    let parent = root;
    for (let k = r.segments.length - 1; k >= 1; k--) {
      const hit = nodes.get(`/${r.segments.slice(0, k).join('/')}`);
      if (hit) { parent = hit; break; }
    }
    const node = nodes.get(r.id);
    node.depth = parent.depth + 1;
    parent.children.push(node);
  }
  const all = [...nodes.values()].filter((n) => n.id !== ROOT);
  const roleIds = [...new Set(all.flatMap((n) => n.roles ?? []))];
  const screensPerRole = Object.fromEntries(roleIds.map((rid) => [rid, all.filter((n) => !n.roles || n.roles.includes(rid)).map((n) => n.id)]));
  const orphans = all.filter((n) => n.orphan).map((n) => n.id);
  return { source: { kind: 'routes' }, tree: root, orphans, screensPerRole };
}

// ---------------------------------------------------------------------------
// nav-graph.json

export function fromNavGraph(graph) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || !Array.isArray(graph.roles)) {
    throw new Error('Invalid nav-graph: expected nodes, edges and roles arrays (a nav-graph.json from ux-flow-audit)');
  }
  const isNav = (n) => n.kind === 'screen' || n.kind === 'page';
  const nav = new Map(graph.nodes.filter(isNav).map((n) => [n.id, n]));
  const adj = new Map();
  for (const e of graph.edges) {
    if (!nav.has(e.from) || !nav.has(e.to) || e.from === e.to) continue;
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from).push(e.to);
  }
  const root = newNode(ROOT, 'Raíz', { virtual: true });
  const rolesOf = (id) => {
    const hit = graph.roles.filter((r) => (r.reachable ?? r.nodes?.map((n) => n.id) ?? []).includes(id)).map((r) => r.id);
    return hit.length ? hit : null;
  };
  const made = new Map();
  const make = (id, parent) => {
    const src = nav.get(id);
    const node = newNode(id, src.title ?? id, { roles: rolesOf(id), depth: parent.depth + 1 });
    parent.children.push(node);
    made.set(id, node);
    return node;
  };
  const queue = [];
  for (const home of new Set(graph.roles.map((r) => r.home))) {
    if (nav.has(home) && !made.has(home)) queue.push(make(home, root));
  }
  while (queue.length) {
    const cur = queue.shift();
    for (const to of adj.get(cur.id) ?? []) if (!made.has(to)) queue.push(make(to, cur));
  }
  const orphans = [...nav.keys()].filter((id) => !made.has(id));
  const screensPerRole = {};
  for (const r of graph.roles) {
    const reach = r.reachable ?? r.nodes?.map((n) => n.id);
    if (!Array.isArray(reach)) throw new Error(`Invalid nav-graph: role "${r.id}" has no "reachable" list`);
    screensPerRole[r.id] = reach.filter((id) => nav.has(id));
  }
  return { source: { kind: 'nav-graph' }, tree: root, orphans, screensPerRole, orphanNodes: orphans.map((id) => nav.get(id)) };
}

// ---------------------------------------------------------------------------
// Rendering

const escLabel = (s) => String(s).replace(/"/g, '#quot;');

export function toMermaid(map) {
  const nodes = flatten(map.tree);
  const extra = (map.orphanNodes ?? []).filter((o) => !nodes.some((n) => n.id === o.id)).map((o) => newNode(o.id, o.title ?? o.id, { orphan: true }));
  const ids = new Map([...nodes, ...extra].map((n, i) => [n.id, `n${i}`]));
  const lines = ['flowchart TD'];
  for (const n of [...nodes, ...extra]) lines.push(`  ${ids.get(n.id)}["${escLabel(n.title)}"]${n.orphan ? ':::orphan' : ''}`);
  for (const n of nodes) for (const c of n.children) lines.push(`  ${ids.get(n.id)} --> ${ids.get(c.id)}`);
  lines.push('  classDef orphan stroke-dasharray: 5 5,stroke:#b45309');
  return `${lines.join('\n')}\n`;
}

const cell = (v) => String(v ?? '—').replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function toMarkdown(map) {
  const m = map.metrics;
  const lines = ['# Mapa del sitio', '', `Fuente: ${map.source.kind} · Pantallas: ${m.screens} · Profundidad máxima: ${m.maxDepth} · Huérfanas: ${m.orphans}`, ''];
  lines.push('## Árbol', '');
  const walk = (n, d) => {
    for (const c of n.children) {
      lines.push(`${'  '.repeat(d)}- ${c.title} (\`${c.id}\`)${c.roles ? ` — roles: ${c.roles.join(', ')}` : ''}${c.orphan ? ' — huérfana' : ''}`);
      walk(c, d + 1);
    }
  };
  walk(map.tree, 0);
  lines.push('', '## Profundidad', '');
  lines.push(m.deep.length ? `Pantallas a más de ${DEEP} niveles: ${m.deep.map((i) => `\`${i}\``).join(', ')}.` : `Ninguna pantalla supera los ${DEEP} niveles.`);
  lines.push('', '## Huérfanas', '');
  lines.push(map.orphans.length ? map.orphans.map((i) => `- \`${i}\``).join('\n') : 'Ninguna.');
  lines.push('', '## Pantallas por rol', '', '| Rol | Pantallas | Ids |', '|---|--:|---|');
  for (const [role, ids] of Object.entries(map.screensPerRole)) lines.push(`| ${cell(role)} | ${ids.length} | ${cell(ids.join(', '))} |`);
  if (!Object.keys(map.screensPerRole).length) lines.push('| — | — | La fuente no declara roles |');
  return `${lines.join('\n')}\n`;
}

export function buildSitemap(kind, input) {
  const built = kind === 'routes' ? fromRoutes(input) : fromNavGraph(input);
  const { orphanNodes, ...map } = built;
  const full = { tool: 'ux-research/sitemap', generatedAt: new Date().toISOString(), ...map, metrics: metrics(map.tree, map.orphans) };
  Object.defineProperty(full, 'orphanNodes', { value: orphanNodes, enumerable: false });
  return full;
}

function main() {
  let parsed;
  try {
    parsed = parseArgs({ options: { routes: { type: 'string' }, 'nav-graph': { type: 'string' }, out: { type: 'string' }, help: { type: 'boolean', short: 'h' } } });
  } catch (err) {
    process.stderr.write(`${err.message}\n${USAGE}\n`);
    return 64;
  }
  const { values } = parsed;
  if (values.help) { process.stdout.write(`${USAGE}\n`); return 0; }
  if (!!values.routes === !!values['nav-graph'] || !values.out) {
    process.stderr.write(`Give exactly one of --routes or --nav-graph, and --out <dir>\n${USAGE}\n`);
    return 64;
  }
  let map;
  try {
    const kind = values.routes ? 'routes' : 'nav-graph';
    map = buildSitemap(kind, JSON.parse(readFileSync(values.routes ?? values['nav-graph'], 'utf8')));
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    return 1;
  }
  mkdirSync(values.out, { recursive: true });
  const files = { json: 'sitemap.json', mmd: 'sitemap.mmd', md: 'sitemap.md' };
  writeFileSync(path.join(values.out, files.json), `${JSON.stringify(map, null, 2)}\n`);
  writeFileSync(path.join(values.out, files.mmd), toMermaid(map));
  writeFileSync(path.join(values.out, files.md), toMarkdown(map));
  process.stdout.write(`${Object.values(files).map((f) => path.join(values.out, f)).join('\n')}\n`);
  return 0;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) process.exitCode = main();
