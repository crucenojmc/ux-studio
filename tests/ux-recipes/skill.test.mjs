// Structural checks for the ux-recipes SKILL.md: frontmatter, size, how a recipe is picked, run and fit-checked.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { SKILL, read } from './helpers.mjs';

const text = read(SKILL, 'SKILL.md');
const [, front, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];

describe('ux-recipes SKILL.md', () => {
  test('has the normative frontmatter', () => {
    assert.ok(front, 'frontmatter block');
    assert.match(front, /^name: ux-recipes$/m);
    assert.match(front, /^license: UNLICENSED$/m);
    assert.match(front, /^metadata:\n {2}author: "Mapplics"\n {2}version: "1\.0"$/m);
    const desc = front.match(/^description: "(.*)"$/m);
    assert.ok(desc, 'quoted one-line description');
    assert.ok(desc[1].startsWith('Trigger: '), 'description starts with Trigger:');
  });

  test('stays at most 70 lines', () => {
    const lines = text.trimEnd().split('\n').length;
    assert.ok(lines <= 70, `${lines} lines`);
  });

  test('picks the recipe from the envelope, otherwise from the index by signals', () => {
    assert.match(body, /`recipe`/);
    assert.match(body, /\$\{CLAUDE_SKILL_DIR\}\/recipes\/index\.md/);
    assert.match(body, /signals/i);
  });

  test('loads only the chosen recipe file, and each skill only at its step', () => {
    assert.match(body, /only the chosen recipe/i);
    assert.match(body, /\$\{CLAUDE_SKILL_DIR\}\/recipes\/<id>\.md/);
    assert.match(body, /only at (its|that) step/i);
  });

  test('checks the Artifact types at run time and falls back', () => {
    assert.match(body, /action: "list", scope: "types"/);
    assert.match(body, /fallback/i);
  });

  test('fit check: compares intent with When and Expect, proposes the better recipe, never refuses', () => {
    const fit = body.slice(body.search(/^## Fit Check/m));
    assert.ok(body.search(/^## Fit Check/m) >= 0, 'has a "Fit Check" section');
    for (const re of [/When/, /Expect/, /«Receta»/, /\(Recomendado\)/, /«Seguir con </, /Obtienes/, /missing/i,
      /run nothing/i, /`answers`/, /user's decision/i, /never (ask|re-ask) again/i, /never refuse/i]) {
      assert.match(fit, re);
    }
  });

  test('chained recipes: each step owned by another agent is a separate invocation', () => {
    assert.match(body, /separate invocation/i);
  });

  test('every ${CLAUDE_SKILL_DIR} link resolves to a file', () => {
    const links = [...text.matchAll(/\$\{CLAUDE_SKILL_DIR\}\/([\w./<>-]+)/g)].map((m) => m[1].replace(/[.,)]+$/, ''));
    assert.ok(links.length >= 2);
    for (const rel of links.filter((l) => !l.includes('<'))) assert.ok(existsSync(path.join(SKILL, rel)), `missing ${rel}`);
  });
});
