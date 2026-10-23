import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.resolve(HERE, '../../plugins/ux-studio/skills');
const SKILL_DIR = path.join(PLUGIN, 'presentation-brief');
const BRIEF = path.join(SKILL_DIR, 'assets');
const TYPES_DIR = path.join(BRIEF, 'work-types');
const read = (...p) => readFileSync(path.join(...p), 'utf8');
const json = (...p) => JSON.parse(read(...p));

const schema = json(PLUGIN, 'ux-flow-audit/assets/questionnaire.schema.json');
const ajv = new Ajv2020({ allErrors: true, strict: true, strictTuples: false });
addFormats(ajv);
const validate = ajv.compile(schema);

const LABELS = {
  grafico: 'Diseño gráfico',
  investigacion: 'Investigación y arquitectura UX',
  'diseno-ux': 'Diseño UX y prototipos',
  implementacion: 'Implementación frontend',
  auditoria: 'Auditoría y medición',
  presentacion: 'Presentación de un producto',
};
const SHORT = Object.keys(LABELS).filter((t) => t !== 'presentacion');
// Questions of the module plan (Q-04 «Diseño») and the format round (Q-08 «Formato») that a short path reuses.
const REUSED = { 'diseno-ux': ['Q-04', 'Q-08'] };

const router = json(BRIEF, 'work-type.questions.json');
const typeFile = (t) => json(TYPES_DIR, `${t}.questions.json`);
const bare = (label) => label.replace(/ \(Recomendado\)$/, '');
const recommended = (q) => q.options.filter((o) => /\(Recomendado\)$/.test(o.label)).map((o) => o.id);
const routing = read(SKILL_DIR, 'references/routing.md');
const rowOf = (label) => routing.split('\n').find((l) => l.startsWith('|') && l.includes(label)) ?? '';

describe('work-type.questions.json (router)', () => {
  const [q] = router.questions;

  test('is valid against the questionnaire schema', () => {
    assert.equal(validate(router), true, ajv.errorsText(validate.errors, { separator: '\n' }));
  });

  test('is one single-select question, the first round, recorded in "Tipo de trabajo"', () => {
    assert.equal(router.questions.length, 1);
    assert.equal(q.id, 'Q-01');
    assert.equal(q.round, 1);
    assert.equal(q.header, 'Trabajo');
    assert.notEqual(q.multiSelect, true);
    assert.deepEqual(q.updates, [{ target: 'BRIEF.md', section: 'Tipo de trabajo' }]);
  });

  test('shows at most 4 types, each with its exact label', () => {
    assert.ok(q.options.length <= 4);
    for (const o of q.options) assert.equal(bare(o.label), LABELS[o.id], o.id);
  });

  test('default set: presentation recommended, the two explicit-verb types left to «Otro»', () => {
    assert.deepEqual(q.options.map((o) => o.id), ['presentacion', 'diseno-ux', 'grafico', 'auditoria']);
    assert.match(q.why, /«Otro»/);
    assert.deepEqual([q.defaultIfUnanswered.option], recommended(q));
    assert.match(q.defaultIfUnanswered.note, /supuesto/);
  });

  test('routing.md holds the option texts of every type, the JSON copies them exactly', () => {
    for (const label of Object.values(LABELS)) assert.match(routing, new RegExp(`«${label}»`), label);
    for (const o of q.options) assert.ok(routing.includes(o.description), `${o.id} description drifted`);
  });
});

