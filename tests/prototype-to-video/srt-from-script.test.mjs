import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const script = path.join(repoRoot, 'plugins/ux-studio/skills/prototype-to-video/assets/srt-from-script.mjs');
const outRoot = path.join(repoRoot, 'test-results/prototype-to-video/srt');

const {
  formatTimestamp,
  wrapText,
  buildCues,
  groupWords,
  toSrt,
  toVtt,
} = await import(script);

const LONG =
  'La bandeja reúne los pedidos pendientes de cada sucursal y los ordena por urgencia, ' +
  'así el supervisor ve primero lo que vence hoy y puede aprobarlo sin abrir otra pantalla ni llamar a nadie.';

const words = (s) => s.split(/\s+/).filter(Boolean);
const cueText = (cues) => cues.flatMap((c) => c.lines).join(' ');

test('formatTimestamp uses HH:MM:SS,mmm for SRT and a dot for VTT', () => {
  assert.equal(formatTimestamp(0, ','), '00:00:00,000');
  assert.equal(formatTimestamp(3723.4567, ','), '01:02:03,457');
  assert.equal(formatTimestamp(61.5, '.'), '00:01:01.500');
  assert.equal(formatTimestamp(59.9996, ','), '00:01:00,000');
});

test('wrapText keeps every line within the limit and every word in order', () => {
  const lines = wrapText(LONG, 42);
  assert.ok(lines.length > 2);
  for (const line of lines) assert.ok(line.length <= 42, `line too long (${line.length}): ${line}`);
  assert.deepEqual(words(lines.join(' ')), words(LONG));
});

test('a short narration line becomes one cue with its own timing', () => {
  const cues = buildCues([{ text: 'Un toque y el pedido queda aprobado.', start: 2, end: 4.5 }]);
  assert.equal(cues.length, 1);
  assert.equal(cues[0].start, 2);
  assert.equal(cues[0].end, 4.5);
  assert.ok(cues[0].lines.length <= 2);
});

test('a long line is split into contiguous cues of at most 2 lines x 42 chars and 7 s', () => {
  const item = { text: LONG, start: 10, end: 22 };
  const cues = buildCues([item]);
  assert.ok(cues.length >= 3, `expected at least 3 cues, got ${cues.length}`);
  assert.equal(cues[0].start, 10);
  assert.equal(cues.at(-1).end, 22);
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i];
    assert.ok(c.lines.length >= 1 && c.lines.length <= 2, `cue ${i} has ${c.lines.length} lines`);
    for (const line of c.lines) assert.ok(line.length <= 42, `cue ${i} line too long: ${line}`);
    assert.ok(c.end - c.start <= 7 + 1e-9, `cue ${i} lasts ${c.end - c.start}s`);
    if (i > 0) assert.ok(Math.abs(c.start - cues[i - 1].end) < 1e-9, `cue ${i} is not contiguous`);
  }
  assert.deepEqual(words(cueText(cues)), words(LONG));
});

test('split timing is proportional to the characters of each cue', () => {
  const item = { text: LONG, start: 0, end: 12 };
  const cues = buildCues([item]);
  const totalChars = cues.reduce((n, c) => n + c.lines.join(' ').length, 0);
  for (const c of cues) {
    const expected = (12 * c.lines.join(' ').length) / totalChars;
    assert.ok(Math.abs(c.end - c.start - expected) < 0.05, `duration ${c.end - c.start} vs ${expected}`);
  }
});

test('a short text that lasts longer than 7 s is split by time', () => {
  const cues = buildCues([{ text: 'Ahora miremos el detalle con calma y sin apuro.', start: 0, end: 10 }]);
  assert.ok(cues.length >= 2);
  for (const c of cues) assert.ok(c.end - c.start <= 7 + 1e-9);
  assert.equal(cues.at(-1).end, 10);
});

test('a cue shorter than 1 s is extended up to the next cue, never over it', () => {
  const cues = buildCues([
    { text: 'Listo.', start: 0, end: 0.4 },
    { text: 'Sigamos.', start: 0.7, end: 2 },
    { text: 'Fin.', start: 5, end: 5.3 },
  ]);
  assert.equal(cues[0].end, 0.7);
  assert.equal(cues[2].end, 6);
});

