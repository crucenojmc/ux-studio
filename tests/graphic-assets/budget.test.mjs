// graphic-assets follows the Budget contract: the visual check of exported PNGs runs on downscaled images.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SKILL } from './helpers.mjs';

const flat = (rel) => readFileSync(path.join(SKILL, rel), 'utf8').replace(/\s+/g, ' ');
const DOWNSCALED = /downscaled to at most 1000 px wide \(Budget #2\)/;
const CROP = /a 1:1 crop only where a check flags a defect/;

describe('graphic-assets looks at PNGs downscaled', () => {
  test('SKILL.md export step', () => {
    const text = flat('SKILL.md');
    assert.match(text, /Look at every PNG before returning it, downscaled to at most 1000 px wide \(Budget #2\); a 1:1 crop only where a check flags a defect/);
    assert.doesNotMatch(text, /Look at every PNG before returning it\.(?! )|at full size/);
  });

  test('pieces.md step 4 checks the shown size and a downscaled view, never full size', () => {
    const text = flat('references/pieces.md');
    assert.match(text, /4\. Look at every PNG downscaled to at most 1000 px wide \(Budget #2\) and at the size it will be shown/);
    assert.match(text, CROP);
    assert.doesNotMatch(text, /at full size/);
    assert.match(text, DOWNSCALED);
  });
});
