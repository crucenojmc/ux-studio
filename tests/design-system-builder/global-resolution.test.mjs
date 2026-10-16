// Dependency resolution: cwd (and parents) -> NODE_PATH -> global npm root -> next to the script.
// Every case sets UX_STUDIO_GLOBAL_NODE_MODULES so the real global npm root is never consulted.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { extractStyles, outputDir, runNode, testsDir } from './helpers.mjs';

const suiteModules = path.join(testsDir, 'node_modules');

function runIn(name, globalRoot) {
  const cwd = outputDir(`global-resolution-${name}`);
  const page = path.join(cwd, 'page.html');
  writeFileSync(page, '<!doctype html><title>x</title><p>x</p>');
  const env = { ...process.env, HOME: cwd, PATH: cwd, XDG_CACHE_HOME: cwd, UX_STUDIO_GLOBAL_NODE_MODULES: globalRoot };
  delete env.NODE_PATH;
  delete env.CHROME_PATH;
  return runNode(extractStyles, [page, '--out', path.join(cwd, 'out')], { cwd, env });
}

test('extract-styles: playwright-core resolves from the global root when the cwd has none', () => {
  const res = runIn('found', suiteModules);
  assert.doesNotMatch(res.stderr, /playwright-core is not installed/);
  assert.equal(res.status, 3, res.stderr);
});

test('extract-styles: missing playwright-core exits 2 offering the workspace and the global install', () => {
  const res = runIn('missing', outputDir('global-resolution-empty-root'));
  assert.equal(res.status, 2);
  assert.match(res.stderr, /npm i -g playwright-core/);
  assert.match(res.stderr, /npm init -y && npm i -D playwright-core/);
});