describe('type questions (assets/work-types/<type>.questions.json)', () => {
  const files = readdirSync(TYPES_DIR).filter((f) => f.endsWith('.questions.json')).sort();
  const all = () => [
    ...['work-type', 'design-scope', 'module-plan', 'presentation-format'].map((n) => json(BRIEF, `${n}.questions.json`)),
    ...SHORT.map(typeFile),
  ].flatMap((f) => f.questions);

  test('one file per short type, none for the presentation', () => {
    assert.deepEqual(files, SHORT.map((t) => `${t}.questions.json`).sort());
  });

  for (const t of SHORT) {
    test(`${t}: valid, round 3, recorded in "Plan de módulos", at most 3 type questions with the reused ones`, () => {
      const f = typeFile(t);
      assert.equal(validate(f), true, `${t}: ${ajv.errorsText(validate.errors, { separator: '\n' })}`);
      for (const q of f.questions) {
        assert.equal(q.round, 3, q.id);
        assert.ok(q.header.length <= 12, q.header);
        assert.deepEqual(q.updates, [{ target: 'BRIEF.md', section: 'Plan de módulos' }], q.id);
      }
      const asked = [...f.questions.map((q) => q.id), ...(REUSED[t] ?? [])];
      assert.ok(asked.length >= 2 && asked.length <= 3, `${t} asks ${asked.length}`);
      for (const id of asked) assert.match(rowOf(LABELS[t]), new RegExp(id), `${t} row lists ${id}`);
    });
  }

  test('question and finding ids are unique across every brief question file, so any path can merge them', () => {
    const ids = all().map((q) => q.id);
    assert.equal(new Set(ids).size, ids.length, ids.join(' '));
    const findings = all().flatMap((q) => q.unblocks);
    assert.equal(new Set(findings).size, findings.length);
  });

  test('an unanswered type question applies the recommendation, labelled as an assumption, except a permission', () => {
    for (const t of SHORT) {
      for (const q of typeFile(t).questions) {
        assert.match(q.defaultIfUnanswered.note, /supuesto|permiso/, q.id);
        if (q.header === 'Cambios') continue;
        assert.deepEqual([].concat(q.defaultIfUnanswered.option).sort(), recommended(q).sort(), q.id);
      }
    }
  });

  test('implementation: no answer never authorizes editing the product repository', () => {
    const changes = typeFile('implementacion').questions.find((q) => q.header === 'Cambios');
    assert.ok(changes, 'asks how the changes are delivered');
    const ids = changes.options.map((o) => o.id).sort();
    assert.deepEqual(ids, ['parche', 'rama']);
    assert.equal(changes.defaultIfUnanswered.option, 'parche');
    assert.match(changes.defaultIfUnanswered.note, /permiso/);
    assert.match(changes.options.find((o) => o.id === 'rama').consequence, /ui-developer/);
  });

  test('each type offers the deliverables the user decided', () => {
    const offers = (t, header) => typeFile(t).questions.find((q) => q.header === header).options.map((o) => bare(o.label));
    assert.deepEqual(offers('grafico', 'Piezas'), ['Íconos', 'Ilustraciones', 'Diapositivas', 'Lienzo de diseño']);
    assert.deepEqual(offers('investigacion', 'Entregables'), ['Plan de investigación', 'Personas', 'Mapa del sitio', 'Wireframes']);
    assert.deepEqual(offers('diseno-ux', 'Entregables'), ['Prototipo navegable', 'Sistema de diseño', 'Textos de la interfaz']);
    assert.deepEqual(offers('auditoria', 'Medición'), ['Utilidad de los flujos', 'Accesibilidad', 'Fidelidad de la implementación']);
  });
});

