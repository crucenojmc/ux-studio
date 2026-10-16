// Shared helpers for the ux-flow-audit tests.
// Outputs go under the repo's git-ignored test-results/, never /tmp.
// Browsers are never downloaded: tests use an existing Chromium-family binary.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '../..');
export const SKILL = path.join(REPO, 'plugins/ux-studio/skills/ux-flow-audit');
export const ASSETS = path.join(SKILL, 'assets');
export const FIXTURES = path.join(HERE, 'fixtures');
export const asset = (name) => path.join(ASSETS, name);

/** Fresh output folder under test-results/ux-flow-audit/<name>. */
export function outputDir(name) {
  const dir = path.join(REPO, 'test-results', 'ux-flow-audit', name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
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

/** Run a Node script and collect its exit status and output. */
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

/**
 * Serve a fixture folder over HTTP on 127.0.0.1. `/` maps to index.html and
 * `/a/b` to a/b.html. Every request is recorded as "METHOD /path" in `hits`.
 */
export function serve(dir) {
  const hits = new Map();
  const server = createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://x');
    const key = `${req.method} ${pathname}`;
    hits.set(key, (hits.get(key) ?? 0) + 1);
    let rel = decodeURIComponent(pathname).replace(/^\/+/, '');
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    let file = path.join(dir, rel);
    if (!path.extname(file)) file += '.html';
    if (req.method !== 'GET' || !file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        hits,
        count: (key) => hits.get(key) ?? 0,
        countMethod: (method) => [...hits.entries()].filter(([k]) => k.startsWith(`${method} `)).reduce((n, [, v]) => n + v, 0),
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

/** Environment with no reachable browser: empty HOME and PATH, no CHROME_PATH. */
export function noBrowserEnv() {
  const empty = outputDir('no-browser-home');
  const env = { ...process.env, HOME: empty, PATH: empty, XDG_CACHE_HOME: empty, PLAYWRIGHT_BROWSERS_PATH: empty };
  delete env.CHROME_PATH;
  return env;
}
