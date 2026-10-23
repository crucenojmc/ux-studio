import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../plugins/ux-studio');
const agent = (name) => readFileSync(path.join(ROOT, 'agents', `${name}.md`), 'utf8');
const words = (text) => text.split(/\s+/).filter(Boolean).length;
const description = (text) => text.match(/^description: "(.*)"$/m)?.[1] ?? '';
const section = (text, name) => {
  const at = text.search(new RegExp(`^## ${name}`, 'm'));
  if (at < 0) return '';
  const end = text.indexOf('\n## ', at + 1);
  return text.slice(at, end < 0 ? undefined : end);
};
// Skills being written in parallel; they exist after integration.
const NEW_SKILLS = ['graphic-assets', 'ux-research', 'ux-content', 'implement-ui'];
const OWNED = ['ux-designer', 'ux-analyst', 'video-producer'];
const WORD_BUDGET = 700;

describe('agents stay short and load skills lazily', () => {
  for (const name of OWNED) {
    test(`${name} is at most ${WORD_BUDGET} words`, () => {
      const n = words(agent(name));
      assert.ok(n <= WORD_BUDGET, `${name}: ${n} words`);
    });

    test(`${name} lists its skills one line each, every one a real or an integrating skill`, () => {
      const skills = section(agent(name), 'Skills');
      assert.ok(skills, 'has a "Skills" section');
      const rows = skills.split('\n').filter((l) => /^\| `[a-z-]+` \|/.test(l));
      assert.ok(rows.length >= 1);
      for (const row of rows) {
        const skill = row.match(/^\| `([a-z-]+)`/)[1];
        assert.ok(existsSync(path.join(ROOT, 'skills', skill, 'SKILL.md')) || NEW_SKILLS.includes(skill), skill);
        assert.equal(row.split('|').length, 4, `${skill}: one "when" cell`);
      }
      assert.match(skills, /SKILL\.md only when the task needs/);
    });

    test(`${name} reads references, templates and scripts only on demand, never whole`, () => {
      const text = agent(name);
      assert.match(text, /only on demand/i);
      assert.match(text, /never Read them|never read them whole/i);
    });
  }
});