describe('routing.md', () => {
  const owners = {
    grafico: ['graphic-assets', 'ux-designer', 'Slides', 'Design'],
    investigacion: ['ux-research', 'ux-designer'],
    'diseno-ux': ['prototype-showcase', 'design-system-builder', 'ux-content', 'ux-designer'],
    implementacion: ['implement-ui', 'ui-developer'],
    auditoria: ['ux-flow-audit', 'Accesibilidad', 'implementation-fidelity', 'ux-analyst'],
    presentacion: ['module plan', 'video-producer'],
  };

  test('one row per type with its skills, agent, path and output location', () => {
    for (const [t, words] of Object.entries(owners)) {
      const row = rowOf(`\`${t}\``);
      assert.ok(row, `${t} has a row`);
      for (const w of words) assert.ok(row.includes(w), `${t} row names ${w}`);
      assert.match(row, /output dir|BRIEF\.md|artifact/i, `${t} row names where the output goes`);
    }
    assert.match(rowOf('`presentacion`'), /full/i);
    for (const t of SHORT) assert.match(rowOf(`\`${t}\``), /short/i, t);
  });

  test('asks with at most 4 options and names the hidden types for «Otro»', () => {
    assert.match(routing, /at most 4 options/i);
    assert.match(routing, /«Otro»/);
    assert.match(routing, /names the types not shown/i);
  });

  test('ui-developer is the only agent that edits a product repository, after the user explicit OK', () => {
    assert.match(routing, /`ui-developer` is the only agent that edits a product repository/);
    assert.match(routing, /explicit OK/);
  });

  test('tells a caller which agent and skill to invoke, with the task envelope', () => {
    const start = routing.search(/^## For callers/m);
    assert.ok(start >= 0, 'has a "For callers" section');
    const section = routing.slice(start);
    assert.match(section, /ux-studio:<agent>/);
    assert.match(section, /task-envelope\.md/);
    assert.match(section, /parallel/i);
  });
});

describe('presentation-brief SKILL.md routing', () => {
  const skill = read(SKILL_DIR, 'SKILL.md');
  const steps = skill.slice(skill.search(/^## Execution Steps/m));

  test('the first step classifies the request by type of work', () => {
    const first = steps.split('\n').find((l) => /^1\. /.test(l));
    assert.match(first, /type of work/i);
    assert.match(first, /routing\.md/);
  });

  test('the full brief is only for the presentation; every other type takes the short path', () => {
    assert.match(skill, /«Presentación de un producto».*full/i);
    assert.match(skill, /short path/i);
    assert.match(skill, /mini-brief-template\.md/);
  });

  test('stays the front door for direct use and points callers to the routing table', () => {
    assert.match(skill, /front door/i);
    assert.match(skill, /task-envelope\.md/);
  });
});

describe('module-plan.md routing', () => {
  const ref = read(SKILL_DIR, 'references/module-plan.md');

  test('the work type round comes first, before the design scope round', () => {
    const type = ref.search(/^## Ronda de tipo de trabajo/m);
    assert.ok(type >= 0, 'has a "Ronda de tipo de trabajo" section');
    assert.ok(type < ref.search(/^## Ronda de alcance del diseño/m));
    assert.match(ref.slice(type, ref.indexOf('\n## ', type + 1)), /routing\.md/);
  });

  test('the short path asks the type questions instead of the module plan', () => {
    const mini = ref.slice(ref.search(/^## Modo mínimo/m));
    assert.match(mini, /work-types\/<tipo>\.questions\.json/);
    assert.match(mini, /routing\.md/);
  });
});

describe('templates by type of work', () => {
  const full = read(BRIEF, 'brief-template.md');
  const mini = read(BRIEF, 'mini-brief-template.md');
  const section = (text, name) => {
    const at = text.search(new RegExp(`^## .*${name}`, 'm'));
    return at < 0 ? '' : text.slice(at, text.indexOf('\n## ', at + 1));
  };

  test('both templates record the type of work before the design scope', () => {
    for (const [name, text] of [['brief-template.md', full], ['mini-brief-template.md', mini]]) {
      const type = text.search(/^## .*Tipo de trabajo/m);
      assert.ok(type >= 0 && type < text.search(/^## .*Alcance del diseño/m), name);
    }
    assert.match(section(full, 'Tipo de trabajo'), /Presentación de un producto/);
    for (const t of SHORT) assert.match(section(mini, 'Tipo de trabajo'), new RegExp(LABELS[t]), t);
  });

  test('the mini plan lists the skills of the type, with their owner and output', () => {
    const plan = section(mini, 'Plan de módulos');
    assert.match(plan, /\| Skill \|/);
    assert.match(plan, /Salida/);
    assert.match(plan, /ui-developer/);
    assert.match(plan, /routing\.md/);
  });

  test('the mini restrictions record the product repository and the explicit permission to edit it', () => {
    const r = section(mini, 'Restricciones');
    assert.match(r, /[Rr]epositorio del producto/);
    assert.match(r, /permiso/);
  });

  test('every type file and the routing table exist where the skill links them', () => {
    assert.ok(existsSync(path.join(SKILL_DIR, 'references/routing.md')));
    for (const t of SHORT) assert.ok(existsSync(path.join(TYPES_DIR, `${t}.questions.json`)), t);
  });
});

describe('task-envelope.md (invocation contract)', () => {
  const envelope = () => read(SKILL_DIR, 'references/task-envelope.md');

  test('defines every field a caller passes, BRIEF.md optional', () => {
    const text = envelope();
    for (const field of ['objective', 'type', 'skills', 'inputs', 'scope', 'platforms', 'roles', 'focus', 'language',
      'constraints', 'outputDir', 'returnBudget', 'brief']) assert.match(text, new RegExp(`\\b${field}:`), field);
    assert.match(text, /BRIEF\.md is optional/i);
  });

  test('missing critical fields return a questionnaire before any heavy reading', () => {
    assert.match(envelope(), /before any heavy reading/i);
    assert.match(envelope(), /design-scope\.questions\.json/);
  });

  test('agents never call AskUserQuestion; they return closed questions to the caller', () => {
    assert.match(envelope(), /never call `AskUserQuestion`/);
  });

  test('parallel-safe: writes only in its output dir and proposes changes to shared files', () => {
    const text = envelope();
    assert.match(text, /tmp\/<topic>\/<agent>-<slug>\//);
    assert.match(text, /only inside the output dir/i);
    for (const shared of ['BRIEF.md', 'decisions log', 'fidelity.config.json']) assert.ok(text.includes(shared), shared);
    assert.match(text, /proposed-changes\.md/);
  });

  test('the return is compact: summary, artifacts and questions within the budget', () => {
    const ret = envelope().slice(envelope().search(/^## Return/m));
    for (const part of [/summary/i, /artifacts/i, /questions/i, /returnBudget/]) assert.match(ret, part);
  });
});

describe('task-envelope.md Budget (shared cost contract)', () => {
  const budget = () => {
    const text = read(SKILL_DIR, 'references/task-envelope.md');
    const at = text.search(/^## Budget/m);
    if (at < 0) return '';
    const end = text.indexOf('\n## ', at + 1);
    return text.slice(at, end < 0 ? undefined : end);
  };

  test('has a Budget section before the Return section', () => {
    const text = read(SKILL_DIR, 'references/task-envelope.md');
    assert.ok(budget(), 'has a "## Budget" section');
    assert.ok(text.search(/^## Budget/m) < text.search(/^## Return/m), 'Budget comes before Return');
  });

  test('bounded runs: stop near 80 tool calls with a HANDOFF.md and status: partial; a fresh run resumes from it', () => {
    const b = budget();
    assert.match(b, /about 80 tool calls/);
    assert.match(b, /build→check cycles/);
    assert.match(b, /`HANDOFF\.md`/);
    for (const part of ['done', 'remaining', 'decisions', 'files', 'open checks']) assert.ok(b.includes(part), part);
    assert.match(b, /`status: partial`/);
    assert.match(b, /resumes from `HANDOFF\.md`[^.]*does not redo the reads/i);
  });

  test('images: never Read a full-size screenshot; at most 1000 px wide JPEG; numeric checks first', () => {
    const b = budget();
    assert.match(b, /[Nn]ever Read a full-size screenshot/);
    assert.match(b, /1000 px wide \(JPEG\)/);
    assert.match(b, /pixel diff, ΔE, DOM or computed styles, console errors/);
    assert.match(b, /only at the images a check flagged/i);
  });

  test('large files: never Read whole a file over 50 KB; rg -n and line ranges; never read a published page back', () => {
    const b = budget();
    assert.match(b, /[Nn]ever Read whole a file over 50 KB/);
    assert.match(b, /`rg -n`/);
    assert.match(b, /line ranges/);
    assert.match(b, /Edit the local source/);
    assert.match(b, /never read back a published artifact page/i);
  });

  test('verify once: iterate on what the last edit touched, run the full pass once on the final state', () => {
    const b = budget();
    assert.match(b, /only what the last edit touched/i);
    assert.match(b, /full verification pass once, at the end, on the final state/i);
  });

  test('questions: the schema is read only when there are questions to return', () => {
    assert.match(budget(), /`questionnaire\.schema\.json` only when there are questions to return/);
  });
});
