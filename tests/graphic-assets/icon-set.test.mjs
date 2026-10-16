// icon-set.mjs: spec validation, one optimized SVG per icon, the sprite, the contact sheet and provenance.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { asset, fixture, gitRepo, outputDir, readJson, run, sha256 } from './helpers.mjs';

const script = asset('icon-set.mjs');
const SPEC = fixture('icons.spec.json');
const TOKENS = fixture('tokens.css');
const NAMES = ['search', 'inbox', 'alert-circle'];

/** Writes a variant of the fixture spec (mutated by `edit`) into dir and returns its path. */
function variant(dir, edit, file = 'icons.spec.json') {
  const spec = readJson(SPEC);
  edit(spec);
  const p = path.join(dir, file);
  writeFileSync(p, JSON.stringify(spec, null, 2));
  return p;
}

const svgRoot = (svg) => svg.match(/^<svg\b[^>]*>/)?.[0] ?? '';

describe('icon-set.mjs usage', () => {
  test('--help prints the usage and exits 0', async () => {
    const res = await run(script, ['--help']);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /Usage:/);
    assert.match(res.stdout, /--spec/);
    assert.match(res.stdout, /--out/);
  });

  test('a missing --spec, an unknown option and an unreadable spec exit 64', async () => {
    const out = outputDir('icon-usage');
    for (const args of [
      ['--out', out],
      ['--spec', SPEC, '--out', out, '--colour', 'red'],
      ['--spec', path.join(out, 'missing.json'), '--out', out],
      ['--spec', SPEC],
    ]) {
      const res = await run(script, args);
      assert.equal(res.status, 64, `${args.join(' ')}\n${res.stderr}`);
      assert.match(res.stderr, /^error: /m);
      assert.match(res.stderr, /--help/);
    }
  });

  test('a spec that is not JSON exits 64', async () => {
    const out = outputDir('icon-bad-json');
    const bad = path.join(out, 'bad.json');
    writeFileSync(bad, '{ "name": ');
    const res = await run(script, ['--spec', bad, '--out', path.join(out, 'graphics')]);
    assert.equal(res.status, 64, res.stderr);
  });
});

