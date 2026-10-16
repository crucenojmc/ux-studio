// Shared helpers for the graphic-assets tests.
// Outputs go under the repo's git-ignored test-results/, never /tmp.
// Browsers are never downloaded: tests use an existing Chromium-family binary.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '../..');
export const SKILL = path.join(REPO, 'plugins/ux-studio/skills/graphic-assets');
export const ASSETS = path.join(SKILL, 'assets');
export const FIXTURES = path.join(HERE, 'fixtures');
export const asset = (name) => path.join(ASSETS, name);
export const fixture = (name) => path.join(FIXTURES, name);

/** Fresh output folder under test-results/graphic-assets/<name>. */
export function outputDir(name) {
  const dir = path.join(REPO, 'test-results', 'graphic-assets', name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** A throwaway git repository (under test-results/) whose .gitignore ignores tmp/. */
export function gitRepo(name) {
  const dir = outputDir(name);
  spawnSync('git', ['init', '-q', dir]);
  writeFileSync(path.join(dir, '.gitignore'), 'tmp/\n');
  return dir;
}

export function hasPlaywright() {
  try {
    createRequire(path.join(HERE, 'package.json')).resolve('playwright-core');
    return true;
  } catch {
    return false;
  }
}

/** Run a Node script and collect its exit status and output (async, so runs can overlap). */
export function run(script, args = [], { cwd = HERE, env = process.env, timeout = 180_000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], { cwd, env });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr });
    });
  });
}

export const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
export const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
