// The cross-cutting rule: whatever shows charts of statistical or mathematical data uses data-viz and its card.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { PLUGIN, read } from './helpers.mjs';

const SKILLS = path.join(PLUGIN, 'skills');
const words = (text) => text.split(/\s+/).filter(Boolean).length;
const section = (md, name) => {
  const at = md.search(new RegExp(`^## ${name}`, 'm'));
  if (at < 0) return '';
  const end = md.indexOf('\n## ', at + 1);
  return md.slice(at, end < 0 ? undefined : end);
};
const RULE = /gráficos de datos → `data-viz` con su ficha/i;

describe('ux-recipes and the agents point data charts to data-viz', () => {
  test('ux-recipes SKILL.md: one rule line for charts of data in any recipe', () => {
    const lines = read(SKILLS, 'ux-recipes/SKILL.md').split('\n').filter((l) => l.includes('`data-viz`'));
    assert.equal(lines.length, 1, lines.join('\n'));
    assert.match(lines[0], /«Ficha del gráfico»/);
  });

  for (const name of ['ux-designer', 'ux-analyst']) {
    test(`${name}: data-viz in its skills table, and still at most 700 words`, () => {
      const text = read(PLUGIN, 'agents', `${name}.md`);
      assert.match(section(text, 'Skills'), /^\| `data-viz` \| .+ \|$/m);
      assert.ok(words(text) <= 700, `${name}: ${words(text)} words`);
    });
  }
});

describe('recipes that can show data charts', () => {
  for (const id of ['deck', 'document', 'ux-audit', 'redesign', 'dev-handoff']) {
    test(`${id}: «gráficos de datos → data-viz con su ficha» in its Steps or Checks`, () => {
      const text = read(SKILLS, 'ux-recipes/recipes', `${id}.md`);
      assert.match(section(text, 'Steps') + section(text, 'Checks'), RULE);
    });
  }
});

describe('audit and fidelity references', () => {
  test('ux-flow-audit metrics: charts in the report follow data-viz', () => {
    assert.match(read(SKILLS, 'ux-flow-audit/references/metrics.md'), /`data-viz`.*«Ficha del gráfico»/);
  });

  test('implementation-fidelity method: a data chart is measured against its data-viz spec and card', () => {
    assert.match(read(SKILLS, 'implementation-fidelity/references/method.md'), /`data-viz`.*«Ficha del gráfico»/);
  });
});

describe('README', () => {
  const readme = read(PLUGIN, 'README.md');

  test('the skills table lists data-viz with its scripts and test command', () => {
    const row = section(readme, 'Skills').split('\n').find((l) => l.startsWith('| `data-viz` |')) ?? '';
    assert.ok(row.includes('chart-check.mjs'), row);
    assert.ok(row.includes('chart-card.html'), row);
    assert.ok(row.includes('cd tests/data-viz && npm test'), row);
  });

  test('both agents list data-viz in the agents table', () => {
    const rows = section(readme, 'Agentes').split('\n');
    for (const name of ['ux-designer', 'ux-analyst']) assert.match(rows.find((l) => l.startsWith(`| \`${name}\``)) ?? '', /`data-viz`/, name);
  });

  test('«Primeros pasos» gives an example of charts with source and math', () => {
    assert.match(section(readme, 'Primeros pasos'), /gráficos.*fuente.*cálculo/i);
  });

  test('«Reglas que vienen de la experiencia» states the chart rule', () => {
    assert.match(section(readme, 'Reglas que vienen de la experiencia'),
      /^- Todo gráfico de datos justifica su tipo y muestra fuente y matemática junto al gráfico\.$/m);
  });
});
