import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.resolve(HERE, '../../plugins/ux-studio/skills');
const BRIEF = path.join(PLUGIN, 'presentation-brief/assets');
const schema = JSON.parse(readFileSync(path.join(PLUGIN, 'ux-flow-audit/assets/questionnaire.schema.json'), 'utf8'));
const plan = JSON.parse(readFileSync(path.join(BRIEF, 'module-plan.questions.json'), 'utf8'));

// strictTuples off: the schema pins the recommended option with an open tuple.
const ajv = new Ajv2020({ allErrors: true, strict: true, strictTuples: false });
addFormats(ajv);
const validate = ajv.compile(schema);

describe('module-plan.questions.json', () => {
  test('is valid against the ux-flow-audit questionnaire schema', () => {
    assert.equal(validate(plan), true, ajv.errorsText(validate.errors, { separator: '\n' }));
  });

  test('has exactly the 4 modules', () => {
    assert.equal(plan.questions.length, 4);
    const headers = plan.questions.map((q) => q.header);
    assert.equal(new Set(headers).size, 4);
  });

  test('recommended option first and marked (Recomendado)', () => {
    for (const q of plan.questions) {
      assert.match(q.options[0].label, /\(Recomendado\)$/, q.id);
      for (const o of q.options.slice(1)) assert.doesNotMatch(o.label, /Recomendado/, q.id);
    }
  });

  test('video is never the recommended nor the default option', () => {
    for (const q of plan.questions) {
      assert.doesNotMatch(q.options[0].label, /video/i, q.id);
      const def = q.options.find((o) => o.id === q.defaultIfUnanswered.option);
      assert.ok(def, `${q.id} default must be an existing option`);
      assert.doesNotMatch(def.label, /video/i, q.id);
    }
  });

  test('headers are at most 12 characters', () => {
    for (const q of plan.questions) assert.ok(q.header.length <= 12, q.header);
  });

  test('the usefulness audit is always proposed with a skip option', () => {
    const audit = plan.questions.find((q) => /utilidad/i.test(q.question));
    assert.ok(audit, 'audit question present');
    assert.ok(audit.options.some((o) => /saltear/i.test(o.label)));
  });

  test('the design paths combine; «Saltear» is exclusive', () => {
    const design = plan.questions.find((q) => q.header === 'Diseño');
    assert.equal(design.multiSelect, true);
    const byId = Object.fromEntries(design.options.map((o) => [o.id, o]));
    assert.equal(byId.saltear.exclusive, true);
    for (const id of ['reutilizar', 'codigo', 'web']) assert.notEqual(byId[id].exclusive, true, id);
  });

  test('the showcase deliverable no longer promises a fixed page', () => {
    const deliv = plan.questions.find((q) => q.header === 'Entregables');
    const showcase = deliv.options.find((o) => o.id === 'showcase');
    assert.doesNotMatch(showcase.description, /principios|sistema/i);
    assert.match(showcase.description, /formato/i);
  });
});

describe('presentation-format.questions.json', () => {
  const format = JSON.parse(readFileSync(path.join(BRIEF, 'presentation-format.questions.json'), 'utf8'));
  const [fmt, sections] = format.questions;
  const ids = (q) => q.options.map((o) => o.id).sort();
  const recommended = (q) => q.options.filter((o) => /\(Recomendado\)$/.test(o.label)).map((o) => o.id);

  test('is valid against the questionnaire schema', () => {
    assert.equal(validate(format), true, ajv.errorsText(validate.errors, { separator: '\n' }));
  });

  test('is a separate round with two questions numbered after the module plan', () => {
    assert.equal(format.questions.length, 2);
    const planIds = new Set(plan.questions.map((q) => q.id));
    for (const q of format.questions) assert.ok(!planIds.has(q.id), `${q.id} collides with the module plan`);
    assert.ok(format.questions.every((q) => q.round > Math.max(...plan.questions.map((p) => p.round))));
  });

  test('format is single-select between app, tour and ux-system', () => {
    assert.equal(fmt.header, 'Formato');
    assert.notEqual(fmt.multiSelect, true);
    assert.deepEqual(ids(fmt), ['app', 'tour', 'ux-system']);
    const labels = Object.fromEntries(fmt.options.map((o) => [o.id, o.label.replace(/ \(Recomendado\)$/, '')]));
    assert.deepEqual(labels, { app: 'Solo la app simulada', tour: 'App con recorridos guiados', 'ux-system': 'Sistema UX completo' });
  });

  test('sections are multi-select: Principios, Sistema, Inventario, Definiciones y decisiones', () => {
    assert.equal(sections.header, 'Secciones');
    assert.equal(sections.multiSelect, true);
    assert.deepEqual(ids(sections), ['definiciones', 'inventario', 'principios', 'sistema']);
    const labels = sections.options.map((o) => o.label.replace(/ \(Recomendado\)$/, '')).sort();
    assert.deepEqual(labels, ['Definiciones y decisiones', 'Inventario', 'Principios', 'Sistema']);
  });

  test('the complete UX system is not the default and the design system is shown only on request', () => {
    assert.notEqual(fmt.options[0].id, 'ux-system');
    assert.notEqual(fmt.defaultIfUnanswered.option, 'ux-system');
    assert.ok(!recommended(sections).includes('sistema'));
    assert.ok(![].concat(sections.defaultIfUnanswered.option).includes('sistema'));
  });

  test('an unanswered round applies the recommendation, labelled as an assumption', () => {
    for (const q of format.questions) {
      assert.deepEqual([].concat(q.defaultIfUnanswered.option).sort(), recommended(q).sort(), q.id);
      assert.match(q.defaultIfUnanswered.note, /supuesto/);
    }
  });
});

