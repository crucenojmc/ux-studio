// Contract checks for the prototype-showcase SKILL.md and the checklists it points to.
// Run: cd tests/prototype-showcase && npm test
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SKILL } from './helpers.mjs';

const read = (rel) => readFileSync(join(SKILL, rel), 'utf8');
const skill = read('SKILL.md');
const stepStarting = (start) => skill.split('\n').find((l) => l.startsWith(start)) ?? '';

describe('prototype-showcase SKILL.md cost rules', () => {
  it('keeps one direction and explores alternatives only before, as quick variants', () => {
    assert.match(skill, /One direction\. Explore alternatives before, as quick variants, never inside the showcase\./);
  });

  it('the preview step checks the themes the product ships, not always both, once at the end', () => {
    const preview = stepStarting('5. Preview with `node');
    assert.ok(preview, 'has the preview step');
    assert.match(preview, /the themes the product ships \(not always both\)/);
    assert.match(preview, /Run the check once, at the end/);
    assert.doesNotMatch(preview, /both themes/);
  });

  it('the output contract asks for screenshots of the checked themes, not always dark and light', () => {
    const contract = skill.slice(skill.indexOf('## Output Contract'), skill.indexOf('## References'));
    assert.doesNotMatch(contract, /dark and light/);
    assert.match(contract, /1440 per theme checked, 390/);
  });

  it('publishing.md and the blueprint checklist do not demand both themes unconditionally', () => {
    assert.doesNotMatch(read('references/publishing.md'), /both themes/);
    const blueprint = read('references/blueprint.md');
    const checklist = blueprint.slice(blueprint.indexOf('## Checklist before delivery'), blueprint.indexOf('## Self-check snippet'));
    assert.doesNotMatch(checklist, /both themes|dark and light/);
    assert.match(checklist, /each theme the product ships/);
  });
});
