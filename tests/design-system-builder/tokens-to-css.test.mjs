import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, before } from 'node:test';
import { outputDir, runNode, sampleTokens, tokensToCss } from './helpers.mjs';

/** Body of the first rule whose selector starts exactly with `selector {` (brace-balanced). */
function block(css, selector) {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) return null;
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(css.indexOf('{', start) + 1, i);
    }
  }
  return null;
}

const sample = () => JSON.parse(readFileSync(sampleTokens, 'utf8'));
const colorToken = (tokens, name) => tokens.color.tokens.find((t) => t.name === name);

describe('tokens-to-css.mjs — CSS generation from the sample system', () => {
  let css;
  let tokens;

  before(() => {
    tokens = sample();
    const result = runNode(tokensToCss, [sampleTokens]);
    assert.equal(result.status, 0, `expected exit 0, stderr:\n${result.stderr}`);
    css = result.stdout;
  });

  it('puts the first (default) theme on :root', () => {
    const root = block(css, ':root, [data-theme="light"]');
    assert.ok(root, `no default-theme block in:\n${css}`);
    const page = colorToken(tokens, 'surface-page').value.light;
    assert.match(root, new RegExp(`--surface-page: ${page};`));
    assert.match(root, /--text-primary: #[0-9a-f]{6};/);
  });

  it('writes the dark theme under [data-theme="dark"]', () => {
    const dark = block(css, '[data-theme="dark"]');
    assert.ok(dark, 'no [data-theme="dark"] block');
    const page = colorToken(tokens, 'surface-page').value.dark;
    assert.match(dark, new RegExp(`--surface-page: ${page};`));
  });

  it('repeats the dark theme under prefers-color-scheme for pages without data-theme', () => {
    const media = block(css, '@media (prefers-color-scheme: dark)');
    assert.ok(media, 'no prefers-color-scheme block');
    assert.match(media, /:root:not\(\[data-theme="light"\]\) \{/);
    const page = colorToken(tokens, 'surface-page').value.dark;
    assert.match(media, new RegExp(`--surface-page: ${page};`));
  });

  it('declares color-scheme: light at the root and dark in every dark block', () => {
    assert.match(block(css, ':root, [data-theme="light"]'), /color-scheme: light;/);
    assert.match(block(css, '[data-theme="dark"]'), /color-scheme: dark;/);
    assert.match(block(css, '@media (prefers-color-scheme: dark)'), /color-scheme: dark;/);
  });

  it('turns aliases into var() and re-declares them in every theme block', () => {
    const alias = colorToken(tokens, 'focus-ring').value;
    assert.equal(alias, '{accent}', 'the sample is expected to alias focus-ring to accent');
    assert.match(block(css, ':root, [data-theme="light"]'), /--focus-ring: var\(--accent\);/);
    assert.match(block(css, '[data-theme="dark"]'), /--focus-ring: var\(--accent\);/);
  });

  it('emits font families and text styles as custom properties', () => {
    assert.ok(css.includes(`--font-sans: ${tokens.type.families.sans};`), 'missing --font-sans');
    for (const style of ['display', 'title', 'heading', 'body', 'label', 'caption']) {
      assert.match(css, new RegExp(`--text-${style}-size: [0-9.]+(px|rem);`), `missing --text-${style}-size`);
      assert.match(css, new RegExp(`--text-${style}-line: [0-9.]+(px|rem)?;`), `missing --text-${style}-line`);
      assert.match(css, new RegExp(`--text-${style}-weight: [0-9]+;`), `missing --text-${style}-weight`);
    }
  });

  it('emits spacing, radius and shadow tokens', () => {
    assert.match(css, /--space-1: 4px;/);
    assert.match(css, /--space-8: 64px;/);
    assert.match(css, /--radius-pill: 9999px;/);
    assert.match(block(css, ':root, [data-theme="light"]'), /--shadow-raised: /);
    assert.match(block(css, '[data-theme="dark"]'), /--shadow-overlay: /);
  });

  it('adds the motion defaults', () => {
    for (const decl of [
      '--duration-fast: 120ms;',
      '--duration-base: 200ms;',
      '--duration-slow: 320ms;',
      '--ease-out: cubic-bezier(.22,1,.36,1);',
      '--ease-in-out: cubic-bezier(.65,0,.35,1);',
      '--ease-sheet: cubic-bezier(.32,.72,0,1);',
    ]) {
      assert.ok(css.includes(decl), `missing ${decl}`);
    }
  });
});

describe('tokens-to-css.mjs — options', () => {
  it('--out writes the same CSS it prints', () => {
    const dir = outputDir('tokens-to-css-out');
    const file = path.join(dir, 'tokens.css');
    const toFile = runNode(tokensToCss, [sampleTokens, '--out', file]);
    assert.equal(toFile.status, 0, toFile.stderr);
    const toStdout = runNode(tokensToCss, [sampleTokens]);
    assert.equal(readFileSync(file, 'utf8'), toStdout.stdout);
  });

  it('--motion overrides only the keys it names', () => {
    const dir = outputDir('tokens-to-css-motion');
    const motion = path.join(dir, 'motion.json');
    writeFileSync(motion, JSON.stringify({ '--duration-fast': '90ms' }));
    const result = runNode(tokensToCss, [sampleTokens, '--motion', motion]);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes('--duration-fast: 90ms;'));
    assert.ok(!result.stdout.includes('--duration-fast: 120ms;'));
    assert.ok(result.stdout.includes('--duration-base: 200ms;'));
  });

  it('--style-classes adds one class per text style, like the page\'s own tokens.css', () => {
    const plain = runNode(tokensToCss, [sampleTokens]);
    assert.ok(!/^\.body \{/m.test(plain.stdout), 'no style classes by default (they collide with prototype class names)');
    const result = runNode(tokensToCss, [sampleTokens, '--style-classes']);
    assert.equal(result.status, 0, result.stderr);
    const body = block(result.stdout, '.body');
    assert.ok(body, 'missing .body class');
    assert.match(body, /font-family: var\(--font-sans\);/);
    assert.match(body, /font-size: var\(--text-body-size\);/);
    assert.match(block(result.stdout, '.display'), /font-family: var\(--font-display\);/);
  });

  it('exits 2 with usage when no tokens file is given', () => {
    const result = runNode(tokensToCss, []);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /usage/i);
  });
});

describe('tokens-to-css.mjs --check', () => {
  let dir;
  before(() => {
    dir = outputDir('tokens-to-css-check');
  });

  function check(mutate, name) {
    const tokens = sample();
    mutate(tokens);
    const file = path.join(dir, `${name}.json`);
    writeFileSync(file, JSON.stringify(tokens, null, 2));
    return runNode(tokensToCss, [file, '--check']);
  }

  it('passes on the sample', () => {
    const result = runNode(tokensToCss, [sampleTokens, '--check']);
    assert.equal(result.status, 0, `stderr:\n${result.stderr}`);
    assert.match(result.stdout, /OK/);
  });

  it('fails on a DTCG / W3C name→value map', () => {
    const result = check((t) => {
      t.color = { 'surface-page': { $value: '#ffffff', $type: 'color' } };
    }, 'dtcg-map');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /color/);
    assert.match(result.stderr, /map|DTCG/i);
  });

  it('fails when a required token is missing', () => {
    const result = check((t) => {
      t.color.tokens = t.color.tokens.filter((x) => x.name !== 'status-warn-bg');
    }, 'missing-required');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /status-warn-bg/);
  });

  it('fails on a named color', () => {
    const result = check((t) => {
      t.color.tokens.find((x) => x.name === 'text-tertiary').value.light = 'gray';
    }, 'named-color');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /text-tertiary/);
    assert.match(result.stderr, /named color|not an allowed color/i);
  });

  it('fails when body text contrast is under 4.5:1 in a theme', () => {
    const result = check((t) => {
      const page = t.color.tokens.find((x) => x.name === 'surface-page').value.dark;
      t.color.tokens.find((x) => x.name === 'text-secondary').value.dark = page.replace(/.$/, '0');
    }, 'low-contrast');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /text-secondary/);
    assert.match(result.stderr, /dark/);
    assert.match(result.stderr, /4\.5/);
  });

  it('reports a non-object color family as an error, without crashing, even without --check', () => {
    const tokens = sample();
    tokens.color = '#ffffff';
    const file = path.join(dir, 'color-not-object.json');
    writeFileSync(file, JSON.stringify(tokens));
    const result = runNode(tokensToCss, [file]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /family "color"/);
    assert.doesNotMatch(result.stderr, /TypeError|at .*\.mjs:\d+/);
  });

  it('fails on a name used twice across families', () => {
    const result = check((t) => {
      t.radius.tokens.push({ name: 'accent', value: '2px', usage: 'Duplicate on purpose.' });
    }, 'duplicate-name');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /accent/);
    assert.match(result.stderr, /duplicate|more than once/i);
  });

  it('names both families of a cross-family collision and suggests the family prefix', () => {
    const result = check((t) => {
      t.radius.tokens.push({ name: 'home-tip', value: '14px', usage: 'Tip card corner.' });
      t.shadow.tokens.push({ name: 'home-tip', value: '0 1px 2px #0003', usage: 'Tip card shadow.' });
    }, 'cross-family-collision');
    assert.equal(result.status, 1);
    const line = result.stderr.split('\n').find((l) => l.includes('home-tip'));
    assert.ok(line, result.stderr);
    assert.match(line, /radius/);
    assert.match(line, /shadow/);
    assert.match(line, /radius-home-tip/);
    assert.match(line, /shadow-home-tip/);
  });

  it('says so when a name repeats inside one family', () => {
    const result = check((t) => {
      t.radius.tokens.push({ name: 'radius-sm', value: '3px', usage: 'Again.' });
    }, 'same-family-duplicate');
    assert.equal(result.status, 1);
    const line = result.stderr.split('\n').find((l) => l.includes('radius-sm'));
    assert.match(line, /twice in the "radius" family/);
  });
});
