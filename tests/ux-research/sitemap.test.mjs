import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { FIXTURES, asset, outputDir, run } from './helpers.mjs';

const script = asset('sitemap.mjs');
const routes = path.join(FIXTURES, 'routes.json');
const navGraph = path.join(FIXTURES, 'nav-graph.json');
const build = (name, args) => {
  const out = outputDir(name);
  const r = run(script, [...args, '--out', out]);
  assert.equal(r.status, 0, r.stderr);
  return { out, map: JSON.parse(readFileSync(path.join(out, 'sitemap.json'), 'utf8')) };
};
const flat = (node, acc = []) => { acc.push(node); node.children.forEach((c) => flat(c, acc)); return acc; };
const byId = (map, id) => flat(map.tree).find((n) => n.id === id);

describe('sitemap CLI', () => {
  test('--help exits 0', () => {
    const r = run(script, ['--help']);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Usage/);
  });

  test('usage errors exit 64: no input, both inputs, no --out, unknown flag', () => {
    const out = outputDir('usage');
    assert.equal(run(script, ['--out', out]).status, 64);
    assert.equal(run(script, ['--routes', routes, '--nav-graph', navGraph, '--out', out]).status, 64);
    assert.equal(run(script, ['--routes', routes]).status, 64);
    assert.equal(run(script, ['--routes', routes, '--out', out, '--nope']).status, 64);
  });

  test('a missing or malformed input exits 1', () => {
    const out = outputDir('bad');
    assert.equal(run(script, ['--routes', path.join(out, 'nope.json'), '--out', out]).status, 1);
    assert.equal(run(script, ['--routes', navGraph, '--out', out]).status, 1);
  });

  test('writes sitemap.json, sitemap.mmd and sitemap.md', () => {
    const { out } = build('files', ['--routes', routes]);
    for (const f of ['sitemap.json', 'sitemap.mmd', 'sitemap.md']) assert.ok(existsSync(path.join(out, f)), f);
  });

  test('two runs with different --out never write the same file', () => {
    const a = build('par-a', ['--routes', routes]).out;
    const b = build('par-b', ['--nav-graph', navGraph]).out;
    assert.notEqual(a, b);
    assert.equal(JSON.parse(readFileSync(path.join(a, 'sitemap.json'), 'utf8')).source.kind, 'routes');
    assert.equal(JSON.parse(readFileSync(path.join(b, 'sitemap.json'), 'utf8')).source.kind, 'nav-graph');
  });
});

describe('sitemap from routes', () => {
  const { out, map } = build('routes', ['--routes', routes]);

  test('builds the tree by path ancestry and skips redirects and wildcards', () => {
    const ids = flat(map.tree).map((n) => n.id);
    assert.deepEqual(ids.sort(), ['/', '/informes', '/ingreso', '/legado', '/ordenes', '/ordenes/:id', '/ordenes/:id/cierre', 'root'].sort());
    assert.equal(byId(map, '/ordenes/:id/cierre').depth, 3);
    assert.equal(byId(map, '/ordenes').children.length, 1);
    assert.equal(map.metrics.maxDepth, 3);
  });

  test('roles are inherited and can be narrowed by a child', () => {
    assert.deepEqual(byId(map, '/ordenes/:id').roles, ['tecnico', 'supervisor']);
    assert.deepEqual(byId(map, '/ordenes/:id/cierre').roles, ['tecnico']);
    assert.equal(byId(map, '/').roles, null);
  });

  test('screens per role include unrestricted screens', () => {
    const s = map.screensPerRole;
    assert.ok(s.tecnico.includes('/ordenes/:id/cierre') && s.tecnico.includes('/'));
    assert.ok(!s.supervisor.includes('/ordenes/:id/cierre'));
    assert.ok(s.supervisor.includes('/informes') && !s.tecnico.includes('/informes'));
  });

  test('routes marked nav:false are orphans', () => {
    assert.deepEqual(map.orphans, ['/legado']);
  });

  test('mermaid is a top-down flowchart with every node and an orphan class', () => {
    const mmd = readFileSync(path.join(out, 'sitemap.mmd'), 'utf8');
    assert.match(mmd, /^flowchart TD/);
    assert.match(mmd, /Detalle/);
    assert.match(mmd, /classDef orphan/);
    assert.match(mmd, /:::orphan/);
  });

  test('markdown reports depth, orphans and screens per role', () => {
    const md = readFileSync(path.join(out, 'sitemap.md'), 'utf8');
    assert.match(md, /Profundidad máxima: 3/);
    assert.match(md, /Huérfanas/);
    assert.match(md, /supervisor/);
  });
});

describe('sitemap from a nav-graph.json', () => {
  const { out, map } = build('nav', ['--nav-graph', navGraph]);

  test('builds the tree by shortest path from the home screens, screens only', () => {
    assert.equal(byId(map, 'inicio').depth, 1);
    assert.equal(byId(map, 'ordenes').depth, 2);
    assert.equal(byId(map, 'detalle').depth, 3);
    assert.equal(byId(map, 'sheet:filtros'), undefined);
    assert.equal(map.metrics.maxDepth, 3);
  });

  test('screens not reachable from a home are orphans', () => {
    assert.deepEqual(map.orphans.sort(), ['ajustes', 'huerfana']);
  });

  test('screens per role come from each role reachable list', () => {
    assert.deepEqual(map.screensPerRole.tecnico, ['inicio', 'ordenes', 'detalle']);
    assert.deepEqual(map.screensPerRole.supervisor, ['inicio', 'ordenes', 'informes']);
  });

  test('mermaid and markdown are written', () => {
    assert.match(readFileSync(path.join(out, 'sitemap.mmd'), 'utf8'), /Órdenes/);
    assert.match(readFileSync(path.join(out, 'sitemap.md'), 'utf8'), /ajustes/);
  });
});
