import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { FIXTURES, asset, hasPlaywright, outputDir, run, serve } from './helpers.mjs';

const { findBrowser } = await import(asset('lib/browser.mjs'));
const skip = !hasPlaywright() || !findBrowser() ? 'playwright-core or a Chromium-family browser is missing' : false;
const REASON = /LAYOUT\.platforms declares only web/;

describe('a showcase that refuses an undeclared platform', { skip }, () => {
  let site;
  before(async () => { site = await serve(path.join(FIXTURES, 'showcase-web-only')); });
  after(() => site?.close());

  const assertFast = (r, ms) => {
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, REASON, r.stderr);
    assert.equal(r.stderr.trim().split('\n').length, 1, `one line: ${r.stderr}`);
    assert.ok(ms < 12_000, `failed fast, took ${ms} ms`);
  };

  test('nav-graph --showcase reports the reason', async () => {
    const t = Date.now();
    const r = await run(asset('nav-graph.mjs'), ['--showcase', `${site.url}/?capture=phone`, '--out', outputDir('undeclared-nav')]);
    assertFast(r, Date.now() - t);
  });

  test('space-audit reports the reason instead of waiting for a selector', async () => {
    const out = outputDir('undeclared-space');
    const config = path.join(out, 'space.json');
    writeFileSync(config, JSON.stringify({
      baseUrl: site.url, timeout: 20000, waitFor: '[data-proto=title]',
      pages: [{ id: 'home', url: '/?capture=phone' }],
    }));
    const t = Date.now();
    const r = await run(asset('space-audit.mjs'), ['--config', config, '--out', out]);
    assertFast(r, Date.now() - t);
  });
});
