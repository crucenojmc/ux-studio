// Structural checks for the ui-developer agent: frontmatter, consent, envelope, handoff, size.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.resolve(HERE, '../../plugins/ux-studio');
const AGENTS = path.join(PLUGIN, 'agents');
const text = readFileSync(path.join(AGENTS, 'ui-developer.md'), 'utf8');
const [, front, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];
const field = (src, name) => src.match(new RegExp(`^${name}: (.+)$`, 'm'))?.[1];

// Written in parallel by another writer; referenced by path, not shipped by this agent's change.
const EXTERNAL = new Set(['skills/presentation-brief/references/task-envelope.md']);

describe('ui-developer agent', () => {
  test('frontmatter: name, opus, high effort', () => {
    assert.ok(front, 'frontmatter block');
    assert.equal(field(front, 'name'), 'ui-developer');
    assert.equal(field(front, 'model'), 'opus');
    assert.equal(field(front, 'effort'), 'high');
  });

  test('has a color no other ux-studio agent uses', () => {
    const color = field(front, 'color');
    assert.ok(color, 'color');
    for (const file of readdirSync(AGENTS).filter((f) => f !== 'ui-developer.md')) {
      const other = readFileSync(path.join(AGENTS, file), 'utf8');
      assert.notEqual(field(other, 'color'), color, file);
    }
  });

  test('description is trigger text for frontend implementation work', () => {
    const desc = front.match(/^description: "(.*)"$/m)?.[1];
    assert.ok(desc, 'quoted one-line description');
    for (const re of [/prototype/i, /design system/i, /responsive/i, /accessibility/i, /motion/i, /tokens/i]) {
      assert.match(desc, re);
    }
    assert.match(desc, /ux-designer/);
    assert.match(desc, /ux-analyst/);
  });

  test('stays short: at most ~700 words', () => {
    const words = body.split(/\s+/).filter(Boolean).length;
    assert.ok(words <= 720, `${words} words`);
  });

  test('works from the task envelope; BRIEF.md is optional; never asks the user directly', () => {
    assert.match(body, /presentation-brief\/references\/task-envelope\.md/);
    assert.match(body, /BRIEF\.md[^.]*optional|optional[^.]*BRIEF\.md/i);
    assert.match(body, /never call `?AskUserQuestion`?/i);
  });

  test('returns the plan and stops until consent: granted', () => {
    assert.match(body, /consent: granted/);
    assert.match(body, /files/i);
    assert.match(body, /branch/i);
    assert.match(body, /never assume consent/i);
  });

  test('project conventions win and commits carry no AI attribution', () => {
    for (const re of [/CLAUDE\.md/, /AGENTS\.md/, /\.claude\/skills/, /no AI attribution/i, /never push/i]) {
      assert.match(body, re);
    }
  });

  test('hands off to ux-analyst / implementation-fidelity and never claims fidelity itself', () => {
    assert.match(body, /implementation-fidelity/);
    assert.match(body, /never (call|claim)[^.]*faithful/i);
  });

  test('guards production, dependencies, business rules and shared files', () => {
    for (const re of [/production/i, /dependenc/i, /business rules/i, /output dir/i, /shared files/i]) {
      assert.match(body, re);
    }
  });

  test('names the optional design skills without requiring them', () => {
    for (const name of ['frontend-design', 'emil-design-eng', 'animate', 'mobile-native', 'break-ui', 'web-design-guidelines']) {
      assert.match(body, new RegExp(`\\b${name}\\b`), name);
    }
    assert.match(body, /never require or install/i);
  });

  test('every ${CLAUDE_PLUGIN_ROOT} path resolves (except the shared envelope reference)', () => {
    const links = [...text.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([\w./-]+)/g)]
      .map((m) => m[1].replace(/[.,)]+$/, ''))
      .filter((rel) => !EXTERNAL.has(rel));
    assert.ok(links.length >= 3, `${links.length} links`);
    for (const rel of links) assert.ok(existsSync(path.join(PLUGIN, rel)), `missing ${rel}`);
    assert.match(text, /questionnaire\.schema\.json/);
  });
});