describe('design-scope.questions.json', () => {
  const scope = JSON.parse(readFileSync(path.join(BRIEF, 'design-scope.questions.json'), 'utf8'));
  const format = JSON.parse(readFileSync(path.join(BRIEF, 'presentation-format.questions.json'), 'utf8'));
  const [platform, roles] = scope.questions;
  const labels = (q) => Object.fromEntries(q.options.map((o) => [o.id, o.label.replace(/ \(Recomendado\)$/, '')]));
  const recommended = (q) => q.options.filter((o) => /\(Recomendado\)$/.test(o.label)).map((o) => o.id);

  test('is valid against the questionnaire schema', () => {
    assert.equal(validate(scope), true, ajv.errorsText(validate.errors, { separator: '\n' }));
  });

  test('asks the platform: web, mobile or both, single-select', () => {
    assert.equal(platform.header, 'Plataforma');
    assert.notEqual(platform.multiSelect, true);
    assert.deepEqual(labels(platform), { web: 'Web', mobile: 'Mobile', 'web-mobile': 'Web y mobile' });
  });

  test('asks whether flows change by role and how roles are shown, single-select', () => {
    assert.equal(roles.header, 'Roles');
    assert.notEqual(roles.multiSelect, true);
    assert.deepEqual(labels(roles), {
      uno: 'Un solo rol',
      todos: 'Varios roles, diseño completo para cada uno',
      foco: 'Varios roles, uno en foco',
    });
    assert.match(roles.options.find((o) => o.id === 'foco').consequence, /qué rol/i);
  });

  test('comes right after the work type: work type, design scope, module plan and format, numbered in that order', () => {
    const workType = JSON.parse(readFileSync(path.join(BRIEF, 'work-type.questions.json'), 'utf8'));
    const rounds = [workType, scope, plan, format].map((f) => [...new Set(f.questions.map((q) => q.round))]);
    for (const r of rounds) assert.equal(r.length, 1, 'one round per file');
    assert.deepEqual(rounds.flat(), [1, 2, 3, 4]);
    const all = [workType, scope, plan, format].flatMap((f) => f.questions);
    assert.deepEqual(all.map((q) => q.id), all.map((_, i) => `Q-${String(i + 1).padStart(2, '0')}`));
    const unblocks = all.flatMap((q) => q.unblocks);
    assert.equal(new Set(unblocks).size, unblocks.length, 'finding ids are unique across the rounds');
  });

  test('records the answers in the BRIEF section "Alcance del diseño"', () => {
    for (const q of scope.questions) assert.deepEqual(q.updates, [{ target: 'BRIEF.md', section: 'Alcance del diseño' }], q.id);
  });

  test('an unanswered round applies the recommendation, labelled as an assumption', () => {
    for (const q of scope.questions) {
      assert.deepEqual([q.defaultIfUnanswered.option], recommended(q), q.id);
      assert.match(q.defaultIfUnanswered.note, /supuesto/);
      assert.ok(q.header.length <= 12, q.header);
    }
  });
});

