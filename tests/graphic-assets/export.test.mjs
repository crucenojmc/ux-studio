// export.mjs: SVG and HTML pieces to PNG at sizes x DPR, presets, the favicon set and provenance.
// Rendering tests use an existing Chromium-family browser and skip when none is found.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { HERE, asset, fixture, gitRepo, hasPlaywright, outputDir, readJson, run, sha256 } from './helpers.mjs';

const script = asset('export.mjs');
const { findChrome } = await import(script);
const SVG = fixture('badge.svg');
const HTML = fixture('piece.html');

const skipRender = !hasPlaywright()
  ? 'playwright-core is not installed: link or install tests/graphic-assets/node_modules'
  : !findChrome()
    ? 'no Chromium-family browser found (set CHROME_PATH); tests never download one'
    : false;

const { PNG } = hasPlaywright() ? createRequire(path.join(HERE, 'package.json'))('pngjs') : {};
const png = (file) => PNG.sync.read(readFileSync(file));
const pixel = (img, x, y) => [...img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];

describe('export.mjs usage', () => {
  test('--help prints the usage and exits 0', async () => {
    const res = await run(script, ['--help']);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /Usage:/);
    assert.match(res.stdout, /--preset/);
    assert.match(res.stdout, /--dpr/);
  });

  test('--list-presets names app-icon, favicon and the social sizes', async () => {
    const res = await run(script, ['--list-presets']);
    assert.equal(res.status, 0, res.stderr);
    for (const p of ['app-icon', 'favicon', 'social-square', 'social-portrait', 'social-link', 'social-landscape']) assert.match(res.stdout, new RegExp(`^${p}\\b`, 'm'));
    for (const s of ['1080x1080', '1080x1350', '1200x630', '1920x1080']) assert.match(res.stdout, new RegExp(s));
  });

  test('bad arguments exit 64 before any browser starts', async () => {
    const out = outputDir('export-usage');
    for (const args of [
      ['--out', out, '--size', '24x24'],
      ['--input', path.join(out, 'missing.svg'), '--out', out, '--size', '24x24'],
      ['--input', fixture('tokens.css'), '--out', out, '--size', '24x24'],
      ['--input', SVG, '--out', out],
      ['--input', SVG, '--out', out, '--size', '24'],
      ['--input', SVG, '--out', out, '--size', '24x24', '--dpr', '5'],
      ['--input', SVG, '--out', out, '--preset', 'poster'],
      ['--input', SVG, '--out', out, '--preset', 'app-icon', '--dpr', '2'],
      ['--input', SVG, '--out', out, '--size', '24x24', '--background', 'red;}body{'],
      ['--input', SVG, '--size', '24x24'],
    ]) {
      const res = await run(script, args);
      assert.equal(res.status, 64, `${args.join(' ')}\n${res.stderr}`);
      assert.match(res.stderr, /^error: /m);
    }
    assert.deepEqual(readdirSync(out), []);
  });

  test('refuses an output folder that git tracks (a product repository)', async () => {
    const repo = gitRepo('export-guard-repo');
    const res = await run(script, ['--input', SVG, '--out', path.join(repo, 'public'), '--size', '24x24']);
    assert.equal(res.status, 64, res.stderr);
    assert.match(res.stderr, /not git-ignored/);
  });
});

