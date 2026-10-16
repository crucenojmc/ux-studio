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
const assets = path.join(repo, 'plugins/ux-studio/skills/implementation-fidelity/assets');
const suiteModules = path.join(here, 'node_modules');
const CASES = [
  ['capture-states.mjs', 'playwright-core', 'playwright-core'],
  ['compare.mjs', 'pixelmatch', 'pixelmatch pngjs'],
];

function scratch(name) {
  const dir = path.join(repo, 'test-results', 'implementation-fidelity', `global-resolution-${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

function runIn(script, cwd, globalRoot) {
  const env = { ...process.env, HOME: cwd, PATH: cwd, UX_STUDIO_GLOBAL_NODE_MODULES: globalRoot };
  delete env.NODE_PATH;
  return spawnSync(process.execPath, [path.join(assets, script), '--config', 'missing.config.json'], { cwd, env, encoding: 'utf8', timeout: 60_000 });
}

for (const [script, , pkgs] of CASES) {
  test(`${script}: dependencies resolve from the global root when the cwd has none`, () => {
    const cwd = scratch(`${script}-found`);
    const res = runIn(script, cwd, suiteModules);
    assert.doesNotMatch(res.stderr, /Missing dependency/);
    assert.equal(res.status, 64, res.stderr); // got past dependency loading: the missing config is a usage error
  });

  test(`${script}: missing dependencies exit 2 offering the workspace and the global install`, () => {
    const cwd = scratch(`${script}-missing`);
    const res = runIn(script, cwd, scratch(`${script}-empty-root`));
    assert.equal(res.status, 2);
    assert.match(res.stderr, new RegExp(`npm i -g ${pkgs}`));
    assert.match(res.stderr, new RegExp(`npm init -y && npm i -D ${pkgs}`));
  });
}
