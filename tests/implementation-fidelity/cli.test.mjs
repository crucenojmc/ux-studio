// Command line behaviour of capture-states.mjs and compare.mjs: help, usage errors, --debug.
// Every case runs where neither playwright-core nor pixelmatch resolves, unless it says otherwise.
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

function scratch(name) {
  const dir = path.join(repo, 'test-results', 'implementation-fidelity', `cli-${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

function run(script, args, { cwd, globalRoot }) {
  const env = { ...process.env, HOME: cwd, PATH: cwd, UX_STUDIO_GLOBAL_NODE_MODULES: globalRoot };
  delete env.NODE_PATH;
  return spawnSync(process.execPath, [path.join(assets, script), ...args], { cwd, env, encoding: 'utf8', timeout: 60_000 });
}

const noDeps = (name) => {
  const cwd = scratch(name);
  return { cwd, globalRoot: scratch(`${name}-empty-root`) };
};
const withDeps = (name) => ({ cwd: scratch(name), globalRoot: suiteModules });

for (const script of ['capture-states.mjs', 'compare.mjs']) {
  test(`${script} --help prints the usage and exits 0 before the dependency check`, () => {
    for (const flag of ['--help', '-h']) {
      const res = run(script, [flag], noDeps(`${script}-help`));
      assert.equal(res.status, 0, res.stderr);
      assert.match(res.stdout, /^Usage:/m);
      assert.match(res.stdout, /--config/);
      assert.equal(res.stderr, '');
    }
  });

  test(`${script} without --config: one-line error, usage hint, exit 64, no stack`, () => {
    const res = run(script, [], noDeps(`${script}-noconfig`));
    assert.equal(res.status, 64);
    const lines = res.stderr.trim().split('\n');
    assert.equal(lines.length, 2, res.stderr);
    assert.match(lines[0], /^error: .*--config/);
    assert.match(lines[1], /--help/);
    assert.doesNotMatch(res.stderr, /\n\s+at /);
  });

  test(`${script} with an unreadable config: exit 64, no stack unless --debug`, () => {
    const ctx = withDeps(`${script}-badconfig`);
    const plain = run(script, ['--config', 'missing.config.json'], ctx);
    assert.equal(plain.status, 64, plain.stderr);
    assert.match(plain.stderr, /^error: .*missing\.config\.json/);
    assert.doesNotMatch(plain.stderr, /\n\s+at /);
    const debug = run(script, ['--config', 'missing.config.json', '--debug'], ctx);
    assert.equal(debug.status, 64, debug.stderr);
    assert.match(debug.stderr, /\n\s+at /);
  });

  test(`${script} rejects an unknown option with exit 64`, () => {
    const res = run(script, ['--config', 'x.json', '--bogus'], noDeps(`${script}-unknown`));
    assert.equal(res.status, 64);
    assert.match(res.stderr, /^error: unknown option --bogus/);
  });
}

test('capture-states.mjs rejects a bad --side value with exit 64', () => {
  const ctx = withDeps('side');
  const config = path.join(ctx.cwd, 'fidelity.config.json');
  spawnSync(process.execPath, ['-e', `require('fs').writeFileSync(${JSON.stringify(config)}, '{"prototype":{"url":"p.html"},"implementation":{"url":"http://x"},"states":[{"id":"a"}]}')`]);
  const res = run('capture-states.mjs', ['--config', config, '--side', 'bogus'], ctx);
  assert.equal(res.status, 64, res.stderr);
  assert.match(res.stderr, /--side/);
});
