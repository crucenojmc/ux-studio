import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { FIXTURES, REPO, asset, hasPlaywright, noBrowserEnv, outputDir, run, serve } from './helpers.mjs';

const SCRIPT = asset('nav-graph.mjs');
const { findBrowser } = await import(asset('lib/browser.mjs'));
const { analyzeReachability, linkTargets } = await import(SCRIPT);

const skip = !hasPlaywright()
  ? 'playwright-core is not installed: run `npm install` in tests/ux-flow-audit'
  : !findBrowser()
    ? 'no Chromium-family browser found (set CHROME_PATH); tests never download one'
    : false;

const feature = (report, id) => report.features.find((f) => f.id === id);
const role = (report, id) => report.roles.find((r) => r.id === id);
const depthOf = (r, node) => r.nodes.find((n) => n.id === node)?.depth;

describe('nav-graph: pure helpers', () => {
  test('linkTargets maps data-a tokens, hash links and registry titles to screen ids', () => {
    const registry = { screens: ['inicio', 'pedidos', 'config'], titles: { configuracion: 'config' } };
    assert.deepEqual(linkTargets({ dataA: 'go:pedidos', href: null, text: 'Ver' }, registry), ['pedidos']);
    assert.deepEqual(linkTargets({ dataA: null, href: '#screen=inicio&role=x', text: 'Volver' }, registry), ['inicio']);
    assert.deepEqual(linkTargets({ dataA: null, href: null, text: 'Configuración', control: true }, registry), ['config']);
    assert.deepEqual(linkTargets({ dataA: 'toggle-theme', href: null, text: 'Tema' }, registry), []);
  });

  test('analyzeReachability finds depth, orphans, dead ends and unreachable features', () => {
    const graph = {
      nodes: [{ id: 'a', kind: 'screen' }, { id: 'b', kind: 'screen' }, { id: 'c', kind: 'screen' }, { id: 'z', kind: 'screen' }],
      roles: [{ id: 'r', home: 'a', allowed: ['a', 'b', 'c', 'z'], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' }, { from: 'z', to: 'a' }] }],
    };
    const out = analyzeReachability(graph, [{ id: 'fz', name: 'Z', roles: [], match: { screen: 'z' } }]);
    assert.equal(out.roles[0].nodes.find((n) => n.id === 'c').depth, 2);
    assert.deepEqual(out.roles[0].onlyByUrl, ['z']);
    assert.deepEqual(out.orphans, ['z']);
    assert.deepEqual(out.deadEnds, []);
    assert.deepEqual(out.unreachableFeatures, ['fz']);
  });
});

describe('nav-graph --crawl', { skip }, () => {
  let site;
  let report;
  let out;

  before(async () => {
    site = await serve(path.join(FIXTURES, 'crawl-site'));
    out = outputDir('nav-graph-crawl');
    const r = await run(SCRIPT, [
      '--crawl', `${site.url}/`,
      '--max-depth', '4',
      '--same-origin',
      '--routes', path.join(FIXTURES, 'crawl-routes.json'),
      '--features', path.join(FIXTURES, 'crawl-features.json'),
      '--out', out,
    ]);
    assert.equal(r.status, 0, r.stderr);
    report = JSON.parse(readFileSync(path.join(out, 'nav-graph.json'), 'utf8'));
  });

  after(() => site?.close());

  test('discovers linked pages and the menu item navigation with depths', () => {
    const r = role(report, 'default');
    for (const id of ['/', '/pedidos', '/pedidos/nuevo', '/stock', '/reportes']) {
      assert.ok(r.reachable.includes(id), `${id} should be reachable`);
    }
    assert.equal(depthOf(r, '/'), 0);
    assert.equal(depthOf(r, '/reportes'), 1);
    assert.equal(depthOf(r, '/pedidos/nuevo'), 2);
  });

  test('never clicks destructive controls, never submits forms', () => {
    assert.equal(site.count('GET /borrado'), 0, 'the destructive button was clicked');
    assert.equal(site.countMethod('POST'), 0, 'a form was submitted');
    assert.ok(!report.nodes.some((n) => n.id === '/borrado'));
    const skipped = report.skipped.map((s) => `${s.reason}:${s.label}`);
    assert.ok(skipped.includes('destructive:Eliminar todo'), JSON.stringify(skipped));
    assert.ok(skipped.includes('submit:Guardar'), JSON.stringify(skipped));
  });

  test('records mailto and file links as leaves without visiting them', () => {
    assert.equal(site.count('GET /manual.pdf'), 0);
    const kinds = report.nodes.filter((n) => ['external', 'file'].includes(n.kind)).map((n) => n.kind).sort();
    assert.deepEqual(kinds, ['external', 'file']);
  });

  test('flags the dead end and the orphan route', () => {
    assert.ok(report.deadEnds.includes('/stock'), JSON.stringify(report.deadEnds));
    assert.ok(!report.deadEnds.includes('/'), 'home is not a dead end');
    assert.deepEqual(report.orphans, ['/huerfana']);
  });

  test('reports reachable and unreachable features', () => {
    assert.equal(feature(report, 'f-pedidos').byRole.default.depth, 1);
    assert.equal(feature(report, 'f-reportes').byRole.default.reachable, true);
    assert.equal(feature(report, 'f-auditoria').reachable, false);
    const conc = feature(report, 'f-conciliacion');
    assert.equal(conc.reachable, false);
    assert.equal(conc.onlyByUrl, true);
    assert.deepEqual(report.unreachableFeatures.sort(), ['f-auditoria', 'f-conciliacion']);
  });

  test('writes a Markdown report next to the JSON', () => {
    const md = readFileSync(path.join(out, 'nav-graph.md'), 'utf8');
    assert.ok(md.includes('/huerfana'));
    assert.ok(md.includes('f-auditoria'));
  });
});

describe('nav-graph --showcase', { skip }, () => {
  let site;
  let report;

  before(async () => {
    site = await serve(path.join(FIXTURES, 'showcase-site'));
    const out = outputDir('nav-graph-showcase');
    const r = await run(SCRIPT, [
      '--showcase', `${site.url}/`,
      '--features', path.join(FIXTURES, 'showcase-features.json'),
      '--out', out,
    ]);
    assert.equal(r.status, 0, r.stderr);
    report = JSON.parse(readFileSync(path.join(out, 'nav-graph.json'), 'utf8'));
    assert.ok(existsSync(path.join(out, 'nav-graph.md')));
  });

  after(() => site?.close());

  test('builds one graph per role from links inside the app frame only', () => {
    const op = role(report, 'operador');
    assert.equal(depthOf(op, 'inicio'), 0);
    assert.equal(depthOf(op, 'pedidos'), 1);
    assert.equal(depthOf(op, 'stock'), 1);
    assert.equal(depthOf(op, 'detalle'), 2);
    assert.ok(!op.nodes.some((n) => n.id === 'config'), 'operador has no access to config');
    assert.deepEqual(op.onlyByUrl, ['huerfana']);
    const admin = role(report, 'admin');
    assert.equal(depthOf(admin, 'config'), 1, 'a button whose text matches the registry title is an edge');
  });

  test('flags orphans, dead ends and flow jumps without a UI link', () => {
    assert.deepEqual(report.orphans, ['huerfana']);
    assert.ok(report.deadEnds.includes('detalle'));
    const steps = report.flows.find((f) => f.id === 'f-operador').steps;
    assert.equal(steps.find((s) => s.to === 'pedidos').backed, true);
    assert.equal(steps.find((s) => s.to === 'huerfana').backed, false);
  });

  test('evaluates features per role, including role-locked ones', () => {
    const det = feature(report, 'feat-detalle');
    assert.deepEqual(det.byRole.operador.path, ['inicio', 'pedidos', 'detalle']);
    const cfg = feature(report, 'feat-config');
    assert.equal(cfg.byRole.admin.reachable, true);
    assert.equal(cfg.byRole.operador.reason, 'no-access');
    assert.deepEqual(cfg.roleLocked, ['operador']);
    const conc = feature(report, 'feat-conciliar');
    assert.equal(conc.reachable, false);
    assert.equal(conc.onlyByUrl, true);
    assert.equal(feature(report, 'feat-stock-texto').byRole.operador.depth, 1);
  });
});

describe('nav-graph --showcase with data-go / data-act="sheet" markup', { skip }, () => {
  let site;
  let report;

  before(async () => {
    site = await serve(path.join(FIXTURES, 'showcase-go-site'));
    const out = outputDir('nav-graph-showcase-go');
    const r = await run(SCRIPT, ['--showcase', `${site.url}/`, '--out', out]);
    assert.equal(r.status, 0, r.stderr);
    report = JSON.parse(readFileSync(path.join(out, 'nav-graph.json'), 'utf8'));
  });

  after(() => site?.close());

  test('linkTargets reads data-go and data-act="sheet" + data-arg', () => {
    const registry = { screens: ['inicio', 'orden'], sheets: ['cerrar'] };
    assert.deepEqual(linkTargets({ dataGo: 'orden', dataArg: 'OT-1', href: null, text: 'x' }, registry), ['orden']);
    assert.deepEqual(linkTargets({ dataAct: 'sheet', dataArg: 'cerrar', href: null, text: 'x' }, registry), ['sheet:cerrar']);
    assert.deepEqual(linkTargets({ dataAct: 'filter', dataArg: 'cerrar', href: null, text: 'x' }, registry), []);
    assert.deepEqual(linkTargets({ dataGo: 'nope', href: null, text: 'x' }, registry), []);
  });

  test('screens and sheets reached by the template markup are connected', () => {
    const r = role(report, 'uno');
    assert.equal(depthOf(r, 'lista'), 1);
    assert.equal(depthOf(r, 'detalle'), 2, 'a detail screen reachable only by a row button');
    assert.equal(depthOf(r, 'sheet:cerrar'), 3);
    assert.deepEqual(report.orphans, ['ajustes']);
    assert.ok(!report.edges.some((e) => e.label === 'Filtrar'), 'other data-act values are not navigation');
  });

  test('flow steps are backed by those links', () => {
    const steps = report.flows[0].steps;
    assert.equal(steps.find((s) => s.to === 'detalle').backed, true);
    assert.equal(steps.find((s) => s.to === 'sheet:cerrar').backed, true);
  });
});

describe('nav-graph --showcase against the real prototype-showcase template', { skip }, () => {
  let site;
  let report;
  const TEMPLATE = path.join(REPO, 'plugins/ux-studio/skills/prototype-showcase/assets/showcase-template.html');
  const PREVIEW = path.join(REPO, 'plugins/ux-studio/skills/prototype-showcase/assets/preview.mjs');

  before(async () => {
    const dir = outputDir('nav-graph-real-template');
    const w = await run(PREVIEW, [TEMPLATE, path.join(dir, 'site/index.html')]);
    assert.equal(w.status, 0, w.stderr);
    site = await serve(path.join(dir, 'site'));
    const r = await run(SCRIPT, ['--showcase', `${site.url}/`, '--out', dir]);
    assert.equal(r.status, 0, r.stderr);
    report = JSON.parse(readFileSync(path.join(dir, 'nav-graph.json'), 'utf8'));
    const rows = report.roles.map((x) => `${x.id.padEnd(14)} onlyByUrl=[${x.onlyByUrl}] reachable=${x.reachable.length}`);
    const steps = report.flows.map((f) => `${f.id}: ${f.steps.length - f.unbacked}/${f.steps.length} backed`);
    console.log(`\nreachability (real template)\n${rows.join('\n')}\norphans=[${report.orphans}]\n${steps.join('\n')}`);
  });

  after(() => site?.close());

  test('orden and ajustes are reachable for every role that can access them', () => {
    assert.deepEqual(report.orphans, []);
    for (const r of report.roles) assert.deepEqual(r.onlyByUrl, [], `${r.id} has screens reachable only by URL`);
    for (const r of report.roles) {
      assert.ok(r.reachable.includes('orden'), `${r.id} reaches orden`);
      assert.ok(r.reachable.includes('ajustes'), `${r.id} reaches ajustes`);
    }
  });

  test('every flow step jump is found in the UI', () => {
    for (const f of report.flows) assert.equal(f.unbacked, 0, `${f.id} has steps without a UI link`);
  });
});

describe('nav-graph without a browser', () => {
  test('prints the install hint and exits 2', async () => {
    const r = await run(SCRIPT, ['--crawl', 'http://127.0.0.1:9/'], { env: noBrowserEnv() });
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /CHROME_PATH/);
  });
});
