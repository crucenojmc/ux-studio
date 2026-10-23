# Main-thread browser gate (opt-in)

A user-level extra that keeps browser tool output out of the main thread. It is not part of the plugin's agents or hooks: nothing here loads on its own.

| File | What it is |
|---|---|
| `browser-qa.md` | A `sonnet` subagent with browser-only tools that returns a short verdict. |
| `main-thread-tool-gate.js` | A `PreToolUse` hook that denies browser tools called from the main thread and routes them to `browser-qa`. |
| `settings-snippet.json` | The `hooks.PreToolUse` entry that wires the hook into `~/.claude/settings.json`. |

## The need

The main thread's context is cumulative and runs on the session model. Every screenshot, accessibility snapshot or page dump a browser tool returns stays in that context and is re-sent each turn, at the price of the session model, until the session ends or is compacted. A subagent's context is discarded when it finishes: only its verdict returns to the parent.

Evidence from one measured installation: about 960 browser tool calls ran from the main thread in three weeks, and the main thread was the largest share of a period's token growth.

## What each file does to save tokens

- **`browser-qa`** runs on `sonnet` and has browser-only tools (Claude in Chrome, Chrome DevTools, Browser Use, plus read-only file tools and Bash for a Playwright fallback). It runs numeric or DOM checks before images, takes a screenshot only to confirm what a check flagged, saves screenshots to disk and returns their paths, reads images only downscaled to at most 1000 px wide, and returns a verdict under 30 lines (pass / fail / blocked first, then one line per finding). Screenshots and page dumps stay in its own context, which is discarded.
- **`main-thread-tool-gate.js`** denies the three browser tool families when the call has no `agent_type`, which means it comes from the main thread, and the denial message tells the model to delegate to `browser-qa`. Subagent calls carry an `agent_type`, so `ux-analyst` and `ux-designer` are unaffected, and so is any other subagent. `CLAUDE_HOOK_BYPASS` lets calls through for one invocation (below). It fails open: a parse or I/O error exits 0 with no output, so a broken gate never blocks work. Every decision is logged to `~/.claude/hooks/.main-thread-tool-gate.log` (rotated at 256 KB).
- **`settings-snippet.json`** is the matcher `mcp__claude-in-chrome__.*|mcp__plugin_chrome-devtools-mcp_chrome-devtools__.*|mcp__plugin_browser-use_browser-use__.*` plus the command `node "$HOME/.claude/hooks/main-thread-tool-gate.js"`. The hook only runs for those tools.

## Relation with the Budget contract

The `## Budget` section of `skills/presentation-brief/references/task-envelope.md` governs the ux-studio agents inside their own runs: bounded runs, no full-size screenshots, no whole reads of large files, verify once. The gate covers the case the contract cannot: browser tools called directly from the main thread, or from any flow that is not a ux-studio agent. `browser-qa` applies the same image rules as the contract (at most 1000 px wide, numeric or DOM checks first). Together, browser output stays out of the cumulative context.

## Install at user level

The files are in this folder in a clone of the repository (`plugins/ux-studio/extras/main-thread-browser-gate/`); an installed plugin includes the same folder under `~/.claude/plugins/` (`find ~/.claude/plugins -name main-thread-tool-gate.js` shows where).

1. From this folder, copy the agent and the hook:

   ```bash
   mkdir -p ~/.claude/agents ~/.claude/hooks
   cp browser-qa.md ~/.claude/agents/
   cp main-thread-tool-gate.js ~/.claude/hooks/
   ```

2. Add the entry of `settings-snippet.json` to the existing `hooks.PreToolUse` array of `~/.claude/settings.json`: merge, never replace. If the file has no `hooks.PreToolUse` yet, create it with the snippet's content. Keep a copy of the file first.

3. Validate that exactly one gate entry exists and the file is still valid JSON. It prints `true`:

   ```bash
   jq -e '[.hooks.PreToolUse[] | select((.hooks[]?.command // "") | contains("main-thread-tool-gate"))] | length == 1' ~/.claude/settings.json
   ```

4. Test the hook with a main-thread call (no `agent_type`). It prints `deny`:

   ```bash
   echo '{"tool_name":"mcp__claude-in-chrome__navigate","tool_input":{}}' | node ~/.claude/hooks/main-thread-tool-gate.js | jq -r .hookSpecificOutput.permissionDecision
   ```

5. Restart Claude Code: agents load at session start, so `browser-qa` is not available in a session that was already open.

## Disable, or bypass once

- **Disable:** remove that entry from `hooks.PreToolUse` in `~/.claude/settings.json`. The agent and the hook file can stay.
- **Bypass once:** start a session with the variable set: `CLAUDE_HOOK_BYPASS=browser claude`. Main-thread browser calls pass in that session only.

## Why it is opt-in and not a plugin hook

It changes the main thread of every session, including work that has nothing to do with ux-studio, so installing the plugin must not do it. A plugin agent would also be namespaced `ux-studio:browser-qa`, while the hook's denial message routes to `browser-qa`. As user-level files they stay under the user's control, and the cost of leaving them out is only the cost described above.
