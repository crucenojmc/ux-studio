import assert from 'node:assert/strict';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { extractStyles, outputDir, runNode, runNodeAsync, testsDir } from './helpers.mjs';

const fixtureDir = path.join(testsDir, 'fixtures', 'site');

/** PNG width from the IHDR chunk (bytes 16..19, big-endian). */
const pngWidth = (file) => readFileSync(file).readUInt32BE(16);
const values = (list) => list.map((entry) => entry.value);

describe('extract-styles.mjs against a local fixture site', () => {
  let server;
  let url;
  let result;
  let out;

  before(async () => {
    server = createServer((req, res) => {
      const file = path.join(fixtureDir, req.url === '/' ? 'index.html' : path.normalize(req.url));
      if (!file.startsWith(fixtureDir) || !existsSync(file)) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(readFileSync(file));
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${server.address().port}/`;
    out = outputDir('extract-styles');
    // cwd = this tests folder, so playwright-core resolves from its node_modules.
    result = await runNodeAsync(extractStyles, [url, '--out', out, '--widths', '1440,390'], { cwd: testsDir });
  });

  after(() => server?.close());

  it('runs to completion (exit 3 means no local browser: skipped)', (t) => {
    if (result.status === 3) t.skip(`no Chromium-family browser found: ${result.stderr.trim()}`);
    assert.equal(result.status, 0, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  });

  it('takes one full-page screenshot per width', (t) => {
    if (result.status !== 0) return t.skip('extraction did not run');
    for (const width of [1440, 390]) {
      const file = path.join(out, `screenshot-${width}.png`);
      assert.ok(existsSync(file), `missing ${file}`);
      assert.equal(pngWidth(file), width);
    }
  });

  it('finds the fixture colors, ranked and split by role', (t) => {
    if (result.status !== 0) return t.skip('extraction did not run');
    const styles = JSON.parse(readFileSync(path.join(out, 'styles.json'), 'utf8'));
    assert.ok(values(styles.colors.text).includes('#1f2933'), 'body text color');
    assert.ok(values(styles.colors.text).includes('#52606d'), 'muted text color');
    assert.ok(values(styles.colors.background).includes('#f7f3ea'), 'page background');
    assert.ok(values(styles.colors.background).includes('#c2410c'), 'button background');
    assert.ok(values(styles.colors.border).includes('#d9d2c3'), 'border color');
    const all = [...styles.colors.text, ...styles.colors.background, ...styles.colors.border];
    assert.ok(!values(all).includes('#ff00ff'), 'hidden elements must not count');
    for (const list of [styles.colors.text, styles.colors.background]) {
      const counts = list.map((entry) => entry.count);
      assert.deepEqual(counts, [...counts].sort((a, b) => b - a), 'ranked by frequency');
    }
    assert.ok(styles.colors.text[0].samples.length > 0, 'each value says where it appears');
  });

  it('finds the fixture font, sizes, radius, spacing and shadow', (t) => {
    if (result.status !== 0) return t.skip('extraction did not run');
    const styles = JSON.parse(readFileSync(path.join(out, 'styles.json'), 'utf8'));
    assert.ok(styles.fontFamilies.some((entry) => entry.value.includes('Fixture Sans')), 'font family');
    assert.ok(values(styles.fontSizes).includes('17px'));
    assert.ok(values(styles.fontSizes).includes('32px'), 'desktop heading size');
    assert.ok(values(styles.fontSizes).includes('26px'), 'mobile heading size');
    assert.ok(values(styles.fontWeights).includes('600'));
    assert.ok(values(styles.radii).includes('10px'));
    assert.ok(values(styles.spacing).includes('24px'));
    assert.ok(styles.shadows.length > 0, 'box-shadow on the card');
  });
});

describe('extract-styles.mjs without playwright-core', () => {
  it('prints the install hint and exits 2', () => {
    // A copy far from any node_modules, with HOME pointed at it so no global folder resolves.
    const dir = outputDir('extract-styles-no-playwright');
    const copy = path.join(dir, 'extract-styles.mjs');
    copyFileSync(extractStyles, copy);
    const env = { PATH: process.env.PATH, HOME: dir, USERPROFILE: dir };
    const result = runNode(copy, ['https://example.invalid/', '--out', dir], { cwd: dir, env });
    assert.equal(result.status, 2, `stderr:\n${result.stderr}`);
    assert.match(result.stderr, /npm i -D playwright-core/);
  });
});
