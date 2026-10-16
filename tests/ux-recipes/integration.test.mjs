// Recipes wired into the envelope, the router, the brief, the agents and the READMEs.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  PLUGIN, REPO, SKILLS, TITLES, TYPES, parseRecipe, read, recipeFiles, section, tableIds, words,
} from './helpers.mjs';

const BRIEF = path.join(SKILLS, 'presentation-brief');
const agent = (name) => read(PLUGIN, 'agents', `${name}.md`);
const body = (text) => text.replace(/^---\n[\s\S]*?\n---\n/, '');
const recipes = recipeFiles().map(parseRecipe);

describe('task envelope', () => {
  const envelope = read(BRIEF, 'references/task-envelope.md');

  test('has a recipe field in the block and in the field table', () => {
    assert.match(envelope, /^ {2}recipe: <id>/m);
    assert.match(envelope, /^\| `recipe` \|/m);
    assert.match(envelope, /ux-recipes/);
  });
});

describe('routing.md', () => {
  const routing = read(BRIEF, 'references/routing.md');
  const recipesSection = section(routing, 'Recipes');

  test('maps every type of work to its recipes', () => {
    assert.ok(recipesSection, 'has a "Recipes" section');
    for (const t of TYPES) {
      const row = recipesSection.split('\n').find((l) => l.startsWith(`| \`${t}\` |`));
      assert.ok(row, `${t} row`);
      assert.ok([...row.matchAll(/`([a-z0-9-]+)`/g)].slice(1).length >= 1, `${t} names at least one recipe`);
    }
  });

  test('names every recipe file, and only known recipes', () => {
    const named = new Set([...recipesSection.matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1]).filter((id) => !TYPES.includes(id)));
    for (const r of recipes) assert.ok(named.has(r.front.id), `${r.front.id} is routed`);
    for (const id of named) assert.ok(id in TITLES || id === 'ux-recipes', `${id} is a known recipe`);
  });

  test('stays a reasonable length', () => {
    assert.ok(routing.trimEnd().split('\n').length <= 85, `${routing.split('\n').length} lines`);
  });
});

describe('presentation-brief', () => {
  const skill = read(BRIEF, 'SKILL.md');
  const plan = read(BRIEF, 'references/module-plan.md');

  test('the type-of-work path recommends a recipe and shows its Expect bullets before starting', () => {
    assert.match(skill, /ux-recipes/);
    assert.match(skill, /recipe/i);
    assert.match(skill, /recommend/i);
    assert.match(skill, /Expect/);
    assert.match(skill, /fit check/i);
  });

  test('the «Sistema UX completo» format points to the ux-system recipe without repeating its description', () => {
    const round = section(plan, 'Ronda de formato de la presentación');
    const bullet = round.split('\n').find((l) => l.includes('«Sistema UX completo»:')) ?? '';
    assert.match(bullet, /ux-recipes\/recipes\/ux-system\.md/);
    assert.doesNotMatch(bullet, /portada con controles/i);
  });
});

describe('agents', () => {
  test('ux-designer runs most recipes', () => {
    const text = agent('ux-designer');
    assert.match(text, /`ux-recipes`/);
    assert.match(text, /most recipes/i);
  });

  test('ux-analyst runs the ux-audit recipe', () => {
    const text = agent('ux-analyst');
    assert.match(text, /`ux-recipes`/);
    assert.match(text, /`ux-audit`/);
  });

  test('ui-developer is invoked inside the redesign and dev-handoff recipes', () => {
    const text = agent('ui-developer');
    assert.match(text, /`redesign`/);
    assert.match(text, /`dev-handoff`/);
  });

  test('every agent body stays within 700 words', () => {
    for (const name of ['ux-designer', 'ux-analyst', 'ui-developer', 'video-producer']) {
      const n = words(body(agent(name)));
      assert.ok(n <= 700, `${name}: ${n} words`);
    }
  });
});

describe('READMEs', () => {
  const readme = read(PLUGIN, 'README.md');
  const root = read(REPO, 'README.md');
  const recetas = section(readme, 'Recetas');

  test('the plugin README lists the 17 recipes by title', () => {
    assert.ok(recetas, 'has a «Recetas» section');
    const ids = tableIds(recetas);
    assert.deepEqual([...ids].sort(), Object.keys(TITLES).sort());
    for (const [id, title] of Object.entries(TITLES)) {
      const row = recetas.split('\n').find((l) => l.startsWith(`| \`${id}\` |`));
      assert.ok(row.includes(` ${title} |`), `${id}: ${title}`);
    }
  });

  test('every recipe file has the README title of its frontmatter', () => {
    for (const r of recipes) assert.equal(TITLES[r.front.id], r.front.title, r.front.id);
  });

  test('gives an example envelope with a recipe', () => {
    const example = recetas.match(/```yaml\n([\s\S]*?)```/)?.[1] ?? '';
    assert.match(example, /ux-task:/);
    const id = example.match(/^ {2}recipe: ([a-z0-9-]+)/m)?.[1];
    assert.ok(id && id in TITLES, `recipe ${id}`);
    assert.match(recetas, /Seguir con/);
  });

  test('the skills table lists ux-recipes with its test command', () => {
    const row = section(readme, 'Skills').split('\n').find((l) => l.startsWith('| `ux-recipes` |'));
    assert.ok(row, 'ux-recipes row');
    assert.ok(row.includes('cd tests/ux-recipes && npm test'));
  });

  test('the root README mentions the recipes', () => {
    const intro = root.slice(0, root.search(/^## /m));
    assert.match(intro, /recetas/i);
  });

  test('neutral Spanish: no voseo', () => {
    for (const text of [readme, root, ...recipes.map((r) => r.text)]) {
      assert.doesNotMatch(text, /\b(podés|tenés|querés|hacé|armá|pedí|decí|usá|elegí|mirá|fijate|sabés|probá|corré|obtenés|seguí)\b/i);
    }
  });
});
