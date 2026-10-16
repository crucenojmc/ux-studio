// --save-auth without a terminal: --wait-for / auth.readySelector, the timeout, and the TTY rule.
// Runs a headless browser (--headless) against a fixture that "logs in" by itself.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { startFixtureServer } from './fixture-server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const CAPTURE = path.join(ROOT, 'plugins/ux-studio/skills/implementation-fidelity/assets/capture-states.mjs');
const OUT = path.join(ROOT, 'test-results/implementation-fidelity/save-auth');

let fixture;

const run = (args) =>
  new Promise((resolve) => {
    // stdin is a pipe here: not a TTY, exactly like a run driven by an agent.
    execFile(process.execPath, [CAPTURE, ...args], { cwd: HERE, timeout: 60_000 }, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout, stderr });
    });
  });

function writeConfig(name, auth) {
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'fidelity.config.json');
  fs.writeFileSync(
    file,
    JSON.stringify({
      prototype: { url: `${fixture.base}/proto.html` },
      implementation: { url: `${fixture.base}/login.html`, auth: { method: 'storageState', storageState: 'state.json', ...auth } },
      states: [],
    })
  );
  return { dir, file, state: path.join(dir, 'state.json') };
}

before(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fixture = await startFixtureServer();
});
after(() => fixture?.server.close());

test('--wait-for saves the session once the selector is visible, with no stdin', async () => {
  const c = writeConfig('wait-for', {});
  const res = await run(['--config', c.file, '--save-auth', '--headless', '--wait-for', '#app-shell']);
  assert.equal(res.code, 0, res.stderr + res.stdout);
  const saved = JSON.parse(fs.readFileSync(c.state, 'utf8'));
  assert.ok(saved.cookies.some((k) => k.name === 'session' && k.value === 'abc123'), 'session cookie saved');
  assert.match(res.stdout, /Session saved/);
  assert.equal(fs.statSync(c.state).mode & 0o777, 0o600, 'session file is owner-only');
});

test('an existing session file is tightened to 0600 when it is overwritten', async () => {
  const c = writeConfig('existing', { readySelector: '#app-shell' });
  fs.writeFileSync(c.state, '{}', { mode: 0o644 });
  fs.chmodSync(c.state, 0o644);
  const res = await run(['--config', c.file, '--save-auth', '--headless']);
  assert.equal(res.code, 0, res.stderr + res.stdout);
  assert.equal(fs.statSync(c.state).mode & 0o777, 0o600);
});

test('auth.readySelector in the config does the same as --wait-for', async () => {
  const c = writeConfig('ready-selector', { readySelector: '#app-shell' });
  const res = await run(['--config', c.file, '--save-auth', '--headless']);
  assert.equal(res.code, 0, res.stderr + res.stdout);
  assert.ok(fs.existsSync(c.state));
});

test('without a terminal and without a selector it fails fast with a clear message', async () => {
  const c = writeConfig('no-tty', {});
  const res = await run(['--config', c.file, '--save-auth', '--headless']);
  assert.equal(res.code, 64);
  assert.match(res.stderr, /--wait-for/);
  assert.match(res.stderr, /readySelector/);
  assert.equal(fs.existsSync(c.state), false);
});

test('--timeout gives up when the selector never appears and writes nothing', async () => {
  const c = writeConfig('timeout', {});
  const res = await run(['--config', c.file, '--save-auth', '--headless', '--wait-for', '#never-there', '--timeout', '2']);
  assert.equal(res.code, 1);
  assert.match(res.stderr, /timed out after 2 s/i);
  assert.match(res.stderr, /#never-there/);
  assert.equal(fs.existsSync(c.state), false);
});

test('--timeout must be a positive number', async () => {
  const c = writeConfig('bad-timeout', {});
  const res = await run(['--config', c.file, '--save-auth', '--headless', '--wait-for', '#x', '--timeout', 'soon']);
  assert.equal(res.code, 64);
  assert.match(res.stderr, /--timeout/);
});
