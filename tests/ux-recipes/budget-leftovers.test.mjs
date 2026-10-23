// Recipes follow the Budget contract: check only the themes the brief or product declares, once at the end,
// and look at exported images downscaled.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, read } from './helpers.mjs';

const recipe = (id) => read(SKILLS, 'ux-recipes/recipes', `${id}.md`);
const line = (text, start) => text.split('\n').find((l) => l.startsWith(start)) ?? '';
const THEMES = /in the themes the brief or product declares, checked once at the end/;

describe('recipe checks run once, in the declared themes only', () => {
  test('app-prototype', () => {
    const check = line(recipe('app-prototype'), '- `node ${CLAUDE_PLUGIN_ROOT}/skills/prototype-showcase/assets/preview.mjs');
    assert.match(check, THEMES);
    assert.doesNotMatch(check, /light and dark/);
  });

  test('ux-system', () => {
    const check = line(recipe('ux-system'), '- `node ${CLAUDE_PLUGIN_ROOT}/skills/prototype-showcase/assets/preview.mjs');
    assert.match(check, THEMES);
    assert.doesNotMatch(check, /light and dark/);
  });

  test('data-story', () => {
    const check = line(recipe('data-story'), '- HTML:');
    assert.match(check, THEMES);
    assert.match(check, /zero console errors and no horizontal scroll at 390 px/);
    assert.doesNotMatch(check, /light and dark/);
  });
});

describe('print-piece looks at PNGs downscaled', () => {
  test('step 3 keeps the visual check on images downscaled per Budget #2', () => {
    const step = line(recipe('print-piece'), '3. `graphic-assets`');
    assert.match(step, /look at every PNG before returning it, downscaled to at most 1000 px wide \(Budget #2\)/);
    assert.match(step, /a 1:1 crop only where a check flags a defect/);
  });
});
