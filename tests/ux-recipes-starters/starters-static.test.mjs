// Static checks for the ux-recipes HTML starters: artifact CDN rules, tokens, and per-starter contracts.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { cssOutsideMedia, readStarter, resourceUrls, starter, styleBlocks, tags, urlProblem, visibleText, voseo } from './helpers.mjs';

const STARTERS = ['animation.html', 'object-3d.html', 'html-email.html', 'diagram.html'];
const TOKEN_STARTERS = ['animation.html', 'object-3d.html', 'diagram.html'];

describe('every starter', () => {
  for (const name of STARTERS) {
    test(`${name} exists`, () => assert.ok(existsSync(starter(name)), `missing assets/starters/${name}`));
  }

  for (const name of STARTERS) {
    test(`${name}: one self-contained page in Spanish with a title and a viewport`, () => {
      const html = readStarter(name);
      assert.match(html, /^<!doctype html>/i);
      assert.match(html, /<html\b[^>]*\blang="es"/);
      assert.match(html, /<meta\s+name="viewport"\s+content="width=device-width, initial-scale=1"/);
      assert.match(html, /<title>[^<]{3,}<\/title>/);
    });

    test(`${name}: loads only pinned resources from the allowed hosts`, () => {
      const html = readStarter(name);
      assert.doesNotMatch(html, /@latest\b/);
      const bad = resourceUrls(html).map((u) => [u, urlProblem(u)]).filter(([, p]) => p);
      assert.deepEqual(bad, []);
      for (const link of tags(html, 'link')) {
        const href = link.match(/\bhref="([^"]*)"/)?.[1] ?? '';
        if (/^https?:/.test(href)) assert.match(href, /^https:\/\/fonts\.(googleapis|gstatic)\.com\//, `stylesheet host: ${href}`);
      }
    });

    test(`${name}: neutral Spanish copy (no voseo)`, () => {
      assert.deepEqual(voseo(visibleText(readStarter(name))), []);
    });
  }

  for (const name of TOKEN_STARTERS) {
    test(`${name}: tokens as custom properties on :root with a dark-mode block`, () => {
      const css = styleBlocks(readStarter(name)).join('\n');
      assert.match(css, /:root\s*\{[^}]*--surface-page:[^}]*--text-primary:[^}]*--accent:/);
      assert.match(css, /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{/);
      assert.match(css, /:root\[data-theme="dark"\]\s*\{/);
      assert.match(css, /body\s*\{[^}]*background(-color)?:\s*var\(--surface-page\)/);
    });
  }
});

