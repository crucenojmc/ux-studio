// Format checks for the ten Claude Design recipes written with the starters
// (ux-recipes/recipes/<id>.md): frontmatter, the eight sections in order, the Expect labels,
// closed questions, recipe ids named as better fits, and skills and starters that exist.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PLUGIN, RECIPES, SKILL, pluginSkills, voseo } from './helpers.mjs';

/** The recipes this suite owns: id → [title, medium, starter]. */
const MINE = {
  'ui-mockups': ['Mockups de interfaz (web o mobile)', 'design'],
  wireframe: ['Wireframes', 'design'],
  animation: ['Animación de interfaz', 'html', 'animation.html'],
  'object-3d': ['Objeto 3D', 'html', 'object-3d.html'],
  'html-email': ['Email HTML', 'html', 'html-email.html'],
  'color-type-pairing': ['Paleta y tipografía', 'design-system'],
  diagram: ['Diagrama', 'html', 'diagram.html'],
  'print-piece': ['Pieza gráfica (flyer, afiche, redes)', 'design'],
  deck: ['Presentación en diapositivas', 'slides'],
  document: ['Documento o informe', 'docs'],
};
/** The sixteen fixed recipe ids: the other writer's six plus these ten. */
const ALL_IDS = new Set(['ux-system', 'app-prototype', 'variants', 'redesign', 'dev-handoff', 'ux-audit', ...Object.keys(MINE)]);
const KEYS = ['id', 'title', 'source', 'medium', 'fallback', 'agent', 'skills'];
const SECTIONS = ['When', 'Expect', 'Questions', 'Medium', 'Structure', 'Steps', 'Checks', 'Return'];
const MEDIA = ['design', 'design-system', 'slides', 'docs', 'dashboard', 'html'];
const AGENTS = ['ux-designer', 'ux-analyst', 'ui-developer', 'video-producer'];
const SKILLS = new Set(pluginSkills());

