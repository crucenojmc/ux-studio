// Dependency resolution: cwd (and parents) -> NODE_PATH -> global npm root -> next to the script.
// Every case sets UX_STUDIO_GLOBAL_NODE_MODULES so the real global npm root is never consulted.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const script = path.join(repo, 'plugins/ux-studio/skills/prototype-to-video/assets/capture-flows.mjs');
const suiteModules = path.join(here, 'node_modules');

function scratch(name) {
  const dir = path.join(repo, 'test-results', 'prototype-to-video', `global-resolution-${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

function runIn(cwd, globalRoot) {
  const env = { ...process.env, HOME: cwd, PATH: cwd, XDG_CACHE_HOME: cwd, UX_STUDIO_GLOBAL_NODE_MODULES: globalRoot };
  delete env.NODE_PATH;
  delete env.CHROME_PATH;
  return spawnSync(process.execPath, [script, '--url', 'http://127.0.0.1:9', '--out', path.join(cwd, 'out')], { cwd, env, encoding: 'utf8', timeout: 60_000 });
}

test('capture-flows: playwright-core resolves from the global root when the cwd has none', () => {
  const cwd = scratch('found');
  const res = runIn(cwd, suiteModules);
  assert.doesNotMatch(res.stderr, /playwright-core is not installed/);
  assert.equal(res.status, 3, res.stderr);
});

test('capture-flows: missing playwright-core exits 2 offering the workspace and the global install', () => {
  const cwd = scratch('missing');
  const res = runIn(cwd, scratch('empty-root'));
  assert.equal(res.status, 2);
  assert.match(res.stderr, /npm i -g playwright-core/);
  assert.match(res.stderr, /npm init -y && npm i -D playwright-core/);
});