test('invalid timings are rejected with the offending index', () => {
  assert.throws(() => buildCues([{ text: 'Hola', start: 3, end: 2 }]), /index 0/);
  assert.throws(
    () => buildCues([{ text: 'Uno', start: 0, end: 3 }, { text: 'Dos', start: 2, end: 4 }]),
    /index 1.*overlap/i,
  );
  assert.throws(() => buildCues([{ text: 'Hola', start: 'x', end: 2 }]), /index 0/);
});

test('groupWords turns word timings into sentence-sized narration items', () => {
  const ws = [
    { id: 'w0', text: 'La', start: 0.0, end: 0.2 },
    { id: 'w1', text: 'bandeja', start: 0.25, end: 0.7 },
    { id: 'w2', text: 'está', start: 0.75, end: 1.0 },
    { id: 'w3', text: 'lista.', start: 1.05, end: 1.5 },
    { id: 'w4', text: 'Aprobá', start: 2.0, end: 2.4 },
    { id: 'w5', text: 'el', start: 2.45, end: 2.55 },
    { id: 'w6', text: 'pedido.', start: 2.6, end: 3.1 },
  ];
  const items = groupWords(ws);
  assert.deepEqual(items, [
    { text: 'La bandeja está lista.', start: 0, end: 1.5 },
    { text: 'Aprobá el pedido.', start: 2, end: 3.1 },
  ]);
});

test('toSrt numbers cues and separates them with blank lines', () => {
  const srt = toSrt([
    { start: 0, end: 2.5, lines: ['Primera línea', 'segunda línea'] },
    { start: 2.5, end: 4, lines: ['Otra'] },
  ]);
  assert.equal(
    srt,
    '1\n00:00:00,000 --> 00:00:02,500\nPrimera línea\nsegunda línea\n\n' +
      '2\n00:00:02,500 --> 00:00:04,000\nOtra\n',
  );
});

test('toVtt starts with the WEBVTT header and uses dot milliseconds', () => {
  const vtt = toVtt([{ start: 1, end: 2.25, lines: ['Hola'] }]);
  assert.ok(vtt.startsWith('WEBVTT\n\n'));
  assert.match(vtt, /00:00:01\.000 --> 00:00:02\.250\nHola\n/);
  assert.doesNotMatch(vtt, /\d,\d{3}/);
});

test('CLI writes .srt and .vtt next to the requested basename', () => {
  rmSync(outRoot, { recursive: true, force: true });
  mkdirSync(outRoot, { recursive: true });
  const input = path.join(outRoot, 'narracion.json');
  writeFileSync(input, JSON.stringify([
    { text: 'La bandeja muestra los pedidos pendientes.', start: 0.5, end: 3 },
    { text: LONG, start: 3.2, end: 15 },
  ]));
  const base = path.join(outRoot, 'ejecutivo.es');
  const run = spawnSync(process.execPath, [script, input, '--out', base], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const srt = readFileSync(`${base}.srt`, 'utf8');
  const vtt = readFileSync(`${base}.vtt`, 'utf8');
  assert.match(srt, /^1\n00:00:00,500 --> 00:00:03,000\n/);
  assert.ok(vtt.startsWith('WEBVTT\n\n'));
  for (const line of srt.split('\n')) {
    if (/^\d+$/.test(line) || line.includes('-->') || line === '') continue;
    assert.ok(line.length <= 42, `SRT line too long: ${line}`);
  }
});

test('CLI --words groups a transcript before building cues', () => {
  mkdirSync(outRoot, { recursive: true });
  const input = path.join(outRoot, 'transcript.json');
  writeFileSync(input, JSON.stringify([
    { id: 'w0', text: 'Hola,', start: 0, end: 0.4 },
    { id: 'w1', text: 'equipo.', start: 0.45, end: 1.2 },
  ]));
  const base = path.join(outRoot, 'transcript');
  const run = spawnSync(process.execPath, [script, input, '--words', '--out', base], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(readFileSync(`${base}.srt`, 'utf8'), /00:00:00,000 --> 00:00:01,200\nHola, equipo\.\n/);
});

test('CLI exits 1 with a clear message on invalid input', () => {
  mkdirSync(outRoot, { recursive: true });
  const input = path.join(outRoot, 'mala.json');
  writeFileSync(input, JSON.stringify([{ text: 'Hola', start: 3, end: 1 }]));
  const run = spawnSync(process.execPath, [script, input], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /index 0/);
});