describe('animation.html', () => {
  const html = () => readStarter('animation.html');

  test('runs on CSS transitions or WAAPI only: no external script', () => {
    assert.equal(tags(html(), 'script').filter((t) => /\bsrc=/.test(t)).length, 0);
    assert.match(html(), /\.animate\(/);
  });

  test('takes duration and easing from motion tokens', () => {
    assert.match(html(), /--motion-duration-(fast|base|slow):/);
    assert.match(html(), /--ease-(out|in-out|sheet):/);
    assert.match(html(), /--motion-duration-\$\{/);
    assert.match(html(), /--ease-\$\{/);
  });

  test('honours prefers-reduced-motion', () => {
    assert.match(html(), /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    assert.match(html(), /matchMedia\(\s*['"]\(prefers-reduced-motion: reduce\)['"]\s*\)/);
  });

  test('exposes window.ANIMATION with steps, play() and seek(t)', () => {
    assert.match(html(), /window\.ANIMATION\s*=\s*\{/);
    for (const key of ['steps', 'play', 'seek', 'duration']) assert.match(html(), new RegExp(`\\b${key}\\b`));
  });

  test('has play/pause, replay, a scrubber and 0.5x/1x/2x speeds', () => {
    assert.match(html(), /<input\b[^>]*type="range"/);
    for (const s of ['0.5', '1', '2']) assert.match(html(), new RegExp(`data-speed="${s.replace('.', '\\.')}"`));
    assert.match(html(), />\s*Repetir\s*</);
  });
});

describe('object-3d.html', () => {
  const html = () => readStarter('object-3d.html');
  const importMap = () => JSON.parse(html().match(/<script type="importmap">([\s\S]*?)<\/script>/)?.[1] ?? 'null');

  test('loads three.js as ES modules through an import map pinned to one exact version', () => {
    const map = importMap();
    assert.ok(map?.imports, 'import map with imports');
    const three = map.imports.three;
    const addons = map.imports['three/addons/'];
    assert.match(three, /^https:\/\/cdn\.jsdelivr\.net\/npm\/three@\d+\.\d+\.\d+\/build\/three\.module\.js$/);
    const version = three.match(/three@([\d.]+)\//)[1];
    assert.equal(addons, `https://cdn.jsdelivr.net/npm/three@${version}/examples/jsm/`);
  });

  test('uses OrbitControls and GLTFLoader from the same addons path', () => {
    assert.match(html(), /['"]three\/addons\/controls\/OrbitControls\.js['"]/);
    assert.match(html(), /['"]three\/addons\/loaders\/GLTFLoader\.js['"]/);
  });

  test('primitives by default, with an optional GLB_URL constant', () => {
    assert.match(html(), /const GLB_URL = ['"]['"];/);
  });

  test('handles resize, reduced motion and a missing WebGL', () => {
    assert.match(html(), /ResizeObserver|addEventListener\(\s*['"]resize['"]/);
    assert.match(html(), /prefers-reduced-motion: reduce/);
    assert.match(html(), /autoRotate/);
    assert.match(html(), /getContext\(\s*['"]webgl2?['"]/);
    assert.match(html(), /class="fallback"/);
  });
});

describe('html-email.html', () => {
  const html = () => readStarter('html-email.html');

  test('no script, no external CSS, no custom properties', () => {
    assert.deepEqual(tags(html(), 'script'), []);
    assert.equal(tags(html(), 'link').filter((t) => /stylesheet/i.test(t)).length, 0);
    assert.doesNotMatch(html(), /var\(--/);
  });

  test('the only <style> block holds media queries (dark mode and mobile)', () => {
    const blocks = styleBlocks(html());
    assert.equal(blocks.length, 1);
    assert.equal(cssOutsideMedia(blocks[0]), '');
    assert.match(blocks[0], /@media\s*\(prefers-color-scheme:\s*dark\)/);
    assert.match(blocks[0], /@media[^{]*max-width/);
  });

  test('declares light and dark colour schemes', () => {
    assert.match(html(), /<meta\s+name="color-scheme"\s+content="light dark"/);
    assert.match(html(), /<meta\s+name="supported-color-schemes"\s+content="light dark"/);
  });

  test('every table is a layout table with role="presentation"', () => {
    const tables = tags(html(), 'table');
    assert.ok(tables.length >= 3);
    for (const t of tables) assert.match(t, /role="presentation"/, t);
  });

  test('a 600 px container', () => {
    assert.ok(tags(html(), 'table').some((t) => /width="600"[^>]*max-width:\s*600px/.test(t)));
  });

  test('every <img> has an alt attribute', () => {
    const imgs = tags(html(), 'img');
    assert.ok(imgs.length >= 1);
    for (const img of imgs) assert.match(img, /\balt="[^"]*"/, img);
  });

  test('a hidden preheader and a bulletproof button', () => {
    assert.match(html(), /<div\b[^>]*style="display:\s*none;[^"]*max-height:\s*0;[^"]*overflow:\s*hidden/);
    assert.match(html(), /<v:roundrect\b/);
    assert.match(html(), /<a\b[^>]*style="[^"]*display:\s*inline-block/);
  });
});

describe('diagram.html', () => {
  const html = () => readStarter('diagram.html');

  test('loads Mermaid from jsDelivr at an exact version', () => {
    assert.match(html(), /https:\/\/cdn\.jsdelivr\.net\/npm\/mermaid@\d+\.\d+\.\d+\/dist\/mermaid\.esm\.min\.mjs/);
  });

  test('renders a flowchart from a <pre class="mermaid"> block', () => {
    assert.match(html(), /<pre class="mermaid"[^>]*>\s*flowchart\b/);
  });

  test('the theme follows the tokens', () => {
    assert.match(html(), /themeVariables/);
    assert.match(html(), /getComputedStyle\(/);
    assert.match(html(), /themeVariables:\s*\{[\s\S]*['"]--accent['"]/);
  });
});