describe('agents take the task envelope and are parallel-safe', () => {
  for (const name of OWNED) {
    test(`${name} summarizes the envelope and works with BRIEF.md optional`, () => {
      const text = agent(name);
      assert.match(text, /task-envelope\.md/);
      for (const field of ['objective', 'type', 'skills', 'inputs', 'design scope', 'language', 'constraints', 'output dir', 'return budget']) {
        assert.ok(text.toLowerCase().includes(field), `${name} names ${field}`);
      }
      assert.match(text, /BRIEF\.md (path )?\(?optional/i);
      assert.match(text, /before any heavy reading/i);
    });

    test(`${name} never asks the user and returns closed questions`, () => {
      assert.match(agent(name), /[Nn]ever call `AskUserQuestion`/);
      assert.match(agent(name), /questionnaire\.schema\.json/);
    });

    test(`${name} writes only in its output dir and proposes changes to shared files`, () => {
      const text = agent(name);
      assert.match(text, new RegExp(`tmp/<topic>/${name}-<slug>/`));
      assert.match(text, /only inside the output dir/i);
      assert.match(text, /proposed-changes\.md/);
      assert.match(text, /BRIEF\.md/);
    });

    test(`${name} returns compactly within the return budget`, () => {
      const ret = section(agent(name), 'Return');
      assert.ok(ret, 'has a "Return" section');
      for (const part of [/summary/i, /artifact|paths/i, /questions/i, /return budget/i]) assert.match(ret, part);
    });

    test(`${name} uses an optional design skill only when present, under the plugin skill's output contract`, () => {
      const text = agent(name);
      if (!/^## Optional design skills/m.test(text)) return;
      const opt = section(text, 'Optional design skills');
      assert.match(opt, /only when it is listed/i);
      assert.match(opt, /defines the output contract/i);
    });
  }
});

describe('ux-designer is the generalist craft agent', () => {
  const text = agent('ux-designer');

  test('its description triggers on graphic, UX and design-system work', () => {
    const d = description(text).toLowerCase();
    for (const w of ['icons', 'illustrations', 'graphics', 'microcopy', 'research plans', 'personas', 'sitemaps',
      'wireframes', 'design systems', 'prototypes']) assert.ok(d.includes(w), w);
  });

  test('owns the five craft skills', () => {
    const skills = section(text, 'Skills');
    for (const s of ['design-system-builder', 'prototype-showcase', 'ux-content', 'ux-research', 'graphic-assets']) {
      assert.match(skills, new RegExp(`\\| \`${s}\` \\|`), s);
    }
  });

  test('never edits product code: implementation goes to ui-developer', () => {
    assert.match(description(text), /ui-developer/);
    assert.match(text, /[Nn]ever edit product code/);
    assert.match(section(text, 'Hard rules'), /ui-developer/);
  });

  test('routes the optional design skills that accelerate its work', () => {
    const opt = section(text, 'Optional design skills');
    for (const s of ['frontend-design', 'huashu-design', 'prototype', 'ui-ux-pro-max', 'emil-design-eng', 'apple-design',
      'animate', 'animation-vocabulary', 'mobile-native', 'web-design-guidelines', 'break-ui']) {
      assert.match(opt, new RegExp(`\`${s}\``), s);
    }
  });
});

describe('ux-analyst measures, including accessibility', () => {
  const text = agent('ux-analyst');

  test('its description and scope include the «Accesibilidad» variant of ux-flow-audit', () => {
    assert.match(description(text), /«Accesibilidad»/);
    assert.match(section(text, 'Skills'), /«Accesibilidad»/);
  });

  test('owns the measurement skills and never edits product code', () => {
    const skills = section(text, 'Skills');
    for (const s of ['ux-flow-audit', 'implementation-fidelity']) assert.match(skills, new RegExp(`\`${s}\``), s);
    assert.match(text, /[Nn]ever edit product code/);
  });

  test('routes the optional review skills', () => {
    const opt = section(text, 'Optional design skills');
    for (const s of ['web-design-guidelines', 'break-ui', 'review-animations', 'improve-animations']) {
      assert.match(opt, new RegExp(`\`${s}\``), s);
    }
  });
});

describe('video-producer keeps its scope', () => {
  const text = agent('video-producer');

  test('turns showcase flows into narrated, captioned videos with HyperFrames', () => {
    assert.match(description(text), /HyperFrames/);
    assert.match(section(text, 'Skills'), /`prototype-to-video`/);
  });

  test('keeps every approval gate before spending', () => {
    for (const gate of ['Storyboard', 'Voice', 'Draft', 'Spend or install']) assert.match(text, new RegExp(gate), gate);
  });
});

describe('every agent points to the shared Budget contract', () => {
  for (const name of [...OWNED, 'ui-developer']) {
    test(`${name} follows the envelope contract's Budget in one short line`, () => {
      const lines = agent(name).split('\n').filter((l) => /`## Budget`/.test(l));
      assert.equal(lines.length, 1, `${name}: exactly one pointer line`);
      assert.match(lines[0], /bounded runs/i);
      assert.match(lines[0], /images/i);
      assert.match(lines[0], /large files/i);
      assert.match(lines[0], /verify once/i);
      assert.ok(words(lines[0]) <= 16, `${name}: pointer is ${words(lines[0])} words`);
    });
  }
});

describe('ux-designer builds one direction and verifies once', () => {
  const rules = () => section(agent('ux-designer'), 'Hard rules');

  test('builds one direction; alternatives only when the brief asks (no 2–3 directions to explore)', () => {
    assert.match(rules(), /One direction; alternatives only when the brief asks/);
    assert.doesNotMatch(agent('ux-designer'), /Explore 2–3 quick directions/);
  });

  test('verifies once at the end: every declared frame, only the declared themes, zero console errors', () => {
    const r = rules();
    assert.match(r, /Verify once, at the end:/);
    assert.match(r, /every declared frame/);
    assert.match(r, /only the themes the brief or product declares/);
    assert.match(r, /zero console errors/);
    assert.doesNotMatch(r, /both themes/);
  });
});

describe('ux-analyst measures fidelity with the scripts and re-measures only what failed', () => {
  const rules = () => section(agent('ux-analyst'), 'Hard rules');

  test('measures with the skill scripts, never by hand in a browser', () => {
    assert.match(rules(), /Measure fidelity with the skill's scripts, never by hand in a browser\./);
  });

  test('fix rounds re-measure only the failing states; faithful needs a final numeric pass over all states', () => {
    const r = rules();
    assert.match(r, /Fix rounds re-measure only failing states \(`--only`\)\./);
    assert.match(r, /Never call an implementation faithful without a final numeric re-measurement of all states after the last fix\./);
    assert.match(r, /Device-only checks stay pending, never verified/);
  });
});
