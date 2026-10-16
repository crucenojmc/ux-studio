// Shared helpers for the data-viz tests. Outputs go under the repo's git-ignored test-results/, never /tmp.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '../..');
export const PLUGIN = path.join(REPO, 'plugins/ux-studio');
export const SKILL = path.join(PLUGIN, 'skills/data-viz');
export const FIXTURES = path.join(HERE, 'fixtures');
export const asset = (name) => path.join(SKILL, 'assets', name);
export const read = (...p) => readFileSync(path.join(...p), 'utf8');
export const readJson = (...p) => JSON.parse(read(...p));

/** Fresh output folder under test-results/data-viz/<name>. */
export function outputDir(name) {
  const dir = path.join(REPO, 'test-results', 'data-viz', name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Run a Node script synchronously and collect its exit status and output. */
export function run(script, args = []) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd: HERE, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** Set a dotted path ("card.alternatives.0.reason") on an object, creating objects on the way. */
export function setPath(obj, dotted, value) {
  const keys = dotted.split('.');
  let node = obj;
  for (const key of keys.slice(0, -1)) {
    if (node[key] == null || typeof node[key] !== 'object') node[key] = {};
    node = node[key];
  }
  node[keys.at(-1)] = value;
}

/** Remove a dotted path from an object. */
export function unsetPath(obj, dotted) {
  const keys = dotted.split('.');
  let node = obj;
  for (const key of keys.slice(0, -1)) node = node?.[key];
  if (node) delete node[keys.at(-1)];
}

/** The clean spec with a seeded case applied: `set` paths first, then `unset` paths. */
export function seeded(base, c) {
  const spec = structuredClone(base);
  for (const [p, v] of Object.entries(c.set ?? {})) setPath(spec, p, v);
  for (const p of c.unset ?? []) unsetPath(spec, p);
  return spec;
}