function parse(id) {
  const file = path.join(RECIPES, `${id}.md`);
  const text = readFileSync(file, 'utf8');
  const [, frontText, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];
  assert.ok(frontText, `${id}.md opens with a frontmatter block`);
  const pairs = frontText.split('\n').map((line) => {
    const i = line.indexOf(':');
    return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
  });
  const front = Object.fromEntries(pairs);
  const skills = (front.skills?.match(/^\[(.*)\]$/)?.[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const parts = body.split(/^## (.+)$/m);
  const sections = {};
  const order = [];
  for (let i = 1; i < parts.length; i += 2) {
    order.push(parts[i].trim());
    sections[parts[i].trim()] = parts[i + 1];
  }
  return { text, keys: pairs.map(([k]) => k), front, skills, order, sections };
}

/** `code` spans in a piece of Markdown. */
const ticks = (md) => [...md.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
/** Top-level "- " bullets of a block. */
const bullets = (md) => [...md.matchAll(/^- (.+)$/gm)].map((m) => m[1]);

for (const [id, [title, medium, starterName]] of Object.entries(MINE)) {
  describe(`recipe ${id}`, () => {
    test('exists', () => assert.ok(existsSync(path.join(RECIPES, `${id}.md`)), `missing recipes/${id}.md`));

    test('frontmatter: the shared keys in order, with valid values', () => {
      const { keys, front, skills } = parse(id);
      assert.deepEqual(keys, KEYS);
      assert.equal(front.id, id);
      assert.equal(front.title, title);
      assert.equal(front.source, 'claude-design');
      assert.equal(front.medium, medium);
      assert.ok(MEDIA.includes(front.medium), front.medium);
      assert.ok(['html', 'markdown', 'none'].includes(front.fallback), front.fallback);
      assert.ok(AGENTS.includes(front.agent), front.agent);
      assert.ok(existsSync(path.join(PLUGIN, 'agents', `${front.agent}.md`)), `agent ${front.agent}`);
      assert.ok(skills.length >= 1, 'at least one skill');
      assert.equal(new Set(skills).size, skills.length, 'no repeated skill');
      for (const s of skills) assert.ok(SKILLS.has(s), `skill ${s} under plugins/ux-studio/skills/`);
    });

    test('the eight sections, in order', () => {
      assert.deepEqual(parse(id).order, SECTIONS);
    });

    test('When lists "Not for" signals, each pointing to a better recipe by id', () => {
      const when = parse(id).sections.When;
      const [, notFor] = when.split(/^Not for:\s*$/m);
      assert.ok(notFor, 'a "Not for:" line');
      const items = bullets(notFor);
      assert.ok(items.length >= 1, 'at least one signal');
      for (const item of items) {
        const ids = [...item.matchAll(/→ `([a-z0-9-]+)`/g)].map((m) => m[1]);
        assert.ok(ids.length >= 1, `"${item}" points to a recipe with → \`id\``);
        for (const other of ticks(item)) {
          assert.ok(ALL_IDS.has(other), `"${other}" is a recipe id`);
          assert.notEqual(other, id, 'never points to itself');
        }
      }
    });

    test('Expect: Obtienes, No incluye (naming the better recipe), Ideal si', () => {
      const items = bullets(parse(id).sections.Expect);
      assert.equal(items.length, 3);
      assert.match(items[0], /^\*\*Obtienes:\*\* \S/);
      assert.match(items[1], /^\*\*No incluye:\*\* \S/);
      assert.match(items[2], /^\*\*Ideal si:\*\* \S/);
      const named = ticks(items[1]);
      assert.ok(named.length >= 1, 'No incluye names the better recipe');
      for (const other of named) {
        assert.ok(ALL_IDS.has(other), `"${other}" is a recipe id`);
        assert.notEqual(other, id);
      }
    });

    test('Questions: 2 to 4 closed questions, recommended option first, plus what to infer', () => {
      const block = parse(id).sections.Questions;
      const questions = block.split(/^\d+\. /m).slice(1);
      assert.ok(questions.length >= 2 && questions.length <= 4, `${questions.length} questions`);
      for (const q of questions) {
        const [first] = q.split('\n');
        assert.match(first.trim(), /^¿.+\?$/, `a question in Spanish: ${first}`);
        const options = [...q.matchAll(/^ {3}- (.+)$/gm)].map((m) => m[1].trim());
        assert.ok(options.length >= 2, `closed options for ${first}`);
        assert.match(options[0], /\(Recomendado\)$/, `recommended first in ${first}`);
        assert.equal(options.filter((o) => o.includes('(Recomendado)')).length, 1);
      }
      const [, infer] = block.split(/^Infer instead of asking:\s*$/m);
      assert.ok(infer && bullets(infer).length >= 1, 'an "Infer instead of asking:" list');
    });

    test('Medium: the type, the run-time check and the fallback', () => {
      const { front, sections } = parse(id);
      const m = sections.Medium;
      if (front.medium !== 'html') assert.match(m, /`action: "list", scope: "types"`/);
      if (front.fallback === 'html') assert.match(m, /HTML artifact/);
      if (starterName) assert.match(m, new RegExp(`assets/starters/${starterName.replace('.', '\\.')}`));
    });

    test('Steps: numbered, each skill named at its step and only listed skills', () => {
      const { skills, sections } = parse(id);
      const steps = [...sections.Steps.matchAll(/^\d+\. (.+)$/gm)];
      assert.ok(steps.length >= 3, 'at least three steps');
      const named = new Set(ticks(sections.Steps).filter((t) => SKILLS.has(t)));
      for (const s of skills) assert.ok(named.has(s), `step names ${s}`);
      for (const s of named) assert.ok(skills.includes(s), `${s} is in the frontmatter skills`);
    });

    test('Checks and a compact Return per the task envelope', () => {
      const { sections } = parse(id);
      assert.ok(bullets(sections.Checks).length >= 2);
      assert.match(sections.Return, /skills\/presentation-brief\/references\/task-envelope\.md/);
    });

    test('every starter it names exists; neutral Spanish (no voseo)', () => {
      const { text } = parse(id);
      for (const m of text.matchAll(/assets\/starters\/([\w.-]+)/g)) {
        assert.ok(existsSync(path.join(SKILL, 'assets/starters', m[1])), `starter ${m[1]}`);
      }
      assert.deepEqual(voseo(text), []);
    });
  });
}
