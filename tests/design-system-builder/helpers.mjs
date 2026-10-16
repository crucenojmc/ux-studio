import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const testsDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(testsDir, '..', '..');
export const skillDir = path.join(repoRoot, 'plugins', 'ux-studio', 'skills', 'design-system-builder');
export const assetsDir = path.join(skillDir, 'assets');
export const tokensToCss = path.join(assetsDir, 'tokens-to-css.mjs');
export const extractStyles = path.join(assetsDir, 'extract-styles.mjs');
export const sampleTokens = path.join(assetsDir, 'tokens.sample.json');

/** Fresh output folder under the repo's git-ignored test-results/, never /tmp. */
export function outputDir(name) {
  const dir = path.join(repoRoot, 'test-results', 'design-system-builder', name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function runNode(script, args, options = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    timeout: 120_000,
    ...options,
  });
}

/** Like runNode, but keeps this process's event loop free (needed when the test serves HTTP). */
export function runNodeAsync(script, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], { timeout: 120_000, ...options });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}
