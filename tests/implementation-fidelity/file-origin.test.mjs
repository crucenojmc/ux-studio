// A prototype opened from file:// reads its own URL (cross-origin for Chromium) and the request fails:
// harmless, so it is not listed as a problem. Real failures (a missing asset) still are.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const CAPTURE = path.join(ROOT, 'plugins/ux-studio/skills/implementation-fidelity/assets/capture-states.mjs');
const OUT = path.join(ROOT, 'test-results/implementation-fidelity/file-origin');

test('file:// prototype: no problem for the blocked read of its own URL, still one for a missing image', async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(
    path.join(OUT, 'proto.html'),
    `<!doctype html><html><head><meta charset="utf-8"></head><body><h1 data-proto="title">hi</h1>
<img src="missing-asset.png" alt="">
<script src="missing-script.js"></script>
<script type="module" src="blocked-module.js"></script>
<script>fetch(location.href).catch(() => {}); const x = new XMLHttpRequest(); x.open('GET', location.href); x.send();</script></body></html>`
  );
  const file = path.join(OUT, 'fidelity.config.json');
  fs.writeFileSync(
    file,
    JSON.stringify({
      outDir: '.',
      prototype: { url: 'proto.html' },
      implementation: { url: 'http://127.0.0.1:1' },
      viewports: [{ id: 'web', width: 400, height: 300, capture: 'web' }],
      themes: ['light'],
      states: [{ id: 's', prototype: { hash: 'screen=x' } }],
    })
  );
  const res = await new Promise((resolve) =>
    execFile(process.execPath, [CAPTURE, '--config', file, '--side', 'prototype'], { cwd: HERE, timeout: 60_000 }, (error, stdout, stderr) =>
      resolve({ code: error ? error.code : 0, stdout, stderr })
    )
  );
  assert.equal(res.code, 0, res.stderr);
  const snap = JSON.parse(fs.readFileSync(path.join(OUT, 'captures/prototype/s__web__light.json'), 'utf8'));
  const problems = snap.meta.problems;
  assert.ok(problems.some((p) => p.includes('missing-asset.png')), `real failure kept: ${problems}`);
  assert.ok(problems.some((p) => p.includes('missing-script.js')), `missing script kept: ${problems}`);
  assert.ok(problems.some((p) => p.includes('blocked-module.js')), `blocked module script kept: ${problems}`);
  assert.ok(problems.every((p) => !p.includes('proto.html?capture=web')), `harmless failure dropped: ${problems}`);
});
