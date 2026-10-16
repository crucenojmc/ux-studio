import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { FIXTURES, asset, hasPlaywright, noBrowserEnv, outputDir, run, serve } from './helpers.mjs';

const SCRIPT = asset('space-audit.mjs');
const { findBrowser } = await import(asset('lib/browser.mjs'));
const { coveredArea } = await import(SCRIPT);

const skip = !hasPlaywright()
  ? 'playwright-core is not installed: run `npm install` in tests/ux-flow-audit'
  : !findBrowser()
    ? 'no Chromium-family browser found (set CHROME_PATH); tests never download one'
    : false;

const near = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg}: expected ${expected}±${tol}, got ${actual}`);

describe('space-audit: union area', () => {
  test('overlapping rectangles are not double counted and are clipped', () => {
    const clip = { x: 0, y: 0, width: 100, height: 100 };
    const rects = [
      { x: 0, y: 0, width: 50, height: 50 },
      { x: 25, y: 25, width: 50, height: 50 },
      { x: 90, y: 90, width: 50, height: 50 },
    ];
    assert.equal(coveredArea(rects, clip), 2500 + 2500 - 625 + 100);
  });
});

describe('space-audit with a config file', { skip }, () => {
  let site;
  let report;
  let out;

  before(async () => {
    site = await serve(path.join(FIXTURES, 'space-site'));
    out = outputDir('space-audit');
    const config = path.join(out, 'space.json');
    writeFileSync(config, JSON.stringify({
      baseUrl: site.url,
      viewports: [
        { name: 'web', width: 1440, height: 900 },
        { name: 'phone', width: 390, height: 844 },
      ],
      selectors: { header: 'header', sidebar: 'aside', content: 'main', primary: '#crear' },
      pages: [
        { id: 'pedidos', url: '/index.html' },
        { id: 'recepcion', url: '/ok.html' },
      ],
    }));
    const r = await run(SCRIPT, ['--config', config, '--out', out]);
    assert.equal(r.status, 0, r.stderr);
    report = JSON.parse(readFileSync(path.join(out, 'space-audit.json'), 'utf8'));
  });

  after(() => site?.close());

  const result = (page, viewport) => report.results.find((r) => r.page === page && r.viewport.name === viewport);

  test('measures chrome vs content share of the first viewport', () => {
    const web = result('pedidos', 'web');
    near(web.chromePct, 22.6, 0.5, 'web chrome');
    near(web.contentPct, 77.4, 0.5, 'web content');
    const phone = result('pedidos', 'phone');
    near(phone.chromePct, 7.6, 0.5, 'phone chrome (sidebar hidden)');
  });

  test('detects a primary action below the fold and how far to scroll', () => {
    const web = result('pedidos', 'web');
    assert.equal(web.primary.found, true);
    assert.equal(web.primary.aboveFold, false);
    assert.ok(web.primary.scrollPx > 0);
    assert.ok(web.flags.includes('primary-below-fold'));
    assert.equal(result('recepcion', 'web').primary.aboveFold, true);
    assert.ok(!result('recepcion', 'web').flags.includes('primary-below-fold'));
  });

  test('detects horizontal overflow on the phone viewport only', () => {
    assert.equal(result('pedidos', 'web').horizontalOverflow, false);
    assert.equal(result('pedidos', 'phone').horizontalOverflow, true);
    assert.ok(result('pedidos', 'phone').flags.includes('horizontal-overflow'));
  });

  test('reports whitespace, text density and table column usage', () => {
    const web = result('pedidos', 'web');
    assert.ok(web.whitespacePct > 0 && web.whitespacePct < 100);
    assert.ok(web.textDensity > 0);
    assert.equal(web.tables.length, 1);
    assert.equal(web.tables[0].columns, 3);
    assert.deepEqual(web.tables[0].emptyColumns, ['Notas']);
  });

  test('writes a Markdown summary', () => {
    const md = readFileSync(path.join(out, 'space-audit.md'), 'utf8');
    assert.ok(md.includes('pedidos'));
    assert.ok(md.includes('primary-below-fold'));
  });
});

describe('space-audit with CLI flags', { skip }, () => {
  test('audits a single URL and viewport', async () => {
    const site = await serve(path.join(FIXTURES, 'space-site'));
    try {
      const r = await run(SCRIPT, ['--url', `${site.url}/ok.html`, '--viewport', '390x844', '--primary', '#crear', '--header', 'header', '--content', 'main']);
      assert.equal(r.status, 0, r.stderr);
      const json = JSON.parse(r.stdout);
      assert.equal(json.results.length, 1);
      assert.equal(json.results[0].viewport.width, 390);
      assert.equal(json.results[0].primary.aboveFold, true);
    } finally {
      await site.close();
    }
  });
});

describe('space-audit without a browser', () => {
  test('prints the install hint and exits 2', async () => {
    const r = await run(SCRIPT, ['--url', 'http://127.0.0.1:9/'], { env: noBrowserEnv() });
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /CHROME_PATH/);
  });
});
