// Steps in the implementation side act on the first VISIBLE match of a selector.
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
const OUT = path.join(ROOT, 'test-results/implementation-fidelity/steps');

let fixture;

const run = (args) =>
  new Promise((resolve) => {
    execFile(process.execPath, [CAPTURE, ...args], { cwd: HERE, timeout: 120_000 }, (error, stdout, stderr) => {
      resolve({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout, stderr });
    });
  });

before(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fixture = await startFixtureServer();
});
after(() => fixture?.server.close());

test('click, fill, hover, scroll and waitFor skip hidden duplicates and use the first visible one', async () => {
  const dir = path.join(OUT, 'visible');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'fidelity.config.json');
  fs.writeFileSync(
    file,
    JSON.stringify({
      outDir: '.',
      prototype: { url: `${fixture.base}/proto.html` },
      implementation: { url: fixture.base },
      viewports: [{ id: 'web', width: 400, height: 300, capture: 'web' }],
      themes: ['light'],
      states: [
        {
          id: 'dup',
          implementation: {
            path: '/impl-dup.html',
            steps: [
              { waitFor: '.dup-btn' },
              { fill: '.dup-input', value: 'typed' },
              { hover: '.dup-btn' },
              { click: '.dup-btn' },
              { scroll: '.dup-end' },
            ],
          },
        },
      ],
      elements: { result: { prototype: '[data-proto=title]', implementation: '#out', properties: ['color'] } },
    })
  );
  const res = await run(['--config', file, '--side', 'implementation']);
  assert.equal(res.code, 0, res.stderr + res.stdout);
  const snap = JSON.parse(fs.readFileSync(path.join(dir, 'captures/implementation/dup__web__light.json'), 'utf8'));
  assert.equal(snap.elements.result.values.color, 'rgb(0, 128, 0)', 'the visible button was clicked');
  assert.ok(snap.meta.scrollY > 0, 'the visible end marker was scrolled into view');
});
