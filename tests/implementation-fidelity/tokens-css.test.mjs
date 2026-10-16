// config.tokensCss: the declared token values are resolved per theme and every element property that
// names a token is reported as the distance of each side from the token.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startFixtureServer } from './fixture-server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const ASSETS = path.join(ROOT, 'plugins/ux-studio/skills/implementation-fidelity/assets');
const OUT = path.join(ROOT, 'test-results/implementation-fidelity/tokens-css');

const { parseTokensCss, resolveTokens } = await import(pathToFileURL(path.join(ASSETS, 'tokens-css.mjs')).href);

// Shape of what tokens-to-css.mjs writes for a light/dark system, plus a comment, a font-face and an alias.
const CSS = `/* Demo — generated */
@font-face { font-family: "Demo"; src: url("data:font/woff2;base64,AAAA"); }
:root, [data-theme="light"] {
  --accent: #dc2626;
  --accent-hover: var(--accent);
  --surface: #ffffff;
}
[data-theme="dark"] {
  --accent: #f87171;
  --surface: #0f172a;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --accent: #fca5a5;
  }
}
:root {
  --space-2: 0.5rem;
  --text-sm: 0.875rem;
  --shadow-url: 0 1px 2px url(data:image/svg+xml;utf8,a;b);
}
`;

test('resolveTokens: base block, theme overrides, media dark, aliases and rem', () => {
  const rules = parseTokensCss(CSS);
  const light = resolveTokens(rules, 'light', ['light', 'dark']);
  assert.equal(light.get('--accent'), '#dc2626');
  assert.equal(light.get('--accent-hover'), '#dc2626', 'var() alias resolved');
  assert.equal(light.get('--surface'), '#ffffff');
  assert.equal(light.get('--text-sm'), '0.875rem');
  const dark = resolveTokens(rules, 'dark', ['light', 'dark']);
  assert.equal(dark.get('--accent'), '#fca5a5', 'the later dark block wins over the earlier one');
  assert.equal(dark.get('--accent-hover'), '#fca5a5', 'alias follows the dark value');
  assert.equal(dark.get('--surface'), '#0f172a');
  assert.equal(dark.get('--space-2'), '0.5rem', 'theme-less :root block applies to every theme');
  assert.ok(dark.get('--shadow-url').includes('url(data:image/svg+xml;utf8,a;b)'), 'semicolon inside url() kept');
  assert.equal(light.has('--font-family'), false);
});

let fixture;
const run = (script, args) =>
  new Promise((resolve) => {
    execFile(process.execPath, [path.join(ASSETS, script), ...args], { cwd: HERE, timeout: 120_000 }, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout, stderr });
    });
  });

before(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fixture = await startFixtureServer();
});
after(() => fixture?.server.close());

function writeConfig(name, extra = {}) {
  const dir = path.join(OUT, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'tokens.css'), `:root { --ink: #0f172a; --color-accent: #dc2626; --text-sm: 0.875rem; }`);
  const file = path.join(dir, 'fidelity.config.json');
  fs.writeFileSync(
    file,
    JSON.stringify({
      outDir: '.',
      frozenTime: '2026-01-15T12:00:00Z',
      tokensCss: 'tokens.css',
      prototype: { url: `${fixture.base}/proto.html` },
      implementation: { url: fixture.base },
      viewports: [{ id: 'web', width: 400, height: 300, capture: 'web' }],
      themes: ['light'],
      states: [
        {
          id: 'summary',
          prototype: { hash: 'screen=summary' },
          implementation: { path: '/impl-drift.html' },
          masks: { prototype: ['[data-proto=nonce]'], implementation: ['.nonce'] },
        },
      ],
      elements: {
        title: { prototype: '[data-proto=title]', implementation: '.page-title', properties: ['color', 'font-size'], tokens: { color: '--ink' } },
        cta: {
          prototype: '[data-proto=cta]',
          implementation: '.btn-primary',
          properties: ['background-color', 'font-size', 'border-top-left-radius'],
          tokens: { 'background-color': '--color-accent', 'font-size': '--text-sm', 'border-top-left-radius': '--radius-nope' },
        },
      },
      ...extra,
    })
  );
  return { dir, file };
}

test('the report shows how far each side is from the declared token', async () => {
  const { dir, file } = writeConfig('report');
  assert.equal((await run('capture-states.mjs', ['--config', file])).code, 0);
  const cmp = await run('compare.mjs', ['--config', file]);
  assert.equal(cmp.code, 0, cmp.stderr);
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'fidelity.json'), 'utf8'));

  const size = report.findings.find((f) => f.element === 'cta' && f.property === 'font-size');
  assert.equal(size.token, '--text-sm');
  assert.equal(size.tokenValue, '0.875rem');
  assert.deepEqual(
    { p: size.vsToken.prototype.delta, i: size.vsToken.implementation.delta, u: size.vsToken.implementation.unit },
    { p: 0, i: 2, u: 'px' },
    'prototype 14px = 0.875rem; implementation 16px is 2 px away'
  );
  assert.equal(size.vsToken.prototype.pass, true);
  assert.equal(size.vsToken.implementation.pass, false);
  assert.match(size.change, /--text-sm/);
  assert.match(size.change, /0\.875rem/);

  const color = report.findings.find((f) => f.element === 'title' && f.property === 'color');
  assert.equal(color.vsToken.prototype.unit, 'ΔE00');
  assert.equal(color.vsToken.prototype.delta, 0);
  assert.ok(color.vsToken.implementation.delta > 2);

  // Passing properties carry the distance too.
  const bg = report.measurements.find((m) => m.element === 'cta' && m.property === 'background-color');
  assert.equal(bg.tokenValue, '#dc2626');
  assert.ok(bg.vsToken.prototype.pass && bg.vsToken.implementation.pass);

  assert.ok(
    report.warnings.some((w) => w.includes('--radius-nope') && w.includes('tokens.css')),
    `undeclared token warned: ${report.warnings}`
  );
  const md = fs.readFileSync(path.join(dir, 'fidelity.md'), 'utf8');
  assert.match(md, /contra el token/);
});

test('a tokensCss file that does not exist is a usage error', async () => {
  const { file } = writeConfig('missing', { tokensCss: 'nope.css' });
  const res = await run('compare.mjs', ['--config', file]);
  assert.equal(res.code, 64);
  assert.match(res.stderr, /nope\.css/);
});
