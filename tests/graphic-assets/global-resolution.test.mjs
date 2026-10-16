// Dependency resolution: cwd (and parents) -> NODE_PATH -> global npm root -> next to the script.
// Every case sets UX_STUDIO_GLOBAL_NODE_MODULES so the real global npm root is never consulted.
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { HERE, asset, fixture, outputDir, run } from './helpers.mjs';

const script = asset('export.mjs');

function runIn(cwd, globalRoot) {
  const env = { ...process.env, HOME: cwd, PATH: cwd, UX_STUDIO_GLOBAL_NODE_MODULES: globalRoot, CHROME_PATH: path.join(cwd, 'no-browser') };
  delete env.NODE_PATH;
  return run(script, ['--input', fixture('badge.svg'), '--out', path.join(cwd, 'out'), '--size', '24x24'], { cwd, env });
}

test('export.mjs: playwright-core resolves from the global root when the cwd has none', async () => {
  const cwd = outputDir('global-resolution-found');
  const res = await runIn(cwd, path.join(HERE, 'node_modules'));
  assert.doesNotMatch(res.stderr, /not installed/);
  assert.equal(res.status, 2, res.stderr); // got past dependency loading: the missing browser stops it
  assert.match(res.stderr, /No Chromium-family browser/);
});

test('export.mjs: a missing playwright-core exits 2 offering the workspace and the global install', async () => {
  const cwd = outputDir('global-resolution-missing');
  const res = await runIn(cwd, outputDir('global-resolution-empty-root'));
  assert.equal(res.status, 2);
  assert.match(res.stderr, /npm i -g playwright-core/);
  assert.match(res.stderr, /npm init -y && npm i -D playwright-core/);
});
