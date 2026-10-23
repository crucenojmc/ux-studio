import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const readme = readFileSync(path.join(REPO, 'plugins/ux-studio/README.md'), 'utf8');
const root = readFileSync(path.join(REPO, 'README.md'), 'utf8');
const section = (text, name) => {
  const at = text.search(new RegExp(`^##+ ${name}`, 'm'));
  if (at < 0) return '';
  const level = text.slice(at).match(/^#+/)[0];
  const end = text.slice(at + 1).search(new RegExp(`^#{2,${level.length}} `, 'm'));
  return text.slice(at, end < 0 ? undefined : at + 1 + end);
};
const rows = (text) => text.split('\n').filter((l) => l.startsWith('| `'));

const TYPES = ['Diseño gráfico', 'Investigación y arquitectura UX', 'Diseño UX y prototipos', 'Implementación frontend',
  'Auditoría y medición', 'Presentación de un producto'];
const AGENTS = ['ux-designer', 'ux-analyst', 'video-producer', 'ui-developer'];
const OPTIONAL = ['frontend-design', 'web-design-guidelines', 'ui-ux-pro-max', 'emil-design-eng', 'animate', 'review-animations',
  'improve-animations', 'animation-vocabulary', 'break-ui', 'apple-design', 'pick-ui-library', 'mobile-native', 'huashu-design', 'prototype'];

describe('plugin README', () => {
  test('«Qué resuelve» and «Recorrido» start from the type of work', () => {
    for (const t of TYPES) assert.match(section(readme, 'Qué resuelve'), new RegExp(t), t);
    const tour = section(readme, 'Recorrido');
    assert.match(tour, /tipo de trabajo/i);
    assert.match(tour, /routing\.md/);
    assert.match(tour, /camino corto/i);
  });

  test('the agents table has a row per agent, ui-developer included', () => {
    const agents = rows(section(readme, 'Agentes')).map((r) => r.match(/^\| `([a-z-]+)`/)[1]);
    assert.deepEqual(agents.sort(), [...AGENTS].sort());
    const designer = rows(section(readme, 'Agentes')).find((r) => r.startsWith('| `ux-designer`'));
    for (const s of ['design-system-builder', 'prototype-showcase', 'ux-content', 'ux-research', 'graphic-assets']) assert.match(designer, new RegExp(s), s);
    assert.match(rows(section(readme, 'Agentes')).find((r) => r.startsWith('| `ux-analyst`')), /Accesibilidad/);
  });

  test('the skills table lists the new skills with their scripts and test command', () => {
    const skills = section(readme, 'Skills');
    const scripts = { 'implement-ui': 'stack-detect.mjs', 'ux-content': 'states-inventory.mjs', 'ux-research': 'sitemap.mjs', 'graphic-assets': 'icon-set.mjs' };
    for (const [s, script] of Object.entries(scripts)) {
      const row = rows(skills).find((r) => r.startsWith(`| \`${s}\``));
      assert.ok(row, s);
      assert.ok(row.includes(script), `${s}: ${script}`);
      assert.ok(row.includes(`cd tests/${s} && npm test`), `${s}: test command`);
      assert.doesNotMatch(row, /se completa al integrar/, s);
    }
    assert.match(rows(skills).find((r) => r.startsWith('| `ux-flow-audit`')), /Accesibilidad/);
  });

  test('«Primeros pasos» gives a natural-language example per type of work', () => {
    const first = section(readme, 'Primeros pasos');
    for (const t of TYPES) assert.match(first, new RegExp(t), t);
  });

  test('«Uso desde otro agente» gives one envelope example per agent', () => {
    const use = section(readme, 'Uso desde otro agente');
    assert.ok(use, 'has the section');
    assert.match(use, /task-envelope\.md/);
    assert.match(use, /routing\.md/);
    for (const a of AGENTS) {
      const example = use.indexOf(`ux-studio:${a}`);
      assert.ok(example >= 0, `${a} example`);
    }
    assert.equal(use.match(/ux-task:/g)?.length, AGENTS.length, 'one envelope per agent');
    assert.match(use, /BRIEF\.md.*opcional/i);
    assert.match(use, /AskUserQuestion/);
  });

  test('every optional design skill has one routing line and the accelerator rule', () => {
    const opt = section(readme, 'Skills de diseño opcionales');
    assert.ok(opt, 'has the section');
    assert.match(opt, /solo si está instalad/i);
    assert.match(opt, /contrato de salida/i);
    for (const s of OPTIONAL) assert.equal(rows(opt).filter((r) => r.startsWith(`| \`${s}\``)).length, 1, s);
  });

  test('«Extras opcionales» links the opt-in main-thread browser gate and says it is never auto-loaded', () => {
    const extras = section(readme, 'Extras opcionales');
    assert.ok(extras, 'has the section');
    assert.match(extras, /extras\/main-thread-browser-gate\/README\.md/);
    assert.match(extras, /browser-qa/);
    assert.match(extras, /nunca se cargan solos/);
  });

  test('neutral Spanish: no voseo', () => {
    for (const text of [readme, root]) {
      assert.doesNotMatch(text, /\b(podés|tenés|querés|hacé|armá|pedí|decí|usá|elegí|mirá|fijate|sabés|probá|corré)\b/i);
    }
  });
});

describe('release 0.5.0', () => {
  const manifest = JSON.parse(readFileSync(path.join(REPO, 'plugins/ux-studio/.claude-plugin/plugin.json'), 'utf8'));

  test('the plugin version changes, because users receive an update only when it does', () => {
    assert.equal(manifest.version, '0.5.0');
  });

  test('the README tables list ui-developer on sonnet, as its frontmatter declares', () => {
    const agent = readFileSync(path.join(REPO, 'plugins/ux-studio/agents/ui-developer.md'), 'utf8');
    assert.match(agent, /^model: sonnet$/m);
    const row = rows(section(readme, 'Agentes')).find((r) => r.startsWith('| `ui-developer`'));
    assert.match(row, /\| sonnet \| high \|$/);
    const calibration = section(readme, 'Calibración de modelos y esfuerzo').split('\n').find((l) => l.includes('`ui-developer`'));
    assert.match(calibration, /\| sonnet \| high \|/);
  });

  test('«Contratos compartidos» has a Presupuesto row for the Budget section of the task envelope', () => {
    const row = section(readme, 'Contratos compartidos').split('\n').find((l) => l.startsWith('| Presupuesto |'));
    assert.ok(row, 'a Presupuesto row');
    for (const part of [/## Budget/, /task-envelope\.md/, /HANDOFF\.md/, /1000 px/, /50 KB/, /una sola vez/]) assert.match(row, part);
  });
});

describe('root README', () => {
  test('describes the plugin by the types of work it covers', () => {
    const intro = root.slice(0, root.search(/^## /m));
    for (const w of [/diseño gráfico/i, /investigación/i, /prototipos/i, /implementación/i, /auditoría/i, /presentación/i]) assert.match(intro, w);
  });
});