describe('export.mjs rendering', { skip: skipRender }, () => {
  test('renders an SVG at every size x DPR, transparent, with currentColor from --color', async () => {
    const out = outputDir('export-svg');
    const res = await run(script, ['--input', SVG, '--out', out, '--size', '24x24', '--dpr', '1,2,3', '--color', '#ff0000']);
    assert.equal(res.status, 0, res.stderr);
    for (const d of [1, 2, 3]) {
      const img = png(path.join(out, `badge-24x24@${d}x.png`));
      assert.equal(img.width, 24 * d);
      assert.equal(img.height, 24 * d);
      assert.deepEqual(pixel(img, 12 * d, 12 * d), [255, 0, 0, 255], `@${d}x centre takes --color`);
      assert.equal(pixel(img, 0, 0)[3], 0, `@${d}x corner is transparent`);
    }
  });

  test('--background paints an opaque background', async () => {
    const out = outputDir('export-background');
    const res = await run(script, ['--input', SVG, '--out', out, '--size', '32x32', '--background', '#00ff00', '--name', 'tile']);
    assert.equal(res.status, 0, res.stderr);
    assert.deepEqual(pixel(png(path.join(out, 'tile-32x32@1x.png')), 0, 0), [0, 255, 0, 255]);
  });

  test('renders an HTML piece at a social preset size, keeping its own background', async () => {
    const out = outputDir('export-html');
    const res = await run(script, ['--input', HTML, '--out', out, '--preset', 'social-link']);
    assert.equal(res.status, 0, res.stderr);
    const img = png(path.join(out, 'piece-social-link-1200x630@1x.png'));
    assert.equal(img.width, 1200);
    assert.equal(img.height, 630);
    assert.deepEqual(pixel(img, 2, 2), [0x12, 0x34, 0x56, 255]);
  });

  test('the favicon preset writes the conventional files and a multi-size favicon.ico', async () => {
    const out = outputDir('export-favicon');
    const res = await run(script, ['--input', SVG, '--out', out, '--preset', 'favicon', '--background', '#ffffff']);
    assert.equal(res.status, 0, res.stderr);
    const sizes = { 'favicon-16x16.png': 16, 'favicon-32x32.png': 32, 'favicon-48x48.png': 48, 'apple-touch-icon.png': 180, 'android-chrome-192x192.png': 192, 'android-chrome-512x512.png': 512 };
    for (const [file, s] of Object.entries(sizes)) {
      const img = png(path.join(out, file));
      assert.deepEqual([img.width, img.height], [s, s], file);
    }
    const ico = readFileSync(path.join(out, 'favicon.ico'));
    assert.deepEqual([ico.readUInt16LE(0), ico.readUInt16LE(2), ico.readUInt16LE(4)], [0, 1, 3], 'ICO header: reserved, type icon, 3 images');
    assert.deepEqual([0, 1, 2].map((k) => ico[6 + 16 * k]), [16, 32, 48]);
    const firstOffset = ico.readUInt32LE(6 + 12);
    assert.equal(ico.subarray(firstOffset, firstOffset + 8).toString('hex'), '89504e470d0a1a0a', 'entries embed PNG data');
  });

  test('every output records its source in manifest.json', async () => {
    const out = outputDir('export-manifest');
    assert.equal((await run(script, ['--input', SVG, '--out', out, '--size', '16x16', '--dpr', '1,2'])).status, 0);
    assert.equal((await run(script, ['--input', HTML, '--out', out, '--preset', 'social-square'])).status, 0);
    const outputs = readJson(path.join(out, 'manifest.json')).outputs;
    assert.deepEqual(outputs.map((o) => o.file).sort(), ['badge-16x16@1x.png', 'badge-16x16@2x.png', 'piece-social-square-1080x1080@1x.png']);
    for (const o of outputs) {
      const src = o.file.startsWith('badge') ? SVG : HTML;
      assert.equal(path.resolve(out, o.source), src, o.file);
      assert.equal(o.sourceSha256, sha256(src), o.file);
      assert.equal(o.tool, 'export.mjs');
      assert.ok(o.width > 0 && o.height > 0 && o.dpr >= 1, o.file);
    }
  });

  test('parallel runs with different --out never collide', async () => {
    const root = outputDir('export-parallel');
    const [a, b] = await Promise.all([
      run(script, ['--input', SVG, '--out', path.join(root, 'run-a'), '--size', '24x24', '--dpr', '1,2']),
      run(script, ['--input', HTML, '--out', path.join(root, 'run-b'), '--preset', 'social-square']),
    ]);
    assert.equal(a.status, 0, a.stderr);
    assert.equal(b.status, 0, b.stderr);
    assert.deepEqual(readdirSync(path.join(root, 'run-a')).sort(), ['badge-24x24@1x.png', 'badge-24x24@2x.png', 'manifest.json']);
    assert.deepEqual(readdirSync(path.join(root, 'run-b')).sort(), ['manifest.json', 'piece-social-square-1080x1080@1x.png']);
    assert.equal(readJson(path.join(root, 'run-a', 'manifest.json')).outputs.length, 2);
    assert.equal(readJson(path.join(root, 'run-b', 'manifest.json')).outputs.length, 1);
    assert.equal(existsSync(path.join(root, 'manifest.json')), false);
  });
});
