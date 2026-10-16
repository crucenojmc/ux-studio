import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { FIXTURES, HERE, asset, hasPlaywright, noBrowserEnv, outputDir, run, serve } from './helpers.mjs';

const SCRIPT = asset('a11y-audit.mjs');
const { findBrowser } = await import(asset('lib/browser.mjs'));
const skip = !hasPlaywright()
  ? 'playwright-core is not installed: run `npm install` in tests/ux-flow-audit'
  : !findBrowser()
    ? 'no Chromium-family browser found (set CHROME_PATH); tests never download one'
    : false;

const read = (out) => JSON.parse(readFileSync(path.join(out, 'a11y.json'), 'utf8'));
const keys = (report) => report.findings.filter((f) => f.source === 'native').map((f) => `${f.rule} ${f.selector}`).sort();

describe('a11y-audit CLI contract', () => {
  test('--help prints the usage and exits 0', async () => {
    const r = await run(SCRIPT, ['--help']);
    assert.equal(r.status, 0);
    assert.match(r.stdout + r.stderr, /Usage:/);
  });

  for (const [name, args] of [
    ['no input', []],
    ['both --url and --showcase', ['--url', 'http://127.0.0.1:1/', '--showcase', 'http://127.0.0.1:1/']],
    ['an unknown flag', ['--url', 'http://127.0.0.1:1/', '--nope']],
    ['an invalid platform', ['--url', 'http://127.0.0.1:1/', '--platform', 'tablet']],
    ['an empty --storage-state', ['--url', 'http://127.0.0.1:1/', '--storage-state', '=x.json']],
    ['an invalid URL', ['--url', 'not a url']],
  ]) {
    test(`exits 64 on ${name}`, async () => {
      const r = await run(SCRIPT, args);
      assert.equal(r.status, 64, r.stderr);
      assert.match(r.stderr, /Usage:|--/);
    });
  }

  test('exits 2 when no browser is available', async () => {
    const r = await run(SCRIPT, ['--url', 'http://127.0.0.1:1/'], { env: noBrowserEnv() });
    assert.equal(r.status, 2, r.stderr);
  });
});