describe('module-plan.md', () => {
  const ref = readFileSync(path.join(PLUGIN, 'presentation-brief/references/module-plan.md'), 'utf8');

  test('derives the format and sections from the audiences', () => {
    const rules = ref.slice(ref.search(/^## Ronda de formato/m));
    assert.ok(rules.length < ref.length, 'has a "Ronda de formato" section');
    for (const label of ['Solo la app simulada', 'App con recorridos guiados', 'Sistema UX completo',
      'Principios', 'Sistema', 'Inventario', 'Definiciones y decisiones']) assert.match(rules, new RegExp(label), label);
    for (const audience of [/usuarios finales/i, /dueño funcional/i, /desarrollo/i, /revisión de UX/i]) assert.match(rules, audience);
  });

  test('asks the design scope round before the module plan, with the inference signals', () => {
    const start = ref.search(/^## Ronda de alcance del diseño/m);
    assert.ok(start >= 0, 'has a "Ronda de alcance del diseño" section');
    assert.ok(start < ref.search(/^## Preguntas/m), 'before the module plan questions');
    const round = ref.slice(start, ref.indexOf('\n## ', start + 1));
    for (const label of ['Web', 'Mobile', 'Web y mobile', 'Un solo rol', 'Varios roles, diseño completo para cada uno',
      'Varios roles, uno en foco', 'Rol en foco']) assert.match(round, new RegExp(label), label);
    for (const signal of [/Angular/, /Flutter/, /Ionic/, /React Native/, /guard/i, /permis/i, /enum/i]) assert.match(round, signal);
    assert.match(round, /platforms: \['web'\]/);
    assert.match(round, /roles: 'single' \| 'all' \| \{ focus: '<roleId>' \}/);
  });

  test('states that showing the design system is opt-in and that design paths combine', () => {
    assert.match(ref, /«Sistema».*se elige/);
    assert.match(ref, /«Saltear».*exclusiv/);
  });
});

describe('presentation-brief SKILL.md', () => {
  const dir = path.join(PLUGIN, 'presentation-brief');
  const skill = readFileSync(path.join(dir, 'SKILL.md'), 'utf8');

  test('every ${CLAUDE_SKILL_DIR} link resolves to a file', () => {
    const links = [...skill.matchAll(/\$\{CLAUDE_SKILL_DIR\}\/([\w./-]+)/g)].map((m) => m[1].replace(/[.,)]+$/, ''));
    assert.ok(links.some((l) => l.endsWith('presentation-format.questions.json')), 'links the format round');
    assert.ok(links.some((l) => l.endsWith('design-scope.questions.json')), 'links the design scope round');
    assert.ok(links.some((l) => l.endsWith('work-type.questions.json')), 'links the work type round');
    assert.ok(links.some((l) => l.endsWith('references/routing.md')), 'links the routing table');
    for (const rel of links) assert.ok(existsSync(path.join(dir, rel)), `missing ${rel}`);
  });

  test('puts BRIEF.md at the project root, or in tmp/<topic>/ when the root is not the product', () => {
    assert.match(skill, /tmp\/<topic>\/BRIEF\.md/);
    assert.match(skill, /monorepo/i);
  });
});

describe('brief templates', () => {
  const brief = readFileSync(path.join(BRIEF, 'brief-template.md'), 'utf8');
  test('brief-template.md has a Plan de módulos section after Entregables', () => {
    const plan = brief.search(/^## .*Plan de módulos/m);
    const deliv = brief.search(/^## .*Entregables/m);
    assert.ok(plan > deliv && deliv >= 0);
    assert.match(brief, /Orden de ejecución/);
  });

  test('mini-brief-template.md exists, has the module plan and no audience matrix', () => {
    const mini = readFileSync(path.join(BRIEF, 'mini-brief-template.md'), 'utf8');
    assert.match(mini, /Plan de módulos/);
    assert.doesNotMatch(mini, /Presupuesto de atención/);
    assert.doesNotMatch(mini, /^## .*Públicos/m);
  });

  test('both templates record the design scope before the module plan', () => {
    for (const name of ['brief-template.md', 'mini-brief-template.md']) {
      const text = readFileSync(path.join(BRIEF, name), 'utf8');
      const scope = text.search(/^## .*Alcance del diseño/m);
      assert.ok(scope >= 0 && scope < text.search(/^## .*Plan de módulos/m), `${name}: scope section before the module plan`);
      const section = text.slice(scope, text.indexOf('\n## ', scope + 1));
      assert.match(section, /Plataforma: \{Web \/ Mobile \/ Web y mobile\}/, name);
      assert.match(section, /platforms: \['web'\] \| \['phone'\] \| \['web', 'phone'\]/, name);
      assert.match(section, /roles: 'single' \| 'all' \| \{ focus: '<roleId>' \}/, name);
      assert.match(section, /Rol en foco/, name);
    }
  });

  test('both templates record the presentation format and its sections after the module plan', () => {
    for (const name of ['brief-template.md', 'mini-brief-template.md']) {
      const text = readFileSync(path.join(BRIEF, name), 'utf8');
      const fmt = text.search(/^## .*Formato de la presentación/m);
      assert.ok(fmt > text.search(/^## .*Plan de módulos/m), `${name}: format section after the module plan`);
      const section = text.slice(fmt);
      assert.match(section, /mode: 'app' \| 'tour' \| 'ux-system'/, name);
      assert.match(section, /sections:/, name);
    }
  });
});
