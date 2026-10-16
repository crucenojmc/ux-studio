#!/usr/bin/env node
// Build .srt and .vtt caption sidecars from narration timings.
//
//   node srt-from-script.mjs <narration.json> [--out <basename>] [--words]
//        [--max-chars 42] [--max-lines 2] [--min-duration 1] [--max-duration 7]
//
// Input (default): [{ "text": "...", "start": 0.5, "end": 3.2 }, ...] in seconds,
// one item per narration sentence, in time order.
// Input (--words): a word-level transcript [{ "text": "Hola,", "start": 0, "end": 0.4 }, ...]
// such as the one `hyperframes transcribe` or a TTS provider writes; words are grouped
// into sentence-sized items first.
// Output: <basename>.srt and <basename>.vtt. Cues never exceed --max-lines lines of
// --max-chars characters nor --max-duration seconds; longer items are split into
// contiguous cues timed in proportion to their characters.

import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export const DEFAULTS = Object.freeze({
  maxChars: 42,
  maxLines: 2,
  minDuration: 1,
  maxDuration: 7,
  pauseBreak: 0.6,
});

const EPS = 1e-9;
const SENTENCE_END = /[.!?…]["'»”’)\]]*$/u;

const pad2 = (n) => String(n).padStart(2, '0');

export function formatTimestamp(seconds, sep = ',') {
  const totalMs = Math.round(seconds * 1000);
  const ms = totalMs % 1000;
  const totalS = Math.floor(totalMs / 1000);
  const s = totalS % 60;
  const m = Math.floor(totalS / 60) % 60;
  const h = Math.floor(totalS / 3600);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}${sep}${String(ms).padStart(3, '0')}`;
}

function splitWords(text, maxChars) {
  const out = [];
  for (const word of String(text).split(/\s+/u).filter(Boolean)) {
    // A single word longer than a line (URLs, codes) is cut so no line overflows.
    for (let i = 0; i < word.length; i += maxChars) out.push(word.slice(i, i + maxChars));
  }
  return out;
}

export function wrapText(text, maxChars = DEFAULTS.maxChars) {
  const lines = [];
  let line = '';
  for (const word of splitWords(text, maxChars)) {
    if (!line) line = word;
    else if (line.length + 1 + word.length <= maxChars) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Split words into n non-empty chunks whose character counts are as even as possible.
function balancedChunks(words, n) {
  const total = words.join(' ').length;
  const chunks = [];
  let wi = 0;
  let consumed = 0;
  for (let i = 0; i < n; i++) {
    const chunk = [];
    const target = (total * (i + 1)) / n;
    const chunksAfter = n - i - 1;
    while (wi < words.length) {
      const add = (consumed === 0 ? 0 : 1) + words[wi].length;
      if (chunk.length > 0 && i < n - 1) {
        if (words.length - wi <= chunksAfter) break;
        if (Math.abs(consumed + add - target) > Math.abs(consumed - target)) break;
      }
      chunk.push(words[wi]);
      consumed += add;
      wi++;
    }
    chunks.push(chunk);
  }
  return chunks;
}

function splitItem(item, opts) {
  const { maxChars, maxLines, maxDuration } = opts;
  const words = splitWords(item.text, maxChars);
  const duration = item.end - item.start;
  let n = Math.max(
    1,
    Math.ceil(duration / maxDuration - EPS),
    Math.ceil(wrapText(item.text, maxChars).length / maxLines),
  );
  for (; n <= words.length; n++) {
    const texts = balancedChunks(words, n).map((c) => c.join(' '));
    const wrapped = texts.map((t) => wrapText(t, maxChars));
    const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
    const durations = texts.map((t) => (duration * t.length) / totalChars);
    const fits = wrapped.every((l) => l.length <= maxLines) && durations.every((d) => d <= maxDuration + EPS);
    if (fits || n === words.length) {
      const cues = [];
      let t = item.start;
      wrapped.forEach((lines, i) => {
        const end = i === wrapped.length - 1 ? item.end : t + durations[i];
        cues.push({ start: t, end, lines });
        t = end;
      });
      return cues;
    }
  }
  return [];
}

function validate(items) {
  if (!Array.isArray(items)) throw new Error('Narration must be a JSON array of { text, start, end }.');
  let prevEnd = -Infinity;
  const clean = [];
  items.forEach((item, i) => {
    const where = `Narration item at index ${i}`;
    if (!item || typeof item !== 'object') throw new Error(`${where} is not an object.`);
    const { text, start, end } = item;
    if (typeof text !== 'string') throw new Error(`${where} has no text.`);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      throw new Error(`${where} needs numeric start and end in seconds.`);
    }
    if (start < 0 || end <= start) throw new Error(`${where} must satisfy 0 <= start < end (got ${start}..${end}).`);
    if (start < prevEnd - EPS) {
      throw new Error(`${where} overlaps the previous item (starts at ${start}s, previous ends at ${prevEnd}s).`);
    }
    prevEnd = end;
    if (text.trim()) clean.push({ text: text.trim(), start, end });
  });
  return clean;
}

export function buildCues(items, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const cues = validate(items).flatMap((item) => splitItem(item, opts));
  // Short cues stay on screen up to the minimum, never over the next cue.
  cues.forEach((cue, i) => {
    if (cue.end - cue.start >= opts.minDuration - EPS) return;
    const next = cues[i + 1] ? cues[i + 1].start : Infinity;
    cue.end = Math.max(cue.end, Math.min(cue.start + opts.minDuration, next));
  });
  return cues;
}

export function groupWords(words, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  if (!Array.isArray(words)) throw new Error('Transcript must be a JSON array of { text, start, end } words.');
  const items = [];
  let group = null;
  const close = () => {
    if (group) items.push({ text: group.words.join(' '), start: group.start, end: group.end });
    group = null;
  };
  words.forEach((w, i) => {
    const text = typeof w?.text === 'string' ? w.text.trim() : '';
    if (!text) return;
    if (!Number.isFinite(w.start) || !Number.isFinite(w.end) || w.end < w.start) {
      throw new Error(`Word at index ${i} needs numeric start <= end in seconds.`);
    }
    if (group) {
      const candidate = `${group.words.join(' ')} ${text}`;
      const tooLong = wrapText(candidate, opts.maxChars).length > opts.maxLines;
      const tooSlow = w.end - group.start > opts.maxDuration;
      const pause = w.start - group.end > opts.pauseBreak;
      if (tooLong || tooSlow || pause) close();
    }
    if (!group) group = { words: [], start: w.start, end: w.end };
    group.words.push(text);
    group.end = w.end;
    if (SENTENCE_END.test(text)) close();
  });
  close();
  return items;
}

export function toSrt(cues) {
  return cues
    .map((c, i) => `${i + 1}\n${formatTimestamp(c.start, ',')} --> ${formatTimestamp(c.end, ',')}\n${c.lines.join('\n')}\n`)
    .join('\n');
}

export function toVtt(cues) {
  const body = cues
    .map((c) => `${formatTimestamp(c.start, '.')} --> ${formatTimestamp(c.end, '.')}\n${c.lines.join('\n')}\n`)
    .join('\n');
  return `WEBVTT\n\n${body}`;
}

const USAGE = `Usage: node srt-from-script.mjs <narration.json> [--out <basename>] [--words]
       [--max-chars 42] [--max-lines 2] [--min-duration 1] [--max-duration 7]`;

function positiveNumber(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`--${name} must be a positive number.`);
  return n;
}

export function main(argv) {
  let args;
  try {
    args = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        out: { type: 'string' },
        words: { type: 'boolean', default: false },
        'max-chars': { type: 'string', default: String(DEFAULTS.maxChars) },
        'max-lines': { type: 'string', default: String(DEFAULTS.maxLines) },
        'min-duration': { type: 'string', default: String(DEFAULTS.minDuration) },
        'max-duration': { type: 'string', default: String(DEFAULTS.maxDuration) },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
  } catch (err) {
    console.error(`${err.message}\n${USAGE}`);
    return 1;
  }
  const { values, positionals } = args;
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  if (positionals.length !== 1) {
    console.error(USAGE);
    return 1;
  }
  try {
    const opts = {
      maxChars: positiveNumber(values['max-chars'], 'max-chars'),
      maxLines: positiveNumber(values['max-lines'], 'max-lines'),
      minDuration: positiveNumber(values['min-duration'], 'min-duration'),
      maxDuration: positiveNumber(values['max-duration'], 'max-duration'),
    };
    const input = path.resolve(positionals[0]);
    const data = JSON.parse(readFileSync(input, 'utf8'));
    const items = values.words ? groupWords(data, opts) : data;
    const cues = buildCues(items, opts);
    const base = path.resolve(values.out ?? input.replace(/\.json$/i, ''));
    mkdirSync(path.dirname(base), { recursive: true });
    writeFileSync(`${base}.srt`, toSrt(cues));
    writeFileSync(`${base}.vtt`, toVtt(cues));
    const short = cues.filter((c) => c.end - c.start < opts.minDuration - EPS).length;
    if (short) console.error(`Warning: ${short} cue(s) stay under ${opts.minDuration}s because the next cue starts first.`);
    console.log(`Wrote ${cues.length} cues -> ${base}.srt, ${base}.vtt`);
    return 0;
  } catch (err) {
    console.error(`Error: ${err.message}`);
    return 1;
  }
}

const isMain = (() => {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (isMain) process.exitCode = main(process.argv.slice(2));