describe('a11y-audit on local fixtures', { skip }, () => {
  let site;
  let bad;
  let good;
  let outBad;
  before(async () => {
    site = await serve(path.join(FIXTURES, 'a11y-site'));
    outBad = outputDir('a11y-bad');
    const r = await run(SCRIPT, ['--url', `${site.url}/bad.html`, '--out', outBad]);
    assert.equal(r.status, 0, r.stderr);
    bad = read(outBad);
    const outGood = outputDir('a11y-good');
    const g = await run(SCRIPT, ['--url', `${site.url}/good.html`, '--out', outGood]);
    assert.equal(g.status, 0, g.stderr);
    good = read(outGood);
  });
  after(() => site?.close());

  test('finds exactly the seeded violations, no more and no fewer', () => {
    assert.deepEqual(keys(bad), [
      'aria-invalid-role #badrole',
      'aria-ref-missing #badref',
      'button-name #iconbtn',
      'contrast-text #largelow',
      'contrast-text #lowtext',
      'contrast-text #ontransparent',
      'contrast-ui #faintborder',
      'duplicate-id #dup',
      'heading-order #skipped',
      'html-lang html',
      'img-alt #noalt',
      'input-label #nolabel',
      'kbd-focus-invisible #noring',
      'kbd-unreachable #fakebtn',
      'link-name #emptylink',
      'reduced-motion #spinner',
      'target-size #tiny',
    ]);
  });

  test('a clean page has no native findings', () => {
    assert.deepEqual(keys(good), []);
  });

  test('every finding names its WCAG criterion, severity, selector and evidence', () => {
    for (const f of bad.findings) {
      assert.match(f.wcag, /^\d\.\d\.\d+$/, `${f.rule}: wcag`);
      assert.ok(['serious', 'moderate', 'minor'].includes(f.severity), `${f.rule}: severity ${f.severity}`);
      assert.ok(f.selector && f.evidence, `${f.rule}: selector and evidence`);
    }
    const by = (rule, sel) => bad.findings.find((f) => f.rule === rule && f.selector === sel);
    assert.equal(by('contrast-text', '#lowtext').wcag, '1.4.3');
    assert.equal(by('contrast-ui', '#faintborder').wcag, '1.4.11');
    assert.equal(by('target-size', '#tiny').wcag, '2.5.8');
    assert.equal(by('html-lang', 'html').wcag, '3.1.1');
    assert.match(by('contrast-text', '#lowtext').evidence, /2\.3\d?:1.*4\.5:1/);
    assert.match(by('contrast-text', '#largelow').evidence, /3:1/);
    assert.match(by('button-name', '#iconbtn').evidence, /icon-only|solo icono/);
  });

  test('large text uses the 3:1 threshold and transparent backgrounds resolve up the tree', () => {
    assert.ok(!keys(bad).includes('contrast-text #largemid'));
    const f = bad.findings.find((x) => x.selector === '#ontransparent');
    assert.match(f.evidence, /1\.6\d?:1/);
  });

  test('summarises by criterion and never claims conformance', () => {
    assert.equal(bad.summary.byCriterion['1.4.3'], 3);
    assert.match(bad.disclaimer, /verificación automática parcial/);
    const md = readFileSync(path.join(outBad, 'a11y.md'), 'utf8');
    assert.match(md, /verificación automática parcial/);
    assert.match(md, /1\.4\.3/);
    assert.ok(!/cumple WCAG|conforme/i.test(md));
    assert.ok(bad.needsHuman.length > 0);
  });

  test('--platform phone audits the 390x844 viewport', async () => {
    const out = outputDir('a11y-phone');
    const r = await run(SCRIPT, ['--url', `${site.url}/bad.html`, '--platform', 'phone', '--out', out]);
    assert.equal(r.status, 0, r.stderr);
    const report = read(out);
    assert.deepEqual(report.viewports.map((v) => [v.name, v.width, v.height]), [['phone', 390, 844]]);
    assert.ok(report.findings.every((f) => f.viewport === 'phone'));
    assert.ok(keys(report).includes('contrast-text #lowtext'));
  });

  test('a native control with tabindex=-1 goes to human review, not to findings', () => {
    assert.ok(bad.needsHuman.some((n) => /tabindex/.test(n.topic) && n.why.includes('#negtab') && /intencion/i.test(n.why)));
  });

  test('cases a script cannot decide go to human review instead of failing', async () => {
    const out = outputDir('a11y-edge');
    const r = await run(SCRIPT, ['--url', `${site.url}/edge.html`, '--out', out]);
    assert.equal(r.status, 0, r.stderr);
    const report = read(out);
    assert.deepEqual(keys(report), []);
    const why = (re) => report.needsHuman.find((n) => re.test(n.topic));
    assert.match(why(/Contraste/)?.why ?? '', /#modern.*formato no soportado|formato no soportado.*#modern/);
    assert.match(why(/sombra/i)?.why ?? '', /#ringed/);
    assert.match(why(/foco/i)?.why ?? '', /#bgfocus/);
    assert.ok(!report.findings.some((f) => f.selector === '#indisabled'));
  });

  test('--storage-state accepts a bare file as well as role=file', async () => {
    const out = outputDir('a11y-storage');
    const file = path.join(out, 'auth.json');
    writeFileSync(file, JSON.stringify({ cookies: [], origins: [] }));
    const r = await run(SCRIPT, ['--url', `${site.url}/good.html`, '--storage-state', file, '--out', out]);
    assert.equal(r.status, 0, r.stderr);
    const named = await run(SCRIPT, ['--url', `${site.url}/good.html`, '--storage-state', `admin=${file}`, '--out', outputDir('a11y-storage2')]);
    assert.equal(named.status, 0, named.stderr);
  });

  test('reports a keyboard trap', async () => {
    const out = outputDir('a11y-trap');
    const r = await run(SCRIPT, ['--url', `${site.url}/trap.html`, '--out', out]);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(keys(read(out)), ['kbd-trap #trap']);
  });
});

describe('a11y-audit axe merge', { skip }, () => {
  let site;
  before(async () => { site = await serve(path.join(FIXTURES, 'a11y-site')); });
  after(() => site?.close());

  test('merges axe results labelled by source when axe-core resolves', async () => {
    const out = outputDir('a11y-axe');
    const env = { ...process.env, NODE_PATH: path.join(FIXTURES, 'fake-axe') };
    const r = await run(SCRIPT, ['--url', `${site.url}/good.html`, '--out', out], { env });
    assert.equal(r.status, 0, r.stderr);
    const report = read(out);
    assert.equal(report.axe.available, true);
    const f = report.findings.filter((x) => x.source === 'axe');
    assert.equal(f.length, 1);
    assert.equal(f[0].rule, 'fake-rule');
    assert.equal(f[0].wcag, '1.4.3');
    assert.equal(f[0].severity, 'serious');
    assert.match(readFileSync(path.join(out, 'a11y.md'), 'utf8'), /axe/);
  });

  test('says «axe no disponible» and continues when axe-core does not resolve', async () => {
    const out = outputDir('a11y-noaxe');
    const empty = outputDir('a11y-empty-global');
    const env = { ...process.env, UX_STUDIO_GLOBAL_NODE_MODULES: empty };
    delete env.NODE_PATH;
    const r = await run(SCRIPT, ['--url', `${site.url}/good.html`, '--out', out], { env });
    assert.equal(r.status, 0, r.stderr);
    const report = read(out);
    assert.equal(report.axe.available, false);
    assert.match(readFileSync(path.join(out, 'a11y.md'), 'utf8'), /axe no disponible/);
  });
});

describe('a11y-audit with a showcase', { skip }, () => {
  let site;
  before(async () => { site = await serve(path.join(FIXTURES, 'a11y-showcase')); });
  after(() => site?.close());

  test('audits every screen per role that may see it and labels each finding', async () => {
    const out = outputDir('a11y-showcase');
    const r = await run(SCRIPT, ['--showcase', `${site.url}/`, '--out', out]);
    assert.equal(r.status, 0, r.stderr);
    const report = read(out);
    assert.deepEqual(report.findings.filter((f) => f.source === 'native').map((f) => [f.rule, f.selector, f.screen, f.role]), [
      ['contrast-text', '#faint', 'detalle', 'admin'],
    ]);
    assert.deepEqual(report.audited.map((a) => `${a.screen}@${a.role}`).sort(), ['detalle@admin', 'inicio@admin', 'inicio@viewer']);
  });

  test('a showcase that does not declare the platform reports its reason in one line', async () => {
    const web = await serve(path.join(FIXTURES, 'showcase-web-only'));
    try {
      const t = Date.now();
      const r = await run(SCRIPT, ['--showcase', `${web.url}/`, '--platform', 'phone', '--out', outputDir('a11y-undeclared')]);
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /LAYOUT\.platforms declares only web/);
      assert.equal(r.stderr.trim().split('\n').length, 1, r.stderr);
      assert.ok(Date.now() - t < 12_000);
    } finally {
      await web.close();
    }
  });
});

describe('a11y-audit output isolation', { skip }, () => {
  let site;
  before(async () => { site = await serve(path.join(FIXTURES, 'a11y-site')); });
  after(() => site?.close());

  test('two parallel runs with different --out never share a file', async () => {
    const a = outputDir('a11y-iso-a');
    const b = outputDir('a11y-iso-b');
    const [ra, rb] = await Promise.all([
      run(SCRIPT, ['--url', `${site.url}/bad.html`, '--out', a]),
      run(SCRIPT, ['--url', `${site.url}/good.html`, '--out', b]),
    ]);
    assert.equal(ra.status, 0, ra.stderr);
    assert.equal(rb.status, 0, rb.stderr);
    assert.match(read(a).input.url, /bad\.html$/);
    assert.match(read(b).input.url, /good\.html$/);
    assert.ok(read(a).findings.length > 0);
    assert.equal(read(b).findings.length, 0);
    assert.ok(!ra.stdout.includes(b) && !rb.stdout.includes(a));
  });

  test('the default output is tmp/ux-audit/ under the working directory', async () => {
    const cwd = outputDir('a11y-default');
    const env = { ...process.env, NODE_PATH: path.join(HERE, 'node_modules') };
    const r = await run(SCRIPT, ['--url', `${site.url}/good.html`], { cwd, env });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(path.join(cwd, 'tmp/ux-audit/a11y.json')));
    assert.ok(existsSync(path.join(cwd, 'tmp/ux-audit/a11y.md')));
  });
});
