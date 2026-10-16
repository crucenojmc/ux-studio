// assets/chart-card.html: static rules, then a render in an existing Chromium (skipped without one).
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { HERE, PLUGIN, asset, outputDir, run } from './helpers.mjs';

const file = asset('chart-card.html');
const html = existsSync(file) ? readFileSync(file, 'utf8') : '';
const LABELS = ['Pregunta que responde', 'Por qué este gráfico', 'Alternativas descartadas y por qué', 'Fuente de los datos',
  'Matemática', 'Limitaciones y cómo leerlo'];

describe('chart-card.html (static)', () => {
  test('is self-contained: no external resource of any kind', () => {
    assert.ok(html.length > 0, 'the snippet exists');
    assert.doesNotMatch(html.replace(/<!--[\s\S]*?-->/g, ''), /\b(?:src|href)="https?:|url\(\s*["']?https?:|@import/i);
  });

  test('its colours, spacing and type come from design-system tokens, with fallbacks', () => {
    const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
    for (const token of ['--surface-raised', '--text-primary', '--text-secondary', '--border-subtle', '--space-', '--radius-', '--font-sans']) {
      assert.match(css, new RegExp(`var\\(${token}`), token);
    }
    const literal = css.replace(/var\([^;]*\)/g, '').match(/#[0-9a-f]{3,8}\b/gi) ?? [];
    assert.deepEqual(literal, [], 'colours only inside var() fallbacks');
  });

  test('the card is a <details open> titled «Ficha del gráfico», with the six fields', () => {
    assert.match(html, /<details class="dv-card" open>\s*<summary>Ficha del gráfico<\/summary>/);
    for (const label of LABELS) assert.ok(html.includes(label), label);
  });

  test('fills the card from the chart spec with textContent, never innerHTML', () => {
    assert.match(html, /<script type="application\/json" class="dv-spec">/);
    assert.match(html, /textContent/);
    assert.doesNotMatch(html, /innerHTML|insertAdjacentHTML|document\.write/);
  });

  test('labels demo data', () => {
    assert.match(html, /Datos de demostración/);
  });

  test('the spec it renders passes chart-check', () => {
    const json = html.replace(/<!--[\s\S]*?-->/g, '').match(/<script type="application\/json" class="dv-spec">([\s\S]*?)<\/script>/)?.[1];
    assert.ok(json, 'an embedded spec');
    const out = outputDir('card-spec');
    const spec = path.join(out, 'card-spec.json');
    writeFileSync(spec, json);
    const r = run(asset('chart-check.mjs'), [spec, '--out', out]);
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });
});

/* ------------------------------------------------------------------ render */

function playwright() {
  try {
    return createRequire(path.join(HERE, 'package.json'))('playwright-core');
  } catch {
    return null;
  }
}

describe('chart-card.html (render)', () => {
  let browser;
  let skip = false;

  before(async () => {
    const pw = playwright();
    const { findChrome } = await import(path.join(PLUGIN, 'skills/implementation-fidelity/assets/capture-states.mjs'));
    const executablePath = findChrome();
    if (!pw || !executablePath) {
      skip = true;
      return;
    }
    browser = await pw.chromium.launch({ executablePath, headless: true });
  });

  after(async () => browser?.close());

  async function open(viewport) {
    const context = await browser.newContext({ viewport });
    await context.route(/^https?:\/\//, (route) => route.abort());
    const page = await context.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(pathToFileURL(file).href);
    return { context, page, errors };
  }

  const box = (page, selector) => page.locator(selector).first().boundingBox();

  test('wide screen: the card sits beside the chart, filled from the spec, demo badge shown', async (t) => {
    if (skip) return t.skip('no Chromium-family browser or playwright-core');
    const { context, page, errors } = await open({ width: 1280, height: 900 });
    const chart = await box(page, '.dv-chart');
    const card = await box(page, '.dv-card');
    assert.ok(card.x >= chart.x + chart.width - 1, 'card to the right of the chart');
    const spec = JSON.parse(await page.locator('script.dv-spec').first().textContent());
    const text = await page.locator('.dv-card').first().innerText();
    for (const label of LABELS) assert.ok(text.includes(label), label);
    assert.ok(text.includes(spec.card.question));
    assert.ok(text.includes(spec.card.math.formula));
    assert.ok(text.includes(spec.card.source.cutoff));
    assert.equal(await page.locator('.dv-card .dv-demo').first().isVisible(), true);
    assert.equal(await page.locator('.dv-chart').first().getAttribute('aria-describedby'), await page.locator('.dv-card').first().getAttribute('id'));
    assert.deepEqual(errors, []);
    await context.close();
  });

  test('phone width: the card stacks right under the chart, no horizontal scroll', async (t) => {
    if (skip) return t.skip('no Chromium-family browser or playwright-core');
    const { context, page, errors } = await open({ width: 390, height: 844 });
    const chart = await box(page, '.dv-chart');
    const card = await box(page, '.dv-card');
    assert.ok(card.y >= chart.y + chart.height - 1, 'card below the chart');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(overflow, 0);
    assert.deepEqual(errors, []);
    await context.close();
  });
});
