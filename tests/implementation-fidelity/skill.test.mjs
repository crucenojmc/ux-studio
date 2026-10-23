// Contract checks for the implementation-fidelity SKILL.md and the references that back its cost rules.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, '../../plugins/ux-studio/skills/implementation-fidelity');
const read = (rel) => fs.readFileSync(path.join(SKILL, rel), 'utf8');
const skill = read('SKILL.md');
const lineStarting = (text, start) => text.split('\n').find((l) => l.startsWith(start)) ?? '';

describe('implementation-fidelity SKILL.md measures with the scripts and re-measures only what failed', () => {
  test('measure with the skill scripts, never by browsing and screenshotting by hand', () => {
    const rule = lineStarting(skill, '- Measure with the skill');
    assert.match(rule, /Measure with the skill's scripts \(`capture-states\.mjs`, `compare\.mjs`\), never by browsing and screenshotting by hand\./);
    assert.match(rule, /`--print-snippet`/, 'the manual path stays the one browser use');
  });

  test('tool-selection.md is read only when the default scripts do not cover the stack', () => {
    assert.match(skill, /Read `references\/tool-selection\.md` only when they do not cover the stack/);
    assert.doesNotMatch(skill, /Choose capture path and tools with/);
  });

  test('capture only the themes the product ships', () => {
    assert.match(lineStarting(skill, '3. '), /^3\. Capture only the themes the product ships:/);
    assert.match(lineStarting(skill, '1. '), /only the themes the product ships/);
    assert.doesNotMatch(lineStarting(skill, '1. '), /every theme/);
  });

  test('side-by-side images are reviewed only for the states flagged under the threshold, downscaled', () => {
    const review = lineStarting(skill, '5. ');
    assert.match(review, /only for the states `compare\.mjs` flagged under the threshold/);
    assert.match(review, /downscaled to at most 1000 px wide/);
    assert.doesNotMatch(review, /Review each side-by-side image/);
  });

  test('fix rounds re-measure the failing states with --only; one final numeric pass over all states', () => {
    const rounds = lineStarting(skill, '7. ');
    assert.match(rounds, /re-measure only the failing states/i);
    assert.match(rounds, /`capture-states\.mjs --only <stateId>`/);
    assert.match(rounds, /`compare\.mjs --only <stateId> --previous <old>\/fidelity\.json`/);
    assert.match(rounds, /comma list or a repeated `--only`/);
    assert.match(rounds, /one final measurement of all states \(no `--only`/);
    assert.match(rounds, /numerically/);
    assert.match(rounds, /review images only where it flags/);
    assert.match(rounds, /Only that run lets you call the implementation faithful/);
  });

  test('the faithful guard asks for a final re-measurement of all states after the last fix', () => {
    assert.match(skill, /Never call it faithful without a final re-measurement of all states after the last fix\./);
  });
});

describe('the references follow the same rules', () => {
  const method = read('references/method.md').replace(/\s+/g, ' ');

  test('method.md: only the themes the product ships', () => {
    assert.match(method, /\| Themes \| Only the themes the product ships/);
  });

  test('method.md: triage looks only at the flagged states, downscaled', () => {
    assert.match(method, /look only at the side-by-side images of the states the comparison flagged under the threshold/);
    assert.match(method, /downscaled to at most 1000 px wide/);
    assert.doesNotMatch(method, /look at every side-by-side image/);
  });

  test('method.md: the cycle re-measures failing states with --only and ends with one full numeric pass', () => {
    assert.match(method, /capture-states\.mjs --only <stateId>/);
    assert.match(method, /compare\.mjs --only <stateId> --previous/);
    assert.match(method, /Final confirmation: one measurement of all states \(no `--only`/);
    assert.match(method, /without the final all-states re-measurement taken after the last fix/);
  });

  test('decisions.md: fidelity is reached by the final all-states re-measurement', () => {
    assert.match(read('references/decisions.md'), /Fidelity is reached when the final all-states re-measurement/);
  });
});

describe('the manual browser path is the documented snippet and nothing else', () => {
  const method = read('references/method.md').replace(/\s+/g, ' ');
  const manual = method.slice(method.indexOf('3. **Manual, user\'s own browser**'), method.indexOf('Then `node compare.mjs'));

  test('SKILL.md: the only browser step is the --print-snippet expression; resize and screenshots come from the scripts', () => {
    const rule = lineStarting(skill, '- Measure with the skill');
    assert.match(rule, /the only browser step is running the `--print-snippet` expression/);
    assert.match(rule, /any resize or screenshot comes from the scripts, never from a manual browser call/);
  });

  test('method.md section 5.3 runs the snippet and saves its JSON, with no resize or screenshot call', () => {
    assert.ok(manual.length > 200, 'found the manual path');
    assert.match(manual, /The only browser step is the `--print-snippet <stateId>` expression/);
    assert.match(manual, /`javascript_tool`/);
    assert.match(manual, /`evaluate_script`/);
    assert.doesNotMatch(method, /resize_window|resize_page|take_screenshot/);
  });

  test('method.md: the window size is recorded by the snippet and compared, not set by hand', () => {
    assert.match(manual, /the user puts their tab in that state, viewport and theme/);
    assert.match(manual, /records the window size and pixel ratio/);
    assert.match(manual, /compares styles only and says so/);
  });
});
