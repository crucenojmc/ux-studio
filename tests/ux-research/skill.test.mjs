// Structural checks for the ux-research skill package.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { SKILL, asset } from './helpers.mjs';
import { findForbiddenTerms } from '../_shared/forbidden-terms.mjs';

const NAME = 'ux-research';
const text = readFileSync(path.join(SKILL, 'SKILL.md'), 'utf8');
const [, front, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = path.join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const TEMPLATES = ['research-plan', 'interview-guide', 'usability-test', 'persona', 'journey'].map((n) => `${n}-template.md`);

describe(`${NAME} SKILL.md`, () => {
  test('has the normative frontmatter', () => {
    assert.match(front, new RegExp(`^name: ${NAME}$`, 'm'));
    assert.match(front, /^license: UNLICENSED$/m);
    assert.match(front, /^metadata:\n {2}author: "Mapplics"\n {2}version: "1\.0"$/m);
    const desc = front.match(/^description: "(.*)"$/m);
    assert.ok(desc && desc[1].startsWith('Trigger: ') && desc[1].length <= 250);
  });

  test('has the required sections in order', () => {
    assert.deepEqual([...body.matchAll(/^## (.+)$/gm)].map((m) => m[1]),
      ['Activation Contract', 'Hard Rules', 'Decision Gates', 'Execution Steps', 'Output Contract', 'References']);
  });

  test('stays short (lazy loading): at most 90 lines in total', () => {
    assert.ok(text.split('\n').length <= 90, `${text.split('\n').length} lines`);
  });

  test('works from the caller task envelope and names the shared reference by path', () => {
    assert.match(text, /presentation-brief\/references\/task-envelope\.md/);
    assert.match(text, /BRIEF\.md.*optional|optional.*BRIEF\.md/i);
    assert.match(text, /--out/);
  });

  test('every ${CLAUDE_SKILL_DIR} link resolves to a file', () => {
    const links = [...text.matchAll(/\$\{CLAUDE_SKILL_DIR\}\/([\w./-]+)/g)].map((m) => m[1].replace(/[.,)]+$/, ''));
    assert.ok(links.length >= 7);
    for (const rel of links) assert.ok(existsSync(path.join(SKILL, rel)), `missing ${rel}`);
  });

  test('every template is loaded only on demand, never inlined', () => {
    assert.match(text, /only when|solo cuando|on demand/i);
    for (const t of TEMPLATES) assert.ok(text.includes(t), `${t} is referenced`);
    assert.doesNotMatch(text, /Guía de entrevista|Guion de la sesión/);
  });

  test('ships every deliverable', () => {
    for (const rel of ['references/methods.md', 'assets/sitemap.mjs', ...TEMPLATES.map((t) => `assets/${t}`)]) {
      assert.ok(existsSync(path.join(SKILL, rel)), rel);
    }
  });

  test('describes wireframes as a Design artifact with an HTML fallback in tmp', () => {
    assert.match(text, /Design artifact/);
    assert.match(text, /grey boxes|grey-box/i);
    assert.match(text, /tmp\//);
  });

  test('templates are in neutral Spanish, without voseo', () => {
    for (const t of TEMPLATES) {
      assert.doesNotMatch(readFileSync(asset(t), 'utf8'), /\b(vos|tenés|podés|querés|hacé|elegí|contanos|decinos|probá)\b/i, t);
    }
  });

  test('the persona template splits Supuestos from Evidencia and labels itself «supuesto»', () => {
    const p = readFileSync(asset('persona-template.md'), 'utf8');
    assert.match(p, /## Supuestos/);
    assert.match(p, /## Evidencia/);
    assert.match(p, /supuesto/);
  });

  test('methods.md states sample sizes as conventions', () => {
    const m = readFileSync(path.join(SKILL, 'references/methods.md'), 'utf8');
    assert.match(m, /convention/i);
    for (const method of ['interview', 'survey', 'usability', 'card sort', 'tree test']) assert.match(m, new RegExp(method, 'i'));
  });

  test('never names real clients or brands', () => {
    for (const file of walk(SKILL)) assert.deepEqual(findForbiddenTerms(readFileSync(file, 'utf8')), [], file);
  });
});
