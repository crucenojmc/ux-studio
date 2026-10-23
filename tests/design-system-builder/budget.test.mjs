// path-from-scratch follows the Budget contract: one direction by default, themes checked once at the end.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const doc = readFileSync(path.join(HERE, '../../plugins/ux-studio/skills/design-system-builder/references/path-from-scratch.md'), 'utf8');
const flat = doc.replace(/\s+/g, ' ');

describe('path-from-scratch.md', () => {
  test('step 2 builds one direction by default; 2–3 boards only when the brief asks to choose among options', () => {
    assert.match(doc, /^## 2\. Direction: one by default$/m);
    assert.doesNotMatch(doc, /Directions \(2–3\), then the user picks ONE/);
    assert.match(flat, /with a single column/);
    assert.match(flat, /Write 2–3 columns, and let the user pick ONE, only when the brief asks to choose among options/);
    assert.match(flat, /One direction: give the path and its two-line summary, and go on to build it/);
    assert.match(flat, /Several: give the path, summarize each direction in two lines, and ask which one to build/);
  });

  test('the local preview is rendered in the declared themes, checked once at the end', () => {
    assert.match(flat, /render each preview in the themes the brief or product declares, checked once at the end/);
    assert.doesNotMatch(flat, /render each preview in both themes/);
  });
});
