// Structural checks for the data-viz skill package: SKILL.md, references and assets.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { PLUGIN, SKILL, asset, read, readJson } from './helpers.mjs';
import { findForbiddenTerms } from '../_shared/forbidden-terms.mjs';

const NAME = 'data-viz';
const text = existsSync(path.join(SKILL, 'SKILL.md')) ? read(SKILL, 'SKILL.md') : '';
const [, front = '', body = ''] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];
const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = path.join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const section = (md, heading) => {
  const at = md.search(new RegExp(`^#{2,3} ${heading}`, 'm'));
  if (at < 0) return '';
  const level = md.slice(at).match(/^#+/)[0].length;
  const rest = md.slice(at + 1);
  const end = rest.search(new RegExp(`^#{2,${level}} `, 'm'));
  return md.slice(at, end < 0 ? undefined : at + 1 + end);
};
const VOSEO = /(?<!\p{L})(vos|tenés|podés|querés|sabés|hacé|elegí|probá|ingresá|usá|mirá|fijate|revisá|completá|confirmá)(?!\p{L})/iu;
const CARD_LABELS = ['Pregunta que responde', 'Por qué este gráfico', 'Alternativas descartadas y por qué', 'Fuente de los datos',
  'Matemática', 'Limitaciones y cómo leerlo'];

describe(`${NAME} SKILL.md`, () => {
  test('has the normative frontmatter', () => {
    assert.match(front, new RegExp(`^name: ${NAME}$`, 'm'));
    assert.match(front, /^license: UNLICENSED$/m);
    assert.match(front, /^metadata:\n {2}author: "Mapplics"\n {2}version: "1\.0"$/m);
    const desc = front.match(/^description: "(.*)"$/m);
    assert.ok(desc && desc[1].startsWith('Trigger: ') && desc[1].length <= 250, desc?.[1]);
  });

  test('has the required sections in order', () => {
    assert.deepEqual([...body.matchAll(/^## (.+)$/gm)].map((m) => m[1]),
      ['Activation Contract', 'Hard Rules', 'Decision Gates', 'Execution Steps', 'Output Contract', 'References']);
  });

  test('stays lean: at most 70 lines', () => {
    assert.ok(text.trimEnd().split('\n').length <= 70, `${text.split('\n').length} lines`);
  });

  test('works from the caller task envelope, BRIEF.md optional, outputs under --out', () => {
    assert.match(text, /presentation-brief\/references\/task-envelope\.md/);
    assert.match(text, /BRIEF\.md.*optional|optional.*BRIEF\.md/i);
    assert.match(text, /--out/);
  });

  test('the card is visible next to every chart, never only in an appendix', () => {
    const rules = section(body, 'Hard Rules');
    assert.match(rules, /«Ficha del gráfico»/);
    assert.match(rules, /next to/i);
    assert.match(rules, /never only in an appendix/i);
  });

  test('unknown data meanings become questionnaire items, never guesses', () => {
    assert.match(text, /questionnaire\.schema\.json/);
    assert.match(text, /data-meaning/);
    assert.match(text, /[Nn]ever invent/);
  });

  test('the steps go question → data profile → chart-selection → spec → chart-check → build → card', () => {
    const steps = section(body, 'Execution Steps');
    const order = [/question/i, /[Pp]rofile the data/, /chart-selection\.md/, /chart-spec\.schema\.json/, /chart-check\.mjs/, /[Bb]uild/, /card/i];
    let from = 0;
    for (const re of order) {
      const at = steps.slice(from).search(re);
      assert.ok(at >= 0, `${re} after position ${from}`);
      from += at + 1;
    }
  });

  test('every ${CLAUDE_SKILL_DIR} link resolves to a file', () => {
    const links = [...text.matchAll(/\$\{CLAUDE_SKILL_DIR\}\/([\w./-]+)/g)].map((m) => m[1].replace(/[.,)]+$/, ''));
    assert.ok(links.length >= 6);
    for (const rel of links) assert.ok(existsSync(path.join(SKILL, rel)), `missing ${rel}`);
  });

  test('says references load only on demand', () => {
    assert.match(text, /only when|on demand/i);
  });

  test('ships every deliverable', () => {
    for (const rel of ['references/chart-selection.md', 'references/chart-card.md', 'assets/chart-spec.schema.json',
      'assets/chart-check.mjs', 'assets/chart-card.html', 'assets/chart-spec.example.json', 'assets/questionnaire.example.json']) {
      assert.ok(existsSync(path.join(SKILL, rel)), rel);
    }
  });

  test('neutral Spanish, no real client names, in every file of the skill', () => {
    for (const file of walk(SKILL)) {
      const content = readFileSync(file, 'utf8');
      assert.doesNotMatch(content, VOSEO, file);
      assert.deepEqual(findForbiddenTerms(content), [], file);
    }
  });
});

describe('references/chart-selection.md', () => {
  const ref = existsSync(path.join(SKILL, 'references/chart-selection.md')) ? read(SKILL, 'references/chart-selection.md') : '';
  const schema = readJson(SKILL, 'assets/chart-spec.schema.json');

  test('one section per kind of question, each with recommended charts, when not to use them and traps', () => {
    for (const q of schema.properties.question.enum) {
      const at = ref.search(new RegExp(`^### .*\\(\`${q}\`\\)`, 'm'));
      assert.ok(at >= 0, `section for ${q}`);
      const block = ref.slice(at, ref.indexOf('\n### ', at + 1) >>> 0);
      for (const label of ['Recommended:', 'Not when:', 'Traps:']) assert.match(block, new RegExp(`^- ${label}`, 'm'), `${q}: ${label}`);
    }
  });

  test('recommends only chart types the spec accepts, and covers every one of them', () => {
    const types = new Set(schema.properties.type.enum);
    const named = new Set(ref.split('\n').filter((l) => l.startsWith('- Recommended:'))
      .flatMap((l) => [...l.matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1])));
    for (const t of named) assert.ok(types.has(t), `${t} is a spec type`);
    for (const t of types) assert.ok(named.has(t), `${t} is recommended somewhere`);
  });

  test('states the perceptual-accuracy order', () => {
    assert.match(ref, /position on a common scale > length > angle and area > colou?r and saturation/i);
  });

  test('cites only Cleveland & McGill 1984 (JASA) and Munzner 2014; the rest is labelled convention', () => {
    assert.match(ref, /Cleveland.*McGill.*1984/);
    assert.match(ref, /Journal of the American Statistical Association/);
    assert.match(ref, /Munzner.*2014/);
    assert.match(ref, /Visualization Analysis and Design/);
    const years = new Set([...ref.matchAll(/\b(?:19|20)\d{2}\b/g)].map((m) => m[0]));
    assert.deepEqual([...years].sort(), ['1984', '2014']);
    assert.ok((ref.match(/convention/gi) ?? []).length >= 5, 'conventions are labelled');
  });

  test('lists every rule chart-check applies, with its basis', async () => {
    const src = readFileSync(asset('chart-check.mjs'), 'utf8');
    const rules = new Set([...src.matchAll(/add\('([a-z0-9-]+)'/g)].map((m) => m[1]));
    assert.ok(rules.size >= 11);
    const table = section(ref, 'Reading rules');
    for (const r of rules) assert.match(table, new RegExp(`\\| \`${r}\` \\|`), r);
  });
});

describe('references/chart-card.md', () => {
  const ref = existsSync(path.join(SKILL, 'references/chart-card.md')) ? read(SKILL, 'references/chart-card.md') : '';

  test('defines the six fields with the labels shown and their spec paths', () => {
    for (const label of CARD_LABELS) assert.match(ref, new RegExp(`«${label}»`), label);
    for (const p of ['card.question', 'card.why', 'card.alternatives', 'card.source', 'card.math', 'card.limitations']) assert.ok(ref.includes(p), p);
  });

  test('the source names origin, extraction, period, filters, cut-off date and n', () => {
    for (const p of ['origin', 'extraction', 'period', 'filters', 'cutoff', 'n']) assert.ok(ref.includes(`source.${p}`), p);
  });

  test('the math names formula, aggregation, units, transformations, uncertainty, outliers and assumptions', () => {
    for (const p of ['formula', 'aggregation', 'units', 'transformations', 'uncertainty', 'outliers', 'assumptions']) assert.ok(ref.includes(`math.${p}`), p);
  });

  test('visible next to the chart, collapsible allowed, never only in an appendix', () => {
    assert.match(ref, /next to/i);
    assert.match(ref, /collapsible/i);
    assert.match(ref, /never only in an appendix/i);
  });

  test('demo data is labelled; unknown meanings become data-meaning questions', () => {
    assert.match(ref, /«Datos de demostración/);
    assert.match(ref, /data-meaning/);
    assert.match(ref, /chart-check/);
  });
});

describe('questionnaire wiring', () => {
  const schema = readJson(PLUGIN, 'skills/ux-flow-audit/assets/questionnaire.schema.json');
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictTuples: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  test('the shared schema lets an answer update a chart spec and re-run chart-check', () => {
    const q = schema.$defs.question.properties;
    assert.ok(q.updates.items.properties.target.enum.includes('chart-spec'));
    assert.ok(q.rerun.items.enum.includes('chart-check'));
  });

  test('the example asks an unknown data meaning as a closed question, valid against the shared schema', () => {
    const example = readJson(SKILL, 'assets/questionnaire.example.json');
    assert.equal(validate(example), true, ajv.errorsText(validate.errors, { separator: '\n' }));
    const [q] = example.questions;
    assert.equal(q.topic, 'data-meaning');
    assert.equal(q.defaultIfUnanswered, undefined);
    assert.deepEqual(q.rerun, ['chart-check']);
    assert.equal(q.updates[0].target, 'chart-spec');
  });

  test('the questionnaire reference lists the data-viz targets and checks', () => {
    const ref = read(PLUGIN, 'skills/ux-flow-audit/references/questionnaire.md');
    const row = ref.split('\n').find((l) => l.startsWith('| `data-viz` |')) ?? '';
    assert.match(row, /`chart-spec`/);
    assert.match(row, /`chart-check`/);
  });
});
