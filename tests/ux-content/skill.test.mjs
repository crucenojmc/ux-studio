// Structural checks for the ux-content skill package.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { REPO, SKILL, asset } from './helpers.mjs';
import { findForbiddenTerms } from '../_shared/forbidden-terms.mjs';

const NAME = 'ux-content';
const text = readFileSync(path.join(SKILL, 'SKILL.md'), 'utf8');
const [, front, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = path.join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

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
    assert.ok(links.length >= 6);
    for (const rel of links) assert.ok(existsSync(path.join(SKILL, rel)), `missing ${rel}`);
  });

  test('says references and templates load only on demand', () => {
    assert.match(text, /only when|solo cuando|on demand/i);
  });

  test('ships every deliverable', () => {
    for (const rel of ['references/voice-and-tone.md', 'references/patterns.md', 'references/glossary.md',
      'assets/content-spec-template.md', 'assets/states-inventory.mjs', 'assets/questionnaire.example.json']) {
      assert.ok(existsSync(path.join(SKILL, rel)), rel);
    }
  });

  test('templates are in neutral Spanish, without voseo', () => {
    const tpl = readFileSync(asset('content-spec-template.md'), 'utf8');
    assert.doesNotMatch(tpl, /\b(vos|tenés|podés|querés|hacé|elegí|probá|ingresá)\b/i);
    for (const col of ['Clave', 'Pantalla', 'Estado', 'Texto', 'Variantes', 'Límite', 'Notas']) assert.match(tpl, new RegExp(col));
  });

  test('never names real clients or brands', () => {
    for (const file of walk(SKILL)) assert.deepEqual(findForbiddenTerms(readFileSync(file, 'utf8')), [], file);
  });

  test('the questionnaire example is valid against the shared schema', () => {
    const schema = JSON.parse(readFileSync(path.join(REPO, 'plugins/ux-studio/skills/ux-flow-audit/assets/questionnaire.schema.json'), 'utf8'));
    const ajv = new Ajv2020({ allErrors: true, strict: true, strictTuples: false });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    const example = JSON.parse(readFileSync(asset('questionnaire.example.json'), 'utf8'));
    assert.equal(validate(example), true, ajv.errorsText(validate.errors, { separator: '\n' }));
  });
});
