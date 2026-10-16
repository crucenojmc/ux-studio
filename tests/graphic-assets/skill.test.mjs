// Structural checks for the graphic-assets skill package, its references and the piece template.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { HERE, SKILL, asset, hasPlaywright, outputDir, run } from './helpers.mjs';
import { findForbiddenTerms } from '../_shared/forbidden-terms.mjs';

const read = (rel) => readFileSync(path.join(SKILL, rel), 'utf8');
const text = read('SKILL.md');
const [, front, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];
const { findChrome } = await import(asset('export.mjs'));
const TEMPLATE = asset('piece-template.html');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('graphic-assets SKILL.md', () => {
  test('has the normative frontmatter', () => {
    assert.ok(front, 'frontmatter block');
    assert.match(front, /^name: graphic-assets$/m);
    assert.match(front, /^license: UNLICENSED$/m);
    assert.match(front, /^metadata:\n {2}author: "Mapplics"\n {2}version: "1\.0"$/m);
    const desc = front.match(/^description: "(.*)"$/m);
    assert.ok(desc, 'quoted one-line description');
    assert.ok(desc[1].startsWith('Trigger: '), 'description starts with Trigger:');
    assert.ok(desc[1].length <= 250, `description is ${desc[1].length} chars`);
  });

  test('has the required sections in order', () => {
    const sections = [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
    assert.deepEqual(sections, ['Activation Contract', 'Hard Rules', 'Decision Gates', 'Execution Steps', 'Output Contract', 'References']);
  });

  test('stays short: the references are loaded only for their deliverable', () => {
    const tokens = Math.round(body.split(/\s+/).filter(Boolean).length * 1.33);
    assert.ok(tokens >= 300 && tokens <= 1100, `~${tokens} tokens`);
    assert.match(body, /icon-guidelines\.md`? only for an icon/i);
    assert.match(body, /pieces\.md`? only for a piece/i);
  });

  test('every ${CLAUDE_SKILL_DIR} link resolves to a file', () => {
    const links = [...text.matchAll(/\$\{CLAUDE_SKILL_DIR\}\/([\w./-]+)/g)].map((m) => m[1].replace(/[.,)]+$/, ''));
    assert.ok(links.length >= 6);
    for (const rel of links) assert.ok(existsSync(path.join(SKILL, rel)), `missing ${rel}`);
  });

  test('works from the caller task envelope with an optional brief and a compact return', () => {
    assert.match(body, /task envelope/i);
    assert.match(body, /\$\{CLAUDE_PLUGIN_ROOT\}\/skills\/presentation-brief\/references\/task-envelope\.md/);
    assert.match(body, /BRIEF\.md` is optional/);
    assert.match(body, /closed-option questionnaire/);
    assert.match(body, /summary, the paths and the questions/i);
  });

  test('states the hard rules', () => {
    assert.match(body, /third-party trademarks or logos/);
    assert.match(body, /supplied and approved/);
    assert.match(body, /geometric or spot illustrations/);
    assert.match(body, /photo-realistic/);
    assert.match(body, /source spec/);
    assert.match(body, /tmp\/<topic>\/graphics\//);
    assert.match(body, /`ui-developer`/);
    assert.match(body, /distinct `--out`/);
    assert.match(body, /ui-ux-pro-max/);
    assert.match(body, /huashu-design/);
  });

  test('ships every deliverable', () => {
    for (const rel of [
      'references/icon-guidelines.md', 'references/pieces.md',
      'assets/icon-set.mjs', 'assets/export.mjs', 'assets/lib/cli.mjs',
      'assets/icons.spec.example.json', 'assets/piece-template.html',
    ]) assert.ok(existsSync(path.join(SKILL, rel)), rel);
  });

  test('never names real clients or brands', () => {
    for (const file of walk(SKILL)) {
      // "chrome-headless-shell" is a browser binary name, not a brand.
      assert.deepEqual(findForbiddenTerms(readFileSync(file, 'utf8')), [], file);
    }
  });
});

describe('graphic-assets references', () => {
  test('icon-guidelines covers grid, keylines, stroke, optical balance, naming and accessibility', () => {
    const doc = read('references/icon-guidelines.md');
    for (const re of [/live area/i, /keyline/i, /stroke/i, /optical/i, /naming/i, /decorative/i, /meaningful/i, /aria-hidden="true"/, /<title>/, /3:1/]) assert.match(doc, re);
  });

  test('pieces covers the medium, layout grids per format, safe areas, type scale and contrast', () => {
    const doc = read('references/pieces.md');
    for (const re of [/Design artifact/, /tmp\/<topic>\//, /export\.mjs/, /1080×1080/, /1080×1350/, /1200×630/, /1920×1080/, /safe area/i, /type scale/i, /4\.5:1/, /3:1/, /piece-template\.html/])
      assert.match(doc, re);
  });
});

describe('piece-template.html', { skip: !hasPlaywright() || !findChrome() ? 'needs playwright-core and a Chromium-family browser' : false }, () => {
  const FORMATS = [
    ['social-square', 1080, 1080],
    ['social-portrait', 1080, 1350],
    ['social-link', 1200, 630],
    ['social-landscape', 1920, 1080],
  ];

  test('keeps every element inside the safe area in each social format, without overflow', async () => {
    const { chromium } = createRequire(path.join(HERE, 'package.json'))('playwright-core');
    const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
    try {
      for (const [name, width, height] of FORMATS) {
        const page = await browser.newPage({ viewport: { width, height } });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(pathToFileURL(TEMPLATE).href, { waitUntil: 'load' });
        const report = await page.evaluate(() => {
          const margin = parseFloat(getComputedStyle(document.querySelector('.artboard')).paddingLeft);
          const W = innerWidth;
          const H = innerHeight;
          const out = [...document.querySelectorAll('.artboard [data-safe] *, .artboard [data-safe]')]
            .map((el) => ({ el: el.className?.baseVal ?? el.className ?? el.tagName, r: el.getBoundingClientRect() }))
            .filter(({ r }) => r.width && r.height)
            .filter(({ r }) => r.left < margin - 0.5 || r.top < margin - 0.5 || r.right > W - margin + 0.5 || r.bottom > H - margin + 0.5)
            .map(({ el, r }) => `${el} ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
          return { margin, out, scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight] };
        });
        assert.ok(report.margin >= Math.min(width, height) * 0.05, `${name}: safe margin ${report.margin}px`);
        assert.deepEqual(report.out, [], `${name}: elements outside the safe area`);
        assert.deepEqual(report.scroll, [width, height], `${name}: no overflow`);
        assert.deepEqual(errors, [], `${name}: page errors`);
        await page.close();
      }
    } finally {
      await browser.close();
    }
  });

  test('exports at every social size with export.mjs', async () => {
    const out = outputDir('template-export');
    const res = await run(asset('export.mjs'), ['--input', TEMPLATE, '--out', out, '--preset', 'social']);
    assert.equal(res.status, 0, res.stderr);
    for (const [name, w, h] of FORMATS) assert.ok(existsSync(path.join(out, `piece-template-${name}-${w}x${h}@1x.png`)), name);
  });
});
