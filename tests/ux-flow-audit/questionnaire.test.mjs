import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { asset } from './helpers.mjs';

const schema = JSON.parse(readFileSync(asset('questionnaire.schema.json'), 'utf8'));
const example = JSON.parse(readFileSync(asset('questionnaire.example.json'), 'utf8'));

// strictTuples is an Ajv-only lint: the schema uses an open tuple on purpose
// (prefixItems pins the recommended option first, items covers the rest).
const ajv = new Ajv2020({ allErrors: true, strict: true, strictTuples: false });
addFormats(ajv);
const validate = ajv.compile(schema);
const clone = () => structuredClone(example);
const errors = () => ajv.errorsText(validate.errors, { separator: '\n' });

describe('questionnaire schema', () => {
  test('is JSON Schema draft 2020-12', () => {
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  });

  test('the example is valid', () => {
    assert.equal(validate(example), true, errors());
  });

  test('the example covers every finding type and an answered question', () => {
    const topics = new Set(example.questions.map((q) => q.topic));
    for (const t of ['frequency', 'redundancy', 'reachability', 'space', 'data-meaning', 'business-rule']) assert.ok(topics.has(t), t);
    assert.ok(example.questions.some((q) => q.answer.status === 'answered'));
  });

  test('rejects a recommended option that is not first', () => {
    const doc = clone();
    const q = doc.questions[0];
    q.options = [q.options[1], q.options[0], ...q.options.slice(2)];
    assert.equal(validate(doc), false);
  });

  test('rejects more than four options', () => {
    const doc = clone();
    const q = doc.questions[0];
    while (q.options.length < 5) q.options.push({ ...q.options[q.options.length - 1], id: `x${q.options.length}` });
    assert.equal(validate(doc), false);
  });

  test('rejects a question without the default applied when unanswered', () => {
    const doc = clone();
    delete doc.questions[0].defaultIfUnanswered;
    assert.equal(validate(doc), false);
  });

  test('rejects an answered question without the chosen option or text', () => {
    const doc = clone();
    doc.questions[0].answer = { status: 'answered', option: null, text: null };
    assert.equal(validate(doc), false);
  });

  test('rejects a chip header longer than 12 characters', () => {
    const doc = clone();
    doc.questions[0].header = 'Encabezado muy largo';
    assert.equal(validate(doc), false);
  });
});

describe('questionnaire schema: questions without a default', () => {
  const byTopic = (doc, topic) => doc.questions.find((q) => q.topic === topic);

  test('the example has a business-rule and a data-meaning question, neither with a default', () => {
    for (const topic of ['business-rule', 'data-meaning']) {
      const q = byTopic(example, topic);
      assert.ok(q, topic);
      assert.equal('defaultIfUnanswered' in q, false, `${topic} has no default`);
    }
  });

  test('business-rule and data-meaning questions are valid without a default', () => {
    for (const topic of ['business-rule', 'data-meaning']) {
      const doc = clone();
      const q = doc.questions[0];
      q.topic = topic;
      delete q.defaultIfUnanswered;
      for (const o of q.options) o.consequence = o.consequence.padEnd(90, '.');
      assert.equal(validate(doc), true, `${topic}: ${errors()}`);
    }
  });

  test('a business-rule or data-meaning answer is never "defaulted"', () => {
    for (const topic of ['business-rule', 'data-meaning']) {
      const doc = clone();
      const q = byTopic(doc, topic);
      q.answer = { status: 'defaulted', option: q.options[0].id, text: null };
      assert.equal(validate(doc), false, topic);
    }
  });
});

describe('questionnaire schema: business-rule consequences', () => {
  test('rejects a business-rule option whose consequence is a one-liner', () => {
    const doc = clone();
    const q = doc.questions.find((x) => x.topic === 'business-rule');
    q.options[1].consequence = 'Es lo más rápido.';
    assert.equal(validate(doc), false);
  });

  test('every business-rule consequence in the example names cost, risk and who is affected', () => {
    const q = example.questions.find((x) => x.topic === 'business-rule');
    for (const o of q.options) {
      assert.match(o.consequence, /Costo:/, o.id);
      assert.match(o.consequence, /Riesgo:/, o.id);
      assert.match(o.consequence, /Afecta a/, o.id);
    }
  });
});

describe('questionnaire schema: every phase writes and re-runs its own artifacts', () => {
  const phases = {
    'design-system-builder': { updates: ['design-system', 'brand-audit', 'design-decisions', 'BRIEF.md'], rerun: ['extract-styles', 'tokens-check'] },
    'prototype-showcase': { updates: ['prototype', 'design-decisions', 'BRIEF.md'], rerun: ['showcase-check'] },
    'implementation-fidelity': { updates: ['decisions-log', 'fidelity-config', 'design-system', 'report'], rerun: ['capture-states', 'compare'] },
    'prototype-to-video': { updates: ['storyboard', 'BRIEF.md'], rerun: ['capture-flows'] },
  };
  for (const [phase, { updates, rerun }] of Object.entries(phases)) {
    test(`accepts the ${phase} targets and checks`, () => {
      const doc = clone();
      doc.questions[0].updates = updates.map((target) => ({ target }));
      doc.questions[0].rerun = rerun;
      assert.equal(validate(doc), true, errors());
    });
  }
});

describe('questionnaire schema: multiple choice', () => {
  const multi = () => {
    const doc = clone();
    const q = doc.questions[0];
    q.multiSelect = true;
    q.options[1].label = q.options[1].label.replace(/$/, ' (Recomendado)');
    return doc;
  };

  test('a multiSelect question may recommend several options, all first', () => {
    assert.equal(validate(multi()), true, errors());
  });

  test('rejects a recommended option after a non-recommended one', () => {
    const doc = multi();
    const q = doc.questions[0];
    q.options = [q.options[0], q.options[2], q.options[1]];
    assert.equal(validate(doc), false);
  });

  test('a single-select question still has exactly one recommended option', () => {
    const doc = multi();
    delete doc.questions[0].multiSelect;
    assert.equal(validate(doc), false);
  });

  test('an option can be marked exclusive (cannot be combined)', () => {
    const doc = multi();
    doc.questions[0].options[2].exclusive = true;
    assert.equal(validate(doc), true, errors());
  });

  test('a multiSelect default and a defaulted answer can hold several options', () => {
    const doc = multi();
    const q = doc.questions[0];
    const ids = q.options.slice(0, 2).map((o) => o.id);
    q.defaultIfUnanswered.option = ids;
    q.answer = { status: 'defaulted', option: ids, text: null };
    assert.equal(validate(doc), true, errors());
  });

  test('a single-select question never takes several options', () => {
    const doc = clone();
    const q = doc.questions[0];
    q.defaultIfUnanswered.option = q.options.slice(0, 2).map((o) => o.id);
    assert.equal(validate(doc), false, 'array default on single-select');
    const doc2 = clone();
    doc2.questions[0].answer = { status: 'answered', option: doc2.questions[0].options.slice(0, 2).map((o) => o.id), text: null };
    assert.equal(validate(doc2), false, 'array answer on single-select');
  });
});

describe('questionnaire schema: accessibility topic', () => {
  test('accepts the accessibility topic and its a11y-audit rerun check', () => {
    const doc = clone();
    const q = doc.questions.find((x) => x.topic === 'heuristic') ?? doc.questions[0];
    q.topic = 'accessibility';
    q.rerun = ['a11y-audit'];
    assert.equal(validate(doc), true, errors());
  });
});
