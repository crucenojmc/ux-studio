// Structural checks for the implement-ui skill package (frontmatter, sections, links, deliverables).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findForbiddenTerms } from '../_shared/forbidden-terms.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL = path.resolve(HERE, '../../plugins/ux-studio/skills/implement-ui');
const read = (rel) => readFileSync(path.join(SKILL, rel), 'utf8');

const text = read('SKILL.md');
const [, front, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Headings of a Markdown file, in order. */
const headings = (md) => [...md.matchAll(/^#{2,3} (.+)$/gm)].map((m) => m[1]);

describe('implement-ui SKILL.md', () => {
  test('has the normative frontmatter', () => {
    assert.ok(front, 'frontmatter block');
    assert.match(front, /^name: implement-ui$/m);
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
    assert.ok(links.length >= 6, `${links.length} links`);
    for (const rel of links) assert.ok(existsSync(path.join(SKILL, rel)), `missing ${rel}`);
  });

  test('ships every deliverable', () => {
    for (const rel of [
      'references/workflow.md', 'references/token-mapping.md', 'references/checklist.md',
      'assets/stack-detect.mjs', 'assets/plan-template.md', 'assets/implementation-note-template.md',
    ]) assert.ok(existsSync(path.join(SKILL, rel)), rel);
  });

  test('works from a task envelope and stops for consent', () => {
    assert.match(body, /presentation-brief\/references\/task-envelope\.md/);
    assert.match(body, /consent: granted/);
    assert.match(body, /BRIEF\.md/);
    assert.match(body, /optional/i);
  });

  test('hands off to implementation-fidelity and asks through the questionnaire schema', () => {
    assert.match(body, /implementation-fidelity/);
    assert.match(body, /ux-flow-audit\/assets\/questionnaire\.schema\.json/);
    assert.match(body, /never (call|claim)[^.]*faithful/i);
  });

  test('never names real clients or brands', () => {
    for (const file of walk(SKILL)) {
      assert.deepEqual(findForbiddenTerms(readFileSync(file, 'utf8')), [], file);
    }
  });
});

describe('implement-ui references', () => {
  test('workflow.md runs plan → consent → implement → test → handoff in that order', () => {
    const order = headings(read('references/workflow.md')).map((h) => h.toLowerCase());
    const steps = ['plan', 'consent', 'implement', 'test', 'handoff'];
    const at = steps.map((s) => order.findIndex((h) => h.includes(s)));
    for (const [i, s] of steps.entries()) assert.ok(at[i] >= 0, `missing step ${s}`);
    assert.deepEqual([...at].sort((a, b) => a - b), at, `order ${order.join(' | ')}`);
  });

  test('token-mapping.md maps tokens.css to Tailwind, SCSS and CSS custom properties', () => {
    const md = read('references/token-mapping.md');
    for (const re of [/tokens\.css/, /tailwind/i, /@theme/, /scss/i, /var\(--/, /never hardcode/i]) assert.match(md, re);
  });

  test('checklist.md covers responsive, accessibility, states and reduced motion', () => {
    const md = read('references/checklist.md');
    for (const re of [/responsive/i, /accessib/i, /loading/i, /empty/i, /error/i, /prefers-reduced-motion/]) {
      assert.match(md, re);
    }
  });
});

describe('implement-ui templates for the team', () => {
  for (const rel of ['assets/plan-template.md', 'assets/implementation-note-template.md']) {
    test(`${rel} is in neutral Spanish`, () => {
      const md = read(rel);
      assert.match(md, /^# /m);
      assert.match(md, /\b(Archivos|Rama|Verificación)\b/);
      // Neutral register: no voseo forms.
      assert.doesNotMatch(md, /\b(vos|tenés|podés|querés|hacé|revisá|confirmá|usá|elegí)\b/i);
    });
  }

  test('the plan template asks the caller for consent on the exact files and branch', () => {
    const md = read('assets/plan-template.md');
    assert.match(md, /consent: granted/);
    assert.match(md, /Rama/);
    assert.match(md, /Archivos/);
  });

  test('the implementation note carries the fidelity handoff request', () => {
    const md = read('assets/implementation-note-template.md');
    assert.match(md, /fidelidad/i);
    assert.match(md, /implementation-fidelity/);
  });
});
