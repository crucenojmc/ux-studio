// The opt-in main-thread browser gate: a PreToolUse hook that keeps browser tool families out of the
// main thread and routes them to the browser-qa subagent. The hook is exercised through its own
// stdin/stdout contract; its log goes to a temp CLAUDE_CONFIG_DIR under this folder, never to the real one.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.resolve(HERE, '../../plugins/ux-studio');
const EXTRAS = path.join(PLUGIN, 'extras/main-thread-browser-gate');
const HOOK = path.join(EXTRAS, 'main-thread-tool-gate.js');
const FILES = ['README.md', 'browser-qa.md', 'main-thread-tool-gate.js', 'settings-snippet.json'];

let configDir;
const logFile = () => path.join(configDir, 'hooks', '.main-thread-tool-gate.log');
const logLines = () => (existsSync(logFile()) ? readFileSync(logFile(), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

before(() => {
  configDir = mkdtempSync(path.join(HERE, '.tmp-config-'));
  mkdirSync(path.join(configDir, 'hooks'));
});
after(() => rmSync(configDir, { recursive: true, force: true }));

function run(input, env = {}) {
  const e = { ...process.env, HOME: configDir, USERPROFILE: configDir, CLAUDE_CONFIG_DIR: configDir, ...env };
  if (!('CLAUDE_HOOK_BYPASS' in env)) delete e.CLAUDE_HOOK_BYPASS;
  const r = spawnSync(process.execPath, [HOOK], { input: typeof input === 'string' ? input : JSON.stringify(input), env: e, encoding: 'utf8' });
  return { code: r.status, out: r.stdout.trim() };
}
const denied = (r) => r.code === 0 && JSON.parse(r.out).hookSpecificOutput.permissionDecision === 'deny';
const allowed = (r) => r.code === 0 && r.out === '';

const FAMILIES = [
  ['Claude in Chrome', 'mcp__claude-in-chrome__', ['computer', 'navigate']],
  ['Chrome DevTools', 'mcp__plugin_chrome-devtools-mcp_chrome-devtools__', ['take_screenshot', 'take_snapshot']],
  ['Browser Use', 'mcp__plugin_browser-use_browser-use__', ['browser_screenshot']],
];

describe('the hook denies browser tools from the main thread and routes them to browser-qa', () => {
  test('ships in the extras folder', () => assert.ok(existsSync(HOOK)));

  for (const [family, prefix, tools] of FAMILIES) {
    for (const tool of tools) {
      const name = `${prefix}${tool}`;
      test(`${family}: a main-thread ${tool} is denied with the browser-qa route`, () => {
        const r = run({ tool_name: name, tool_input: {} });
        assert.ok(denied(r), r.out);
        assert.match(JSON.parse(r.out).hookSpecificOutput.permissionDecisionReason, /browser-qa/);
      });
      test(`${family}: a subagent ${tool} (any agent_type, ux-analyst and ux-designer included) is allowed`, () => {
        for (const agent_type of ['browser-qa', 'ux-analyst', 'ux-designer']) {
          assert.ok(allowed(run({ tool_name: name, tool_input: {}, agent_type })), agent_type);
        }
      });
    }
  }

  test('CLAUDE_HOOK_BYPASS lets a main-thread call through', () => {
    assert.ok(allowed(run({ tool_name: 'mcp__claude-in-chrome__computer', tool_input: {} }, { CLAUDE_HOOK_BYPASS: 'browser' })));
  });

  test('other tools pass, Bash included', () => {
    assert.ok(allowed(run({ tool_name: 'Read', tool_input: { file_path: '/x' } })));
    assert.ok(allowed(run({ tool_name: 'Bash', tool_input: { command: 'mysql -e "select 1"' } })));
  });

  test('malformed or empty input fails open', () => {
    assert.ok(allowed(run('not json')));
    assert.ok(allowed(run('')));
  });

  test('every decision lands in the log under CLAUDE_CONFIG_DIR/hooks, never in the real home', () => {
    const entries = logLines();
    const verdicts = new Set(entries.map((e) => e.verdict));
    for (const v of ['main-thread', 'subagent', 'bypass']) assert.ok(verdicts.has(v), `a ${v} entry`);
    assert.ok(entries.every((e) => e.mode === 'enforce' && typeof e.ts === 'string'));
    assert.ok(entries.some((e) => e.agent_type === 'ux-analyst'), 'the subagent type is logged');
    assert.ok(logFile().startsWith(HERE), 'the log is under the test folder');
  });
});

describe('settings-snippet.json', () => {
  const snippet = JSON.parse(readFileSync(path.join(EXTRAS, 'settings-snippet.json'), 'utf8'));
  const [entry] = snippet.hooks.PreToolUse;
  const matches = (tool) => new RegExp(`^(?:${entry.matcher})$`).test(tool);

  test('is exactly one PreToolUse entry running the shipped hook by its install name', () => {
    assert.equal(snippet.hooks.PreToolUse.length, 1);
    assert.equal(entry.hooks.length, 1);
    assert.equal(entry.hooks[0].type, 'command');
    assert.equal(entry.hooks[0].command, 'node "$HOME/.claude/hooks/main-thread-tool-gate.js"');
    assert.equal(path.basename(HOOK), 'main-thread-tool-gate.js');
  });

  test('its matcher covers the three browser families and nothing else', () => {
    for (const [family, prefix, tools] of FAMILIES) {
      for (const tool of [...tools, 'anything_else']) assert.ok(matches(`${prefix}${tool}`), `${family}: ${tool}`);
    }
    for (const other of ['Read', 'Bash', 'Agent', 'mcp__engram__mem_search', 'mcp__plugin_engram_engram__mem_save']) {
      assert.ok(!matches(other), other);
    }
  });
});

describe('browser-qa.md', () => {
  const text = readFileSync(path.join(EXTRAS, 'browser-qa.md'), 'utf8');
  const [, front, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];
  const tools = (front?.match(/^tools: (.+)$/m)?.[1] ?? '').split(',').map((t) => t.trim());

  test('is a sonnet subagent named browser-qa', () => {
    assert.match(front, /^name: browser-qa$/m);
    assert.match(front, /^model: sonnet$/m);
  });

  test('has browser-only tools: no edit, write or delegation tool', () => {
    assert.ok(tools.length > 10);
    for (const forbidden of ['Edit', 'Write', 'NotebookEdit', 'Agent', 'WebFetch']) assert.ok(!tools.includes(forbidden), forbidden);
    for (const prefix of FAMILIES.map(([, p]) => p)) assert.ok(tools.some((t) => t.startsWith(prefix)), prefix);
    assert.ok(tools.every((t) => /^(Read|Glob|Grep|Bash|Skill|ToolSearch|mcp__)/.test(t)), tools.join(', '));
  });

  test('keeps screenshots and dumps out of the parent: numeric checks first, paths not images, downscaled, short verdict', () => {
    const b = body.replace(/\s+/g, ' ');
    assert.match(b, /Screenshots and page dumps stay with you; only your report reaches the parent/);
    assert.match(b, /Prefer numeric and textual checks/);
    assert.match(b, /give their paths instead of describing pixels/);
    assert.match(b, /downscale to at most 1000 px wide/);
    assert.match(b, /Verdict first: pass \/ fail \/ blocked/);
    assert.match(b, /under ~30 lines/);
  });
});

describe('the extras are opt-in: never auto-loaded by the plugin', () => {
  test('ship only the four documented files', () => {
    assert.deepEqual(readdirSync(EXTRAS).sort(), [...FILES].sort());
  });

  test('live outside agents/ and hooks/, and the plugin declares no hook', () => {
    assert.ok(!existsSync(path.join(PLUGIN, 'agents/browser-qa.md')), 'not a plugin agent');
    assert.ok(!existsSync(path.join(PLUGIN, 'hooks')), 'no hooks/ folder');
    assert.ok(!existsSync(path.join(PLUGIN, '.claude-plugin/hooks.json')));
    const manifest = JSON.parse(readFileSync(path.join(PLUGIN, '.claude-plugin/plugin.json'), 'utf8'));
    assert.equal(manifest.hooks, undefined);
    assert.ok(!path.relative(PLUGIN, EXTRAS).split(path.sep).some((part) => part === 'agents' || part === 'hooks'));
  });

  test('carry no installation-specific text: no absolute user paths, no scratch directories', () => {
    for (const file of FILES) {
      const text = readFileSync(path.join(EXTRAS, file), 'utf8');
      assert.doesNotMatch(text, /\/home\/|\/Users\/|[A-Za-z]:\\Users\\|claude-1000/, file);
    }
    assert.doesNotMatch(readFileSync(HOOK, 'utf8'), /this installation/);
  });

  test('the hook header states its reasoning without a dated measurement', () => {
    const source = readFileSync(HOOK, 'utf8');
    const header = source.slice(0, source.indexOf('*/') + 2);
    assert.match(header, /^#!\/usr\/bin\/env node\n\/\*/);
    assert.match(header, /Why: the main thread's context is cumulative/);
    assert.doesNotMatch(header, /\b\d{4}-\d{2}-\d{2}\b/);
  });
});

describe('README.md', () => {
  const readme = readFileSync(path.join(EXTRAS, 'README.md'), 'utf8');
  const flat = readme.replace(/\s+/g, ' ');

  test('names every shipped file', () => {
    for (const file of FILES.filter((f) => f !== 'README.md')) assert.ok(readme.includes(file), file);
  });

  test('explains the need with anonymous evidence', () => {
    assert.match(flat, /context is cumulative/);
    assert.match(flat, /runs on the session model/);
    assert.match(flat, /re-sent (on )?each turn/);
    assert.match(flat, /discarded/);
    assert.match(flat, /Evidence from one measured installation:/);
  });

  test('explains what each file does to save tokens', () => {
    assert.match(flat, /sonnet/);
    assert.match(flat, /verdict under 30 lines/);
    assert.match(flat, /saves screenshots to disk and returns their paths/);
    assert.match(flat, /numeric or DOM checks before images/);
    assert.match(flat, /downscaled to at most 1000 px wide/);
    assert.match(flat, /no `agent_type`/);
    assert.match(flat, /`ux-analyst` and `ux-designer` are unaffected/);
    assert.match(flat, /fails open/);
    assert.ok(readme.includes('~/.claude/hooks/.main-thread-tool-gate.log'));
  });

  test('relates to the Budget contract of the ux-studio agents', () => {
    assert.match(readme, /## Budget/);
    assert.match(readme, /task-envelope\.md/);
  });

  test('gives the user-level install steps, the checks, how to disable and how to bypass once', () => {
    for (const needle of ['~/.claude/agents/', '~/.claude/hooks/', '~/.claude/settings.json', 'hooks.PreToolUse', 'merge, never replace',
      'jq -e', 'permissionDecision', 'CLAUDE_HOOK_BYPASS']) {
      assert.ok(flat.includes(needle), needle);
    }
    assert.match(flat, /restart Claude Code/i);
    assert.match(flat, /remove (that|the) entry/i);
  });

  test('its pipe-test command prints deny when run against the shipped hook', () => {
    const command = readme.match(/^\s*echo '(\{"tool_name":[^']+\})' \| node ~\/\.claude\/hooks\/main-thread-tool-gate\.js \| jq -r \.hookSpecificOutput\.permissionDecision$/m);
    assert.ok(command, 'a pipe-test line');
    assert.match(readme, /prints `deny`/);
    assert.ok(denied(run(command[1])));
  });

  test('explains why it is opt-in and not a plugin hook', () => {
    assert.match(flat, /opt-in/);
    assert.match(flat, /changes the main thread of every session/);
    assert.match(flat, /`ux-studio:browser-qa`/);
  });
});
