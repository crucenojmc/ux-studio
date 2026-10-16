#!/usr/bin/env node
// Wrap a claude.ai artifact FRAGMENT in a minimal document for local preview and capture.
// Usage: node preview.mjs <fragment.html> <out.html> [--lang=es]
// The artifact host adds the document skeleton and its own base styles (white body,
// default margins). This script emulates both so a page that forgets to set its own
// body background or margins looks wrong here too, not only after publishing.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const [input, output, ...flags] = process.argv.slice(2);
if (!input || !output) {
  console.error('Usage: node preview.mjs <fragment.html> <out.html> [--lang=es]');
  process.exit(2);
}

let lang = 'es';
for (const flag of flags) {
  const m = /^--lang=([A-Za-z]{2,3}(?:-[A-Za-z0-9]+)*)$/.exec(flag);
  if (m) lang = m[1];
}

const fragment = await readFile(resolve(input), 'utf8');
if (/<!doctype|<html[\s>]|<head[\s>]|<body[\s>]/i.test(fragment)) {
  console.error(`${input} is a full document. Artifacts are published as a fragment: remove <!doctype>, <html>, <head> and <body>.`);
  process.exit(1);
}

// The fragment's own <title> and viewport <meta> move into <head>; the others are defaults.
const titleTag = fragment.match(/<title>[\s\S]*?<\/title>/i);
const viewportTag = fragment.match(/<meta\s+name="viewport"[^>]*>/i);
const title = titleTag ? titleTag[0] : '<title>Preview</title>';
const viewport = viewportTag ? viewportTag[0] : '<meta name="viewport" content="width=device-width,initial-scale=1">';
let body = fragment;
for (const tag of [titleTag, viewportTag]) if (tag) body = body.replace(tag[0], '');

const hostBaseStyles = `<style data-host-emulation>
html, body { margin: 0; padding: 0; }
body { background: #ffffff; color: #000000; font-family: system-ui, sans-serif; }
</style>`;

const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
${viewport}
${title}
${hostBaseStyles}
</head>
<body>
${body.trim()}
</body>
</html>
`;

await mkdir(dirname(resolve(output)), { recursive: true });
await writeFile(resolve(output), html, 'utf8');
console.log(`Wrote ${output}`);
