// Structural checks for the ux-flow-audit skill package (frontmatter, sections, links, size).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { SKILL } from './helpers.mjs';
import { findForbiddenTerms } from '../_shared/forbidden-terms.mjs';

const text = readFileSync(path.join(SKILL, 'SKILL.md'), 'utf8');
const [, front, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('ux-flow-audit SKILL.md', () => {
  test('has the normative frontmatter', () => {
    assert.ok(front, 'frontmatter block');
    assert.match(front, /^name: ux-flow-audit$/m);
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

  test('body stays within the token budget (approx. words x 1.33)', () => {
    const tokens = Math.round(body.split(/\s+/).filter(Boolean).length * 1.33);
    assert.ok(tokens >= 180 && tokens <= 1000, `~${tokens} tokens`);
  });

  test('every ${CLAUDE_SKILL_DIR} link resolves to a file', () => {
    const links = [...text.matchAll(/\$\{CLAUDE_SKILL_DIR\}\/([\w./-]+)/g)].map((m) => m[1].replace(/[.,)]+$/, ''));
    assert.ok(links.length >= 8);
    for (const rel of links) assert.ok(existsSync(path.join(SKILL, rel)), `missing ${rel}`);
  });

  test('ships every deliverable', () => {
    for (const rel of [
      'references/method.md', 'references/questionnaire.md', 'references/metrics.md',
      'assets/task-inventory-template.md', 'assets/report-template.md',
      'assets/questionnaire.schema.json', 'assets/questionnaire.example.json',
      'assets/flow-cost.mjs', 'assets/nav-graph.mjs', 'assets/space-audit.mjs',
    ]) assert.ok(existsSync(path.join(SKILL, rel)), rel);
  });

  test('never names real clients or brands', () => {
    for (const file of walk(SKILL)) {
      const content = readFileSync(file, 'utf8');
      // "chrome-headless-shell" is a browser binary name, not a brand.
      assert.deepEqual(findForbiddenTerms(content), [], file);
    }
  });
});

describe('ux-flow-audit accessibility variant', () => {
  const ref = path.join(SKILL, 'references/accessibility.md');

  test('SKILL.md names the variant, the script, the reference and the task envelope', () => {
    assert.match(body, /Accesibilidad/);
    assert.match(body, /a11y-audit\.mjs/);
    assert.match(body, /\$\{CLAUDE_SKILL_DIR\}\/references\/accessibility\.md/);
    assert.match(body, /presentation-brief\/references\/task-envelope\.md/);
    assert.match(body, /--out/);
    assert.match(body, /verificación automática parcial/);
  });

  test('the variant text in SKILL.md stays short and keeps the detail in the reference', () => {
    assert.ok(existsSync(ref), 'references/accessibility.md');
    const added = body.split(/\r?\n/).filter((l) => /ccesibilidad|a11y|accessibility/.test(l)).join(' ');
    assert.ok(added.split(/\s+/).length <= 260, 'variant lines are short');
  });

  test('the reference covers criteria, human review, questionnaire feed and the compact return', () => {
    const t = readFileSync(ref, 'utf8');
    for (const re of [/1\.4\.3/, /1\.4\.11/, /2\.1\.1/, /2\.1\.2/, /2\.4\.7/, /2\.5\.8/, /4\.1\.2/, /3\.1\.1/, /lector de pantalla|screen[- ]reader/i, /carga cognitiva|cognitive/i, /subt[ií]tulos|caption/i, /questionnaire/i, /nunca[\s\S]*conformidad|never[\s\S]*conformance/i, /--out/]) {
      assert.match(t, re, String(re));
    }
  });
});
