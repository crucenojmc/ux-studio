// The data-story recipe («Datos explicados») and where it is listed: index, routing, README.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PLUGIN, read } from './helpers.mjs';

const RECIPES = path.join(PLUGIN, 'skills/ux-recipes/recipes');
const file = path.join(RECIPES, 'data-story.md');
const text = existsSync(file) ? read(file) : '';
const [, front = '', body = ''] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];
const section = (md, name) => {
  const at = md.search(new RegExp(`^## ${name}$`, 'm'));
  if (at < 0) return '';
  const end = md.indexOf('\n## ', at + 1);
  return md.slice(at, end < 0 ? undefined : end);
};
const row = (md, id) => md.split('\n').find((l) => l.startsWith(`| \`${id}\` |`)) ?? '';

describe('recipe data-story', () => {
  test('frontmatter: own recipe, dashboard with HTML fallback, run by ux-designer with data-viz', () => {
    assert.ok(text, 'recipes/data-story.md exists');
    assert.equal(front, ['id: data-story', 'title: Datos explicados', 'source: own', 'medium: dashboard', 'fallback: html',
      'agent: ux-designer', 'skills: [data-viz]'].join('\n'));
  });

  test('When: charts that explain a phenomenon with data; decorative graphics go elsewhere', () => {
    const when = section(body, 'When');
    assert.match(when, /statistical or mathematical data/);
    assert.match(when, /`print-piece`/);
    assert.match(when, /`graphic-assets`/);
  });

  test('Expect: grounded charts with their card, no unsupplied analysis, checkable without blind trust', () => {
    const [got, notIncluded, ideal] = section(body, 'Expect').split('\n').filter((l) => l.startsWith('- '));
    assert.match(got, /^- Obtienes: .*fundamento.*ficha.*fuente.*matemática/);
    assert.match(notIncluded, /^- No incluye: .*no se entregaron.*verificar/);
    assert.match(ideal, /^- Ideal si: .*confiar a ciegas/);
  });

  test('Questions: the decision the data supports and the level of detail of the math', () => {
    const qs = section(body, 'Questions');
    assert.match(qs, /¿[^?]*decisión[^?]*\?/);
    assert.match(qs, /¿[^?]*matemática[^?]*\?/);
  });

  test('Steps: question → data profile → chart-selection → spec → chart-check → build → card next to each chart', () => {
    const steps = section(body, 'Steps');
    const order = [/question/i, /[Pp]rofile/, /chart-selection\.md/, /chart-spec\.schema\.json/, /chart-check\.mjs/, /[Bb]uild/, /chart-card\.html/];
    let from = 0;
    for (const re of order) {
      const at = steps.slice(from).search(re);
      assert.ok(at >= 0, `${re} after position ${from}`);
      from += at + 1;
    }
    assert.match(steps, /next to each chart/i);
  });

  test('Checks run chart-check and require the card next to each chart', () => {
    const checks = section(body, 'Checks');
    assert.match(checks, /chart-check\.mjs .*exits 0/);
    assert.match(checks, /«Ficha del gráfico»/);
  });
});

describe('data-story is listed', () => {
  test('in recipes/index.md with the same columns', () => {
    const r = row(read(RECIPES, 'index.md'), 'data-story');
    assert.match(r, /^\| `data-story` \| Datos explicados \| .+ \| .+ \| `dashboard` → `html` \| `ux-designer` \|$/);
  });

  test('in routing.md for auditoria, presentacion, diseno-ux and investigacion', () => {
    const routing = read(PLUGIN, 'skills/presentation-brief/references/routing.md');
    const recipes = routing.slice(routing.search(/^## Recipes/m));
    for (const type of ['auditoria', 'presentacion', 'diseno-ux', 'investigacion']) assert.match(row(recipes, type), /`data-story`/, type);
  });

  test('in the README «Recetas» table', () => {
    const readme = read(PLUGIN, 'README.md');
    assert.match(row(readme, 'data-story'), /\| Datos explicados \|/);
  });
});