describe('icon-set.mjs generation', () => {
  test('writes one optimized currentColor SVG per icon with the grid as viewBox and no size', async () => {
    const out = outputDir('icon-generate');
    const res = await run(script, ['--spec', SPEC, '--out', out]);
    assert.equal(res.status, 0, res.stderr);
    assert.deepEqual(readdirSync(path.join(out, 'svg')).sort(), NAMES.map((n) => `${n}.svg`).sort());
    for (const name of NAMES) {
      const svg = readFileSync(path.join(out, 'svg', `${name}.svg`), 'utf8');
      const root = svgRoot(svg);
      assert.match(root, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
      assert.match(root, /viewBox="0 0 24 24"/);
      assert.match(root, /fill="none"/);
      assert.match(root, /stroke="currentColor"/);
      assert.match(root, /stroke-width="2"/);
      assert.match(root, /stroke-linecap="round"/);
      assert.match(root, /stroke-linejoin="round"/);
      assert.doesNotMatch(root, /\s(width|height)=/, `${name}: no width/height unless asked`);
      assert.doesNotMatch(svg, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i, `${name}: no hardcoded colours`);
      assert.doesNotMatch(svg, /\n\s*</, `${name}: optimized (no indentation)`);
      assert.match(svg, /<\/svg>\n?$/);
    }
    const search = readFileSync(path.join(out, 'svg', 'search.svg'), 'utf8');
    assert.match(search, /<circle cx="11" cy="11" r="7"\/>/);
    assert.match(search, /<line x1="16" y1="16" x2="21" y2="21"\/>/);
    const inbox = readFileSync(path.join(out, 'svg', 'inbox.svg'), 'utf8');
    assert.match(inbox, /<rect x="3" y="4" width="18" height="16" rx="2"\/>/, 'the set corner radius applies to rects');
    assert.match(inbox, /<polyline points="3,13 8,13 10,16 14,16 16,13 21,13"\/>/);
    const alert = readFileSync(path.join(out, 'svg', 'alert-circle.svg'), 'utf8');
    assert.match(alert, /<path d="M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18z"\/>/);
    assert.match(alert, /<circle cx="12" cy="16" r="1" fill="currentColor" stroke="none"\/>/);
  });

  test('--size adds width and height', async () => {
    const out = outputDir('icon-size');
    const res = await run(script, ['--spec', SPEC, '--out', out, '--size', '32']);
    assert.equal(res.status, 0, res.stderr);
    const root = svgRoot(readFileSync(path.join(out, 'svg', 'search.svg'), 'utf8'));
    assert.match(root, /width="32"/);
    assert.match(root, /height="32"/);
  });

  test('the sprite holds one symbol per icon, each with the grid viewBox', async () => {
    const out = outputDir('icon-sprite');
    const res = await run(script, ['--spec', SPEC, '--out', out]);
    assert.equal(res.status, 0, res.stderr);
    const sprite = readFileSync(path.join(out, 'icons.svg'), 'utf8');
    assert.match(sprite, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    const ids = [...sprite.matchAll(/<symbol id="([^"]+)" viewBox="0 0 24 24"/g)].map((m) => m[1]);
    assert.deepEqual(ids.sort(), NAMES.map((n) => `icon-${n}`).sort());
    assert.equal((sprite.match(/<symbol\b/g) || []).length, NAMES.length);
    assert.match(sprite, /<symbol id="icon-search"[^>]*stroke="currentColor"[^>]*>.*<circle cx="11" cy="11" r="7"\/>.*<\/symbol>/s);
    assert.doesNotMatch(sprite, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  });

  test('the contact sheet shows every icon and inlines the design-system tokens when given', async () => {
    const out = outputDir('icon-preview');
    const res = await run(script, ['--spec', SPEC, '--out', out, '--tokens', TOKENS]);
    assert.equal(res.status, 0, res.stderr);
    const html = readFileSync(path.join(out, 'preview.html'), 'utf8');
    assert.match(html, /^<!doctype html>/i);
    for (const name of NAMES) {
      assert.match(html, new RegExp(`<use href="#icon-${name}"`));
      assert.match(html, new RegExp(`>${name}<`));
    }
    assert.match(html, /--fixture-marker: 1/, 'tokens.css is inlined');
    assert.match(html, /var\(--text-primary/, 'icons take the colour token');
    assert.match(html, /data-theme="light"/);
    assert.match(html, /data-theme="dark"/);
    assert.match(html, /aria-hidden="true"/, 'decorative previews are hidden from assistive tech');
  });

  test('the contact sheet falls back to neutral built-in tokens without --tokens', async () => {
    const out = outputDir('icon-preview-neutral');
    const res = await run(script, ['--spec', SPEC, '--out', out]);
    assert.equal(res.status, 0, res.stderr);
    const html = readFileSync(path.join(out, 'preview.html'), 'utf8');
    assert.match(html, /--text-primary:/);
    assert.doesNotMatch(html, /--fixture-marker/);
  });

  test('every output records its source spec in manifest.json and in the file', async () => {
    const out = outputDir('icon-manifest');
    const res = await run(script, ['--spec', SPEC, '--out', out]);
    assert.equal(res.status, 0, res.stderr);
    const manifest = readJson(path.join(out, 'manifest.json'));
    const files = manifest.outputs.map((o) => o.file).sort();
    assert.deepEqual(files, ['icons.svg', 'preview.html', ...NAMES.map((n) => `svg/${n}.svg`)].sort());
    for (const o of manifest.outputs) {
      assert.equal(path.resolve(out, o.source), SPEC, `${o.file} source`);
      assert.equal(o.sourceSha256, sha256(SPEC), `${o.file} hash`);
      assert.equal(o.tool, 'icon-set.mjs');
    }
    for (const file of ['icons.svg', 'preview.html', 'svg/search.svg']) {
      assert.match(readFileSync(path.join(out, file), 'utf8'), /<!-- graphic-assets: .*icons\.spec\.json sha256:[0-9a-f]{12} -->/, file);
    }
  });

  test('regenerating with fewer icons removes the stale SVGs it wrote before', async () => {
    const out = outputDir('icon-stale');
    assert.equal((await run(script, ['--spec', SPEC, '--out', out])).status, 0);
    const smaller = variant(outputDir('icon-stale-spec'), (s) => s.icons.splice(2, 1));
    const res = await run(script, ['--spec', smaller, '--out', out]);
    assert.equal(res.status, 0, res.stderr);
    assert.deepEqual(readdirSync(path.join(out, 'svg')).sort(), ['inbox.svg', 'search.svg']);
    assert.equal(readJson(path.join(out, 'manifest.json')).outputs.filter((o) => o.file.startsWith('svg/')).length, 2);
  });

  test('the shipped example spec is valid and warning-free', async () => {
    const res = await run(script, ['--spec', asset('icons.spec.example.json'), '--check']);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(res.stderr, '');
  });

  test('--check validates without writing anything', async () => {
    const out = path.join(outputDir('icon-check'), 'graphics');
    const res = await run(script, ['--spec', SPEC, '--out', out, '--check']);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /3 icons/);
    assert.equal(existsSync(out), false);
  });
});

describe('icon-set.mjs validation', () => {
  async function expectInvalid(name, edit, pattern) {
    const dir = outputDir(`icon-invalid-${name}`);
    const spec = variant(dir, edit);
    const out = path.join(dir, 'graphics');
    const res = await run(script, ['--spec', spec, '--out', out]);
    assert.equal(res.status, 1, res.stderr);
    assert.match(res.stderr, pattern);
    assert.equal(existsSync(out), false, 'an invalid spec writes nothing');
    return res;
  }

  test('a point outside the grid is an error naming the icon and the point', async () => {
    await expectInvalid('out-of-grid', (s) => (s.icons[0].shapes[1].x2 = 26), /icon "search".*\(26, 21\).*outside the 24×24 grid/);
  });

  test('an arc that bulges outside the grid is an error', async () => {
    await expectInvalid('arc', (s) => (s.icons[2].shapes[0].d = 'M3 12a10 10 0 1 1 18 0'), /icon "alert-circle".*outside the 24×24 grid/);
  });

  test('duplicate icon names are an error', async () => {
    await expectInvalid('duplicate', (s) => (s.icons[1].name = 'search'), /duplicate icon name "search"/);
  });

  test('hardcoded colours and per-shape stroke overrides are errors', async () => {
    const res = await expectInvalid(
      'colour-and-stroke',
      (s) => {
        s.icons[0].shapes[0].stroke = '#ff0000';
        s.icons[1].shapes[0].strokeWidth = 1.5;
      },
      /icon "search".*hardcoded colour/
    );
    assert.match(res.stderr, /icon "inbox".*stroke width is set once for the whole set/);
  });

  test('names must be kebab-case and shapes known', async () => {
    const res = await expectInvalid(
      'names-and-shapes',
      (s) => {
        s.icons[0].name = 'Search Icon';
        s.icons[1].shapes[0].type = 'ellipse';
      },
      /icon name "Search Icon" must be kebab-case/
    );
    assert.match(res.stderr, /icon "inbox".*unknown shape type "ellipse"/);
  });

  test('a point outside the live area only warns', async () => {
    const dir = outputDir('icon-live-area');
    const spec = variant(dir, (s) => (s.icons[0].shapes[1].x2 = 23));
    const res = await run(script, ['--spec', spec, '--out', path.join(dir, 'graphics')]);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stderr, /^warning: icon "search".*outside the live area/m);
  });
});

describe('icon-set.mjs output location', () => {
  test('refuses an output folder that git tracks (a product repository)', async () => {
    const repo = gitRepo('icon-guard-repo');
    const res = await run(script, ['--spec', SPEC, '--out', path.join(repo, 'src', 'icons')]);
    assert.equal(res.status, 64, res.stderr);
    assert.match(res.stderr, /not git-ignored/);
    assert.equal(existsSync(path.join(repo, 'src')), false);
  });

  test('--topic writes to tmp/<topic>/graphics/ at the git root of the cwd', async () => {
    const repo = gitRepo('icon-topic-repo');
    mkdirSync(path.join(repo, 'nested'), { recursive: true });
    const res = await run(script, ['--spec', SPEC, '--topic', 'demo'], { cwd: path.join(repo, 'nested') });
    assert.equal(res.status, 0, res.stderr);
    assert.ok(existsSync(path.join(repo, 'tmp', 'demo', 'graphics', 'icons.svg')));
  });

  test('parallel runs with different --out never collide', async () => {
    const root = outputDir('icon-parallel');
    const specA = variant(root, (s) => (s.icons = s.icons.slice(0, 1)), 'a.spec.json');
    const specB = variant(root, (s) => (s.icons = s.icons.slice(1)), 'b.spec.json');
    const [a, b] = await Promise.all([
      run(script, ['--spec', specA, '--out', path.join(root, 'run-a')]),
      run(script, ['--spec', specB, '--out', path.join(root, 'run-b')]),
    ]);
    assert.equal(a.status, 0, a.stderr);
    assert.equal(b.status, 0, b.stderr);
    assert.deepEqual(readdirSync(path.join(root, 'run-a', 'svg')), ['search.svg']);
    assert.deepEqual(readdirSync(path.join(root, 'run-b', 'svg')).sort(), ['alert-circle.svg', 'inbox.svg']);
    const srcA = readJson(path.join(root, 'run-a', 'manifest.json')).outputs.map((o) => path.resolve(root, 'run-a', o.source));
    const srcB = readJson(path.join(root, 'run-b', 'manifest.json')).outputs.map((o) => path.resolve(root, 'run-b', o.source));
    assert.ok(srcA.every((s) => s === specA));
    assert.ok(srcB.every((s) => s === specB));
  });
});
