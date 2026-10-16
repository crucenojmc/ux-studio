// Structural checks for every recipe file and the recipe index.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  AGENTS, EXPECT_LABELS, FALLBACKS, INDEX_COLUMNS, KEYS, MEDIA, OWN, RECIPES, SECTIONS, SOURCES,
  headings, indexTable, parseRecipe, recipeFiles, section, skillExists,
} from './helpers.mjs';

const files = recipeFiles();
const recipes = files.map((f) => ({ file: f, ...parseRecipe(f) }));

describe('recipe files', () => {
  test('the six own recipes exist', () => {
    for (const id of OWN) assert.ok(existsSync(path.join(RECIPES, `${id}.md`)), id);
  });

  test('ids are unique and equal to the file names; titles are unique', () => {
    for (const r of recipes) assert.equal(r.front.id, r.file.replace(/\.md$/, ''), r.file);
    const ids = recipes.map((r) => r.front.id);
    assert.equal(new Set(ids).size, ids.length, ids.join(' '));
    const titles = recipes.map((r) => r.front.title);
    assert.equal(new Set(titles).size, titles.length, titles.join(' · '));
  });

  for (const r of recipes) {
    describe(r.file, () => {
      test('frontmatter has exactly the format keys, in order', () => {
        assert.deepEqual(r.keys, KEYS);
        assert.ok(r.front.title, 'title');
      });

      test('source, medium, fallback and agent take valid values', () => {
        assert.ok(SOURCES.includes(r.front.source), `source ${r.front.source}`);
        assert.ok(MEDIA.includes(r.front.medium), `medium ${r.front.medium}`);
        assert.ok(FALLBACKS.includes(r.front.fallback), `fallback ${r.front.fallback}`);
        assert.ok(AGENTS.includes(r.front.agent), `agent ${r.front.agent}`);
      });

      test('every skill exists under plugins/ux-studio/skills/', () => {
        assert.ok(Array.isArray(r.front.skills) && r.front.skills.length >= 1, 'skills is a non-empty list');
        for (const s of r.front.skills) assert.ok(skillExists(s), `skill ${s}`);
      });

      test('has the eight sections, in order', () => {
        assert.deepEqual(headings(r.body), SECTIONS);
      });

      test('Expect is three user-facing bullets: Obtienes, No incluye, Ideal si', () => {
        const bullets = section(r.body, 'Expect').split('\n').filter((l) => /^[-*] /.test(l));
        assert.equal(bullets.length, 3, bullets.join('\n'));
        EXPECT_LABELS.forEach((label, i) => {
          assert.match(bullets[i], new RegExp(`^[-*] (\\*\\*)?${label}`), `bullet ${i + 1} starts with «${label}»`);
          assert.ok(bullets[i].replace(/[-*]|\*\*/g, '').replace(label, '').trim().length > 0, `«${label}» has content`);
        });
      });

      test('Questions holds 2 to 4 closed Spanish questions, recommended first, and what to infer', () => {
        const qs = section(r.body, 'Questions');
        const count = (qs.match(/¿[^?]+\?/g) ?? []).length;
        assert.ok(count >= 2 && count <= 4, `${count} questions`);
        assert.ok((qs.match(/\(Recomendado\)/g) ?? []).length >= count, 'each question marks its recommended option');
        assert.match(qs, /infer/i);
      });

      test('Medium names the run-time type check and the fallback', () => {
        const medium = section(r.body, 'Medium');
        if (r.front.medium !== 'html') assert.match(medium, /scope: ?"types"/);
        assert.match(medium, /fallback|without|no .*type|not listed/i);
      });

      test('Steps name every skill of the recipe, and Structure, Checks and Return are filled', () => {
        const steps = section(r.body, 'Steps');
        for (const s of r.front.skills) assert.match(steps, new RegExp(`\`${s}\``), `Steps name ${s}`);
        for (const name of ['Structure', 'Checks', 'Return']) {
          assert.ok(section(r.body, name).split('\n').slice(1).join('').trim().length > 0, `${name} is filled`);
        }
      });
    });
  }
});

describe('recipes/index.md', () => {
  const { header, rows } = indexTable();
  const byId = Object.fromEntries(recipes.map((r) => [r.front.id, r.front]));

  test('has the columns id | título | cuándo | qué obtienes | medio | agente', () => {
    assert.deepEqual(header, INDEX_COLUMNS);
  });

  test('every row has a recipe file and every recipe file has one row', () => {
    const ids = rows.map((row) => row.id.replace(/`/g, ''));
    assert.equal(new Set(ids).size, ids.length, ids.join(' '));
    assert.deepEqual([...ids].sort(), Object.keys(byId).sort());
  });

  test('each row repeats the title, the medium and the agent of its file, and says what you get', () => {
    for (const row of rows) {
      const id = row.id.replace(/`/g, '');
      const front = byId[id];
      if (!front) continue;
      assert.equal(row['título'], front.title, id);
      assert.ok(row.medio.includes(front.medium), `${id}: medio names ${front.medium}`);
      assert.ok(row.agente.includes(front.agent), `${id}: agente names ${front.agent}`);
      assert.ok(row['cuándo'].length > 0, `${id}: cuándo`);
      assert.ok(row['qué obtienes'].length > 0, `${id}: qué obtienes`);
    }
  });
});

describe('document fallbacks', () => {
  for (const id of ['document', 'ux-audit']) {
    test(`${id} falls back to a Markdown file, not to HTML`, () => {
      const r = recipes.find((x) => x.front.id === id);
      assert.ok(r, id);
      assert.equal(r.front.fallback, 'markdown');
    });
  }
});
