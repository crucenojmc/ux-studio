// Dependency resolution: cwd (and parents) -> NODE_PATH -> global npm root -> next to the script.
// Every case sets UX_STUDIO_GLOBAL_NODE_MODULES so the real global npm root is never consulted.
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { asset, HERE, REPO, run } from './helpers.mjs';

const SUITE_MODULES = path.join(HERE, 'node_modules');
const SCRIPTS = [
  ['nav-graph.mjs', ['--showcase', 'http://127.0.0.1:9']],
  ['space-audit.mjs', ['--url', 'http://127.0.0.1:9']],
];

function scratch(name) {
  const dir = path.join(REPO, 'test-results', 'ux-flow-audit', `global-resolution-${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

function envWith(globalRoot, home) {
  const env = { ...process.env, HOME: home, PATH: home, XDG_CACHE_HOME: home, UX_STUDIO_GLOBAL_NODE_MODULES: globalRoot };
  delete env.NODE_PATH;
  delete env.CHROME_PATH;
  delete env.PLAYWRIGHT_BROWSERS_PATH;
  return env;
}

for (const [script, args] of SCRIPTS) {
  test(`${script}: playwright-core resolves from the global root when the cwd has none`, async () => {
    const cwd = scratch(`${script}-found`);
    const res = await run(asset(script), args, { cwd, env: envWith(SUITE_MODULES, cwd) });
    assert.doesNotMatch(res.stderr, /playwright-core is not installed/);
    assert.match(res.stderr, /No Chromium-family browser found/);
    assert.equal(res.status, 2);
  });

  test(`${script}: missing playwright-core exits 2 offering the workspace and the global install`, async () => {
    const cwd = scratch(`${script}-missing`);
    const empty = scratch(`${script}-empty-root`);
    const res = await run(asset(script), args, { cwd, env: envWith(empty, cwd) });
    assert.equal(res.status, 2);
    assert.match(res.stderr, /playwright-core is not installed/);
    assert.match(res.stderr, /npm i -g playwright-core/);
    assert.match(res.stderr, /npm init -y && npm i -D playwright-core/);
  });
}
