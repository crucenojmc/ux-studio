#!/usr/bin/env node
/*
 * Claude Code PreToolUse hook: keep browser tool families out of the main thread.
 *
 * Why: the main thread's context is cumulative and runs on the session model
 * (opus). Every browser screenshot, snapshot or page dump stays in the transcript
 * and is re-sent on every later turn. A subagent runs on sonnet and its context is
 * discarded when it finishes; only its summary reaches the parent. In one measured
 * installation, about 960 browser tool calls ran from the main thread in three
 * weeks, and the main thread was the largest share of the period's token growth.
 *
 * Detection: a subagent call carries `agent_type`; a main-thread call does not.
 *
 * Rules (each with its own enforce switch):
 *   browser    — mcp__claude-in-chrome__* in the main thread → delegate to `browser-qa`.
 *   devtools   — mcp__plugin_chrome-devtools-mcp_chrome-devtools__* → `browser-qa`.
 *   browseruse — mcp__plugin_browser-use_browser-use__* → `browser-qa`.
 *
 * Database access is not gated here: projects route it through their own
 * delegation hooks (mysql-explorer, mongo-explorer).
 *
 * Express authorization: CLAUDE_HOOK_BYPASS, set per invocation by the user,
 * lets a main-thread call through (same convention as the other hooks).
 *
 * Fails open: any parse or I/O error exits 0 with no stdout. A broken gate must
 * never block work.
 */
const fs = require('fs');
const path = require('path');

const CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR
  || path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude');
const LOG_FILE = path.join(CONFIG_DIR, 'hooks', '.main-thread-tool-gate.log');
const LOG_MAX_BYTES = 256 * 1024;

// While a rule is not enforced it only logs what it would have denied.
const ENFORCE = {
  browser: true,
  devtools: true,
  browseruse: true,
};

const ROUTE = [
  'ALLOWED ROUTE — delegate with the Agent tool, subagent_type "browser-qa": give it the URL, the',
  'steps, what to check (and the reference to compare against), and ask for a short verdict.',
  'If "browser-qa" is not available in this session (agents load at session start), use',
  '"general-purpose" with model "sonnet".',
  'Only the user can authorize a direct call, by setting CLAUDE_HOOK_BYPASS for that invocation.',
].join(' ');

const RULES = {
  browser: {
    match: (name) => name.startsWith('mcp__claude-in-chrome__'),
    reason: `Browser tools are not used from the main thread: every screenshot stays in its context at opus rates. ${ROUTE}`,
  },
  devtools: {
    match: (name) => name.startsWith('mcp__plugin_chrome-devtools-mcp_chrome-devtools__'),
    reason: `Chrome DevTools tools are not used from the main thread: snapshots, screenshots and traces stay in its context at opus rates. ${ROUTE}`,
  },
  browseruse: {
    match: (name) => name.startsWith('mcp__plugin_browser-use_browser-use__'),
    reason: `Browser Use tools are not used from the main thread: screenshots and page output stay in its context at opus rates. ${ROUTE}`,
  },
};

function log(entry) {
  try {
    try {
      if (fs.statSync(LOG_FILE).size > LOG_MAX_BYTES) fs.renameSync(LOG_FILE, LOG_FILE + '.1');
    } catch (_) { /* no log yet */ }
    fs.appendFileSync(LOG_FILE, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n');
  } catch (_) { /* logging never blocks */ }
}

function main() {
  let input;
  try {
    input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
  } catch (_) {
    return;
  }
  const toolName = typeof input.tool_name === 'string' ? input.tool_name : '';
  const ruleName = Object.keys(RULES).find((k) => RULES[k].match(toolName));
  if (!ruleName) return;

  const agentType = typeof input.agent_type === 'string' ? input.agent_type.trim() : '';
  const bypass = Boolean(process.env.CLAUDE_HOOK_BYPASS);
  const enforce = ENFORCE[ruleName];
  const verdict = agentType ? 'subagent' : bypass ? 'bypass' : 'main-thread';
  log({
    mode: enforce ? 'enforce' : 'dry-run',
    rule: ruleName,
    verdict,
    agent_type: input.agent_type ?? null,
    tool_name: toolName,
  });
  if (verdict !== 'main-thread' || !enforce) return;

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: RULES[ruleName].reason,
    },
  }));
}

try {
  main();
} catch (_) {
  // fail open
}
