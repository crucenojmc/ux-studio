// Tests for assets/preview.mjs: wraps an artifact fragment in a minimal host-like document.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { PREVIEW, TEMPLATE, OUT } from './helpers.mjs';

describe('preview.mjs', () => {
  it('wraps the template fragment in a document with a doctype', () => {
    mkdirSync(OUT, { recursive: true });
    const out = join(OUT, 'preview-wrap.html');
    execFileSync(process.execPath, [PREVIEW, TEMPLATE, out]);
    const html = readFileSync(out, 'utf8');
    assert.match(html, /^<!doctype html>/i);
    assert.match(html, /<html lang="es">/);
    assert.match(html, /<meta charset="utf-8">/);
    const head = html.slice(0, html.indexOf('<body>'));
    assert.match(head, /<title>[^<]+<\/title>/, 'title hoisted into <head>');
    const viewports = [...html.matchAll(/<meta name="viewport"[^>]*>/g)];
    assert.equal(viewports.length, 1, 'exactly one viewport meta');
    assert.match(head, /<meta name="viewport" content="width=device-width,\s*initial-scale=1">/, 'viewport meta in <head>');
    assert.match(html, /<body>[\s\S]*window\.SHOWCASE[\s\S]*<\/body>\s*<\/html>\s*$/);
  });

  it('honours --lang and refuses a full document', () => {
    const frag = join(OUT, 'mini-fragment.html');
    writeFileSync(frag, '<title>Mini page</title><p>Hola</p>');
    const out = join(OUT, 'mini-en.html');
    execFileSync(process.execPath, [PREVIEW, frag, out, '--lang=en']);
    assert.match(readFileSync(out, 'utf8'), /<html lang="en">/);

    const full = join(OUT, 'full-doc.html');
    writeFileSync(full, '<!doctype html><html><head></head><body></body></html>');
    const res = spawnSync(process.execPath, [PREVIEW, full, join(OUT, 'nope.html')], { encoding: 'utf8' });
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /fragment/i);
  });
});
