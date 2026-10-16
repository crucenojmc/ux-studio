// Shared helpers for the ux-content tests. Outputs go under the repo's git-ignored test-results/, never /tmp.
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '../..');
export const SKILL = path.join(REPO, 'plugins/ux-studio/skills/ux-content');
export const FIXTURES = path.join(HERE, 'fixtures');
export const asset = (name) => path.join(SKILL, 'assets', name);

/** Fresh output folder under test-results/ux-content/<name>. */
export function outputDir(name) {
  const dir = path.join(REPO, 'test-results', 'ux-content', name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Run a Node script synchronously and collect its exit status and output. */
export function run(script, args = []) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: HERE, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
