#!/usr/bin/env node
// Generate an icon set from a JSON spec: one optimized SVG per icon, a <symbol> sprite and a
// contact sheet. No npm dependencies.
//
// The spec (see icons.spec.example.json) declares the set's grid, padding (live area), stroke
// (width, caps, joins), corner radius and colour token, and each icon as a list of primitive
// shapes: path, line, rect, circle, polyline. Validation collects every error before writing:
// geometry outside the grid (curves and arcs are sampled), duplicate or non-kebab-case names,
// unknown shapes or keys, hardcoded colours and per-shape stroke overrides. Geometry outside the
// live area only warns.
//
// Output (in --out, or tmp/<topic>/graphics/ with --topic; must be git-ignored inside a git tree):
//   svg/<name>.svg   currentColor, viewBox from the grid, no width/height unless --size
//   icons.svg        sprite: one <symbol id="<prefix><name>"> per icon
//   preview.html     contact sheet at 1×, 2× and 4× with the grid, one panel per theme,
//                    styled with the inlined tokens.css (--tokens) or a neutral built-in set
//   manifest.json    every output with its source spec and the spec's SHA-256
//
// Exit codes: 0 ok, 1 invalid spec, 64 bad usage or arguments. --help prints the usage.
import fs from 'node:fs';
import path from 'node:path';
import {
  UsageError,
  ValidationError,
  assertKnownOptions,
  isMain,
  parseArgs,
  provenanceComment,
  requireValue,
  resolveOutDir,
  runCli,
  sha256File,
  sourceRecord,
  writeFileAtomic,
  writeManifest,
} from './lib/cli.mjs';

const TOOL = 'icon-set.mjs';
const SHAPES = {
  path: { required: ['d'], optional: ['fill'] },
  line: { required: ['x1', 'y1', 'x2', 'y2'], optional: [] },
  rect: { required: ['x', 'y', 'width', 'height'], optional: ['rx', 'fill'] },
  circle: { required: ['cx', 'cy', 'r'], optional: ['fill'] },
  polyline: { required: ['points'], optional: [] },
};
const TOP_KEYS = ['$schema', 'name', 'description', 'version', 'grid', 'padding', 'stroke', 'cornerRadius', 'colorToken', 'prefix', 'icons'];
const ICON_KEYS = ['name', 'title', 'keywords', 'shapes'];
const COLOUR_KEYS = ['stroke', 'color', 'colour', 'stopColor', 'stop-color', 'style', 'class'];
const STROKE_KEYS = ['strokeWidth', 'stroke-width', 'strokeLinecap', 'stroke-linecap', 'strokeLinejoin', 'stroke-linejoin', 'strokeDasharray', 'stroke-dasharray'];
const LINECAPS = ['round', 'butt', 'square'];
const LINEJOINS = ['round', 'miter', 'bevel'];
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const EPS = 1e-6;

/** Round to 3 decimals and print without trailing zeros. */
export const fmt = (n) => String(Math.round(n * 1000) / 1000 || 0);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/* ------------------------------------------------------------------ path geometry */

function sampleCubic(p0, p1, p2, p3, out) {
  for (let k = 1; k <= 16; k++) {
    const t = k / 16;
    const u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
}

function sampleQuad(p0, p1, p2, out) {
  for (let k = 1; k <= 16; k++) {
    const t = k / 16;
    const u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
  }
}

/** Points along an SVG elliptical arc (endpoint to centre parameterization, SVG 1.1 F.6.5). */
function sampleArc([x1, y1], rx, ry, rotation, large, sweep, [x2, y2], out) {
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  if (!rx || !ry || (x1 === x2 && y1 === y2)) return void out.push([x2, y2]);
  const phi = (rotation * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const xp = cos * dx + sin * dy;
  const yp = -sin * dx + cos * dy;
  const lambda = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
  const den = rx * rx * yp * yp + ry * ry * xp * xp;
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * yp) / ry;
  const cyp = (-coef * ry * xp) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const angle = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = angle(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
  let dt = angle((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  else if (sweep && dt < 0) dt += 2 * Math.PI;
  for (let k = 1; k <= 32; k++) {
    const t = t1 + (dt * k) / 32;
    const ex = rx * Math.cos(t);
    const ey = ry * Math.sin(t);
    out.push([cos * ex - sin * ey + cx, sin * ex + cos * ey + cy]);
  }
}

/** Every point a path visits (curves and arcs sampled). Throws on invalid path data. */
export function pathPoints(d) {
  const pts = [];
  const n = d.length;
  let i = 0;
  const skip = () => {
    while (i < n && /[\s,]/.test(d[i])) i++;
  };
  const num = () => {
    skip();
    const m = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(d.slice(i));
    if (!m) throw new Error(`expected a number at character ${i + 1}`);
    i += m[0].length;
    return Number(m[0]);
  };
  const flag = () => {
    skip();
    if (d[i] !== '0' && d[i] !== '1') throw new Error(`expected an arc flag (0 or 1) at character ${i + 1}`);
    return d[i++] === '1';
  };
  let cur = [0, 0];
  let start = [0, 0];
  let cmd = null;
  let lastC = null;
  let lastQ = null;
  for (skip(); i < n; skip()) {
    if (/[A-Za-z]/.test(d[i])) {
      cmd = d[i++];
      if (!'MmLlHhVvCcSsQqTtAaZz'.includes(cmd)) throw new Error(`unknown command "${cmd}"`);
      if (pts.length === 0 && cmd !== 'M' && cmd !== 'm') throw new Error('path data must start with M');
    } else if (cmd === null) throw new Error('path data must start with M');
    else if (cmd === 'Z' || cmd === 'z') throw new Error(`unexpected number after ${cmd} at character ${i + 1}`);
    const rel = cmd === cmd.toLowerCase();
    const pt = () => {
      const x = num();
      const y = num();
      return rel ? [cur[0] + x, cur[1] + y] : [x, y];
    };
    let nextC = null;
    let nextQ = null;
    switch (cmd.toUpperCase()) {
      case 'M':
        cur = pt();
        start = cur;
        pts.push(cur);
        cmd = rel ? 'l' : 'L'; // further pairs are implicit line-tos
        break;
      case 'L':
      case 'T': {
        const end = pt();
        if (cmd.toUpperCase() === 'T') {
          const c = lastQ ? [2 * cur[0] - lastQ[0], 2 * cur[1] - lastQ[1]] : cur;
          sampleQuad(cur, c, end, pts);
          nextQ = c;
        } else pts.push(end);
        cur = end;
        break;
      }
      case 'H':
        cur = [(rel ? cur[0] : 0) + num(), cur[1]];
        pts.push(cur);
        break;
      case 'V':
        cur = [cur[0], (rel ? cur[1] : 0) + num()];
        pts.push(cur);
        break;
      case 'C':
      case 'S': {
        const c1 = cmd.toUpperCase() === 'S' ? (lastC ? [2 * cur[0] - lastC[0], 2 * cur[1] - lastC[1]] : cur) : pt();
        const c2 = pt();
        const end = pt();
        sampleCubic(cur, c1, c2, end, pts);
        nextC = c2;
        cur = end;
        break;
      }
      case 'Q': {
        const c = pt();
        const end = pt();
        sampleQuad(cur, c, end, pts);
        nextQ = c;
        cur = end;
        break;
      }
      case 'A': {
        const rx = num();
        const ry = num();
        const rotation = num();
        const large = flag();
        const sweep = flag();
        const end = pt();
        sampleArc(cur, rx, ry, rotation, large, sweep, end, pts);
        cur = end;
        break;
      }
      case 'Z':
        cur = start;
        break;
    }
    lastC = nextC;
    lastQ = nextQ;
  }
  if (!pts.length) throw new Error('empty path data');
  return pts;
}

/* ------------------------------------------------------------------ validation */

const titleFromName = (name) => name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ');

/** The points of a validated shape that must stay inside the grid. */
function shapePoints(s) {
  switch (s.type) {
    case 'path':
      return pathPoints(s.d);
    case 'line':
      return [
        [s.x1, s.y1],
        [s.x2, s.y2],
      ];
    case 'rect':
      return [
        [s.x, s.y],
        [s.x + s.width, s.y + s.height],
      ];
    case 'circle':
      return [
        [s.cx - s.r, s.cy],
        [s.cx + s.r, s.cy],
        [s.cx, s.cy - s.r],
        [s.cx, s.cy + s.r],
      ];
    default:
      return s.points;
  }
}

function checkShape(shape, label, set, errors, warnings) {
  if (!shape || typeof shape !== 'object' || Array.isArray(shape)) return void errors.push(`${label} must be an object`);
  const def = SHAPES[shape.type];
  if (!def) return void errors.push(`${label} has an unknown shape type "${shape.type}" (use ${Object.keys(SHAPES).join(', ')})`);
  const where = `${label} (${shape.type})`;
  const before = errors.length;
  const fail = (msg) => errors.push(`${where} ${msg}`);
  const has = (key) => def.required.includes(key) && shape[key] !== undefined;
  for (const key of Object.keys(shape)) {
    if (key === 'type' || def.required.includes(key) || def.optional.includes(key)) continue;
    if (COLOUR_KEYS.includes(key)) fail(`has a hardcoded colour in "${key}": icons use currentColor and take their colour from colorToken`);
    else if (/^stroke-?width$/i.test(key)) fail(`sets "${key}": the stroke width is set once for the whole set (stroke.width)`);
    else if (STROKE_KEYS.includes(key)) fail(`sets "${key}": line caps, joins and dashes are set once for the whole set (stroke)`);
    else fail(`has an unknown key "${key}" (allowed: ${[...def.required, ...def.optional].join(', ')})`);
  }
  for (const key of def.required) if (shape[key] === undefined) fail(`is missing "${key}"`);
  if ('fill' in shape && typeof shape.fill !== 'boolean') fail('has a hardcoded colour in "fill": use "fill": true to fill with currentColor');
  for (const key of ['x1', 'y1', 'x2', 'y2', 'x', 'y', 'cx', 'cy']) if (has(key) && !isNum(shape[key])) fail(`"${key}" must be a number`);
  for (const key of ['width', 'height', 'r']) if (has(key) && !(isNum(shape[key]) && shape[key] > 0)) fail(`"${key}" must be a positive number`);
  if (shape.rx !== undefined && !(isNum(shape.rx) && shape.rx >= 0)) fail('"rx" must be a number ≥ 0');
  const pairs = (p) => Array.isArray(p) && p.length >= 2 && p.every((q) => Array.isArray(q) && q.length === 2 && q.every(isNum));
  if (has('points') && !pairs(shape.points)) fail('"points" must be a list of at least two [x, y] pairs');
  if (has('d') && typeof shape.d !== 'string') fail('"d" must be a string');
  if (errors.length > before) return;

  let pts;
  try {
    pts = shapePoints(shape);
  } catch (err) {
    return void errors.push(`${where} has invalid path data: ${err.message}`);
  }
  const g = set.grid;
  const outside = pts.find(([x, y]) => x < -EPS || y < -EPS || x > g + EPS || y > g + EPS);
  if (outside) return void errors.push(`${where} point (${fmt(outside[0])}, ${fmt(outside[1])}) is outside the ${g}×${g} grid`);
  const lo = set.padding;
  const hi = g - set.padding;
  const loose = pts.find(([x, y]) => x < lo - EPS || y < lo - EPS || x > hi + EPS || y > hi + EPS);
  if (loose) warnings.push(`${where} point (${fmt(loose[0])}, ${fmt(loose[1])}) is outside the live area (${fmt(lo)}–${fmt(hi)})`);
}

/** Validate a spec and apply its defaults. Returns { set, errors, warnings }; set is null on errors. */
export function validateSpec(raw) {
  const errors = [];
  const warnings = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { set: null, errors: ['the spec must be a JSON object'], warnings };
  for (const key of Object.keys(raw)) if (!TOP_KEYS.includes(key)) errors.push(`unknown spec key "${key}" (allowed: ${TOP_KEYS.slice(1).join(', ')})`);
  if (typeof raw.name !== 'string' || !raw.name.trim()) errors.push('"name" (the set name) is required');

  const grid = raw.grid ?? 24;
  if (!(Number.isInteger(grid) && grid > 0 && grid <= 1024)) errors.push('"grid" must be a whole number of pixels between 1 and 1024');
  const unit = Number.isInteger(grid) && grid > 0 ? grid / 12 : 2;
  const padding = raw.padding ?? unit;
  if (!(isNum(padding) && padding >= 0 && padding < grid / 2)) errors.push('"padding" must be a number ≥ 0 and under half the grid');

  const stroke = raw.stroke ?? {};
  if (typeof stroke !== 'object' || Array.isArray(stroke)) errors.push('"stroke" must be an object { width, linecap, linejoin }');
  for (const key of Object.keys(stroke)) if (!['width', 'linecap', 'linejoin'].includes(key)) errors.push(`unknown stroke key "${key}" (allowed: width, linecap, linejoin)`);
  const width = stroke.width ?? unit;
  if (!(isNum(width) && width > 0 && width <= grid / 4)) errors.push('"stroke.width" must be a positive number up to a quarter of the grid');
  const linecap = stroke.linecap ?? 'round';
  if (!LINECAPS.includes(linecap)) errors.push(`"stroke.linecap" must be ${LINECAPS.join(', ')}`);
  const linejoin = stroke.linejoin ?? 'round';
  if (!LINEJOINS.includes(linejoin)) errors.push(`"stroke.linejoin" must be ${LINEJOINS.join(', ')}`);

  const cornerRadius = raw.cornerRadius ?? unit;
  if (!(isNum(cornerRadius) && cornerRadius >= 0)) errors.push('"cornerRadius" must be a number ≥ 0');
  const colorToken = String(raw.colorToken ?? 'text-primary').replace(/^--/, '');
  if (!TOKEN.test(colorToken)) errors.push(`"colorToken" must be a design-system token name such as text-primary (got "${raw.colorToken}")`);
  const prefix = raw.prefix ?? 'icon-';
  if (typeof prefix !== 'string' || !/^(?:[a-z][a-z0-9-]*)?$/.test(prefix)) errors.push('"prefix" must be empty or start with a-z and hold only a-z, 0-9 and hyphens');

  const set = { name: raw.name, description: raw.description, grid, padding, stroke: { width, linecap, linejoin }, cornerRadius, colorToken, prefix, icons: [] };
  if (!Array.isArray(raw.icons) || !raw.icons.length) errors.push('"icons" must be a non-empty list');
  if (errors.length) return { set: null, errors, warnings };

  const seen = new Map();
  raw.icons.forEach((icon, idx) => {
    const n = idx + 1;
    if (!icon || typeof icon !== 'object' || Array.isArray(icon)) return void errors.push(`icon ${n} must be an object`);
    const label = `icon "${icon.name ?? n}"`;
    if (typeof icon.name !== 'string' || !KEBAB.test(icon.name)) errors.push(`icon name "${icon.name}" must be kebab-case (a-z, 0-9 and single hyphens)`);
    else if (seen.has(icon.name)) errors.push(`duplicate icon name "${icon.name}" (icons ${seen.get(icon.name)} and ${n})`);
    else seen.set(icon.name, n);
    for (const key of Object.keys(icon)) if (!ICON_KEYS.includes(key)) errors.push(`${label} has an unknown key "${key}" (allowed: ${ICON_KEYS.join(', ')})`);
    if (icon.title !== undefined && (typeof icon.title !== 'string' || !icon.title.trim())) errors.push(`${label} "title" must be a non-empty string`);
    if (icon.keywords !== undefined && !(Array.isArray(icon.keywords) && icon.keywords.every((k) => typeof k === 'string')))
      errors.push(`${label} "keywords" must be a list of strings`);
    if (!Array.isArray(icon.shapes) || !icon.shapes.length) return void errors.push(`${label} needs a non-empty "shapes" list`);
    icon.shapes.forEach((shape, s) => checkShape(shape, `${label}: shape ${s + 1}`, set, errors, warnings));
    set.icons.push({ name: icon.name, title: icon.title ?? titleFromName(String(icon.name)), keywords: icon.keywords ?? [], shapes: icon.shapes });
  });
  return errors.length ? { set: null, errors, warnings } : { set, errors, warnings };
}

/* ------------------------------------------------------------------ rendering */

function shapeMarkup(s, set) {
  const fill = s.fill ? ' fill="currentColor" stroke="none"' : '';
  switch (s.type) {
    case 'path':
      return `<path d="${s.d.trim().replace(/\s+/g, ' ')}"${fill}/>`;
    case 'line':
      return `<line x1="${fmt(s.x1)}" y1="${fmt(s.y1)}" x2="${fmt(s.x2)}" y2="${fmt(s.y2)}"/>`;
    case 'rect': {
      const rx = Math.min(s.rx ?? set.cornerRadius, s.width / 2, s.height / 2);
      return `<rect x="${fmt(s.x)}" y="${fmt(s.y)}" width="${fmt(s.width)}" height="${fmt(s.height)}"${rx > 0 ? ` rx="${fmt(rx)}"` : ''}${fill}/>`;
    }
    case 'circle':
      return `<circle cx="${fmt(s.cx)}" cy="${fmt(s.cy)}" r="${fmt(s.r)}"${fill}/>`;
    default:
      return `<polyline points="${s.points.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' ')}"/>`;
  }
}

const strokeAttrs = (set) =>
  `fill="none" stroke="currentColor" stroke-width="${fmt(set.stroke.width)}" stroke-linecap="${set.stroke.linecap}" stroke-linejoin="${set.stroke.linejoin}"`;
const viewBox = (set) => `viewBox="0 0 ${set.grid} ${set.grid}"`;
const body = (icon, set) => icon.shapes.map((s) => shapeMarkup(s, set)).join('');

/** One standalone icon SVG. */
export function iconSvg(icon, set, { size, comment = '' } = {}) {
  const dims = size ? ` width="${size}" height="${size}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg"${dims} ${viewBox(set)} ${strokeAttrs(set)}>${comment}${body(icon, set)}</svg>\n`;
}

const symbols = (set) => set.icons.map((icon) => `<symbol id="${set.prefix}${icon.name}" ${viewBox(set)} ${strokeAttrs(set)}>${body(icon, set)}</symbol>`).join('');

/** The sprite: one <symbol> per icon. */
export const spriteSvg = (set, comment = '') => `<svg xmlns="http://www.w3.org/2000/svg">${comment}${symbols(set)}</svg>\n`;

const NEUTRAL_TOKENS = `:root, [data-theme="light"] { color-scheme: light; --surface-page: #f6f6f7; --surface-raised: #ffffff; --text-primary: #1b1d22; --text-secondary: #5a606b; --border-subtle: #e2e3e7; --accent: #3b5bdb; --font-sans: system-ui, sans-serif; }
[data-theme="dark"] { color-scheme: dark; --surface-page: #16181d; --surface-raised: #1f2228; --text-primary: #eceef2; --text-secondary: #a7adb8; --border-subtle: #30343c; --accent: #91a7ff; }`;

/** tokens.css text with relative url() references rewritten for a file placed in outDir. */
function inlineTokens(tokensFile, outDir) {
  const dir = path.dirname(path.resolve(tokensFile));
  return fs
    .readFileSync(tokensFile, 'utf8')
    .replace(/url\(\s*(['"]?)(?![a-z][a-z0-9+.-]*:|\/|#)([^'")]+)\1\s*\)/gi, (_, q, ref) => {
      const rel = path.relative(outDir, path.resolve(dir, ref)).split(path.sep).join('/');
      return `url(${q}${rel}${q})`;
    })
    .replace(/<\/style/gi, '<\\/style');
}

/** Theme ids declared in a tokens stylesheet ([data-theme="…"]), in order of appearance. */
const themesOf = (css) => [...new Set([...css.matchAll(/\[data-theme="([\w-]+)"\]/g)].map((m) => m[1]))];

/** The contact sheet: every icon at 4× over the pixel grid, 2× and 1×, one panel per theme. */
export function previewHtml(set, { tokensCss, comment = '', source = '' } = {}) {
  const css = tokensCss ?? NEUTRAL_TOKENS;
  const themes = themesOf(css);
  const g = set.grid;
  const hidden = 'aria-hidden="true" focusable="false"';
  const live = `<rect class="live" x="${fmt(set.padding)}" y="${fmt(set.padding)}" width="${fmt(g - 2 * set.padding)}" height="${fmt(g - 2 * set.padding)}"/>`;
  const tile = (icon) => {
    const use = `<use href="#${set.prefix}${icon.name}"/>`;
    return (
      `<figure class="tile"><div class="sizes">` +
      `<svg class="big" ${viewBox(set)} ${hidden}>${live}${use}</svg>` +
      `<svg class="x2" ${viewBox(set)} ${hidden}>${use}</svg>` +
      `<svg class="x1" ${viewBox(set)} ${hidden}>${use}</svg>` +
      `</div><figcaption><code>${icon.name}</code><span>${esc(icon.title)}</span></figcaption></figure>`
    );
  };
  const panel = (theme) =>
    `<section class="panel"${theme ? ` data-theme="${theme}"` : ''}><h2>${theme ?? 'default'}</h2><div class="grid">${set.icons.map(tile).join('')}</div></section>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(set.name)} icons</title>
${comment}
<style>
${css}
body { margin: 0; font-family: var(--font-sans, system-ui, sans-serif); background: var(--surface-page); color: var(--text-primary); }
.panel { background: var(--surface-page); color: var(--text-primary); padding: 24px; }
h1, h2 { margin: 0 0 12px; font-size: 18px; } h2 { font-size: 14px; color: var(--text-secondary); text-transform: capitalize; }
header p { margin: 4px 0; color: var(--text-secondary); font-size: 13px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.tile { margin: 0; padding: 12px; border: 1px solid var(--border-subtle); border-radius: var(--radius-md, 8px); background: var(--surface-raised); }
.sizes { display: flex; align-items: flex-end; gap: 16px; color: var(--${set.colorToken}, var(--text-primary)); }
.big { width: ${g * 4}px; height: ${g * 4}px; background-image: linear-gradient(to right, var(--border-subtle) 1px, transparent 1px), linear-gradient(to bottom, var(--border-subtle) 1px, transparent 1px); background-size: 4px 4px; }
.big .live { fill: none; stroke: var(--accent); stroke-width: ${fmt(g / 192)}; stroke-dasharray: ${fmt(g / 48)}; }
.x2 { width: ${g * 2}px; height: ${g * 2}px; } .x1 { width: ${g}px; height: ${g}px; }
figcaption { display: flex; justify-content: space-between; gap: 8px; margin-top: 8px; font-size: 13px; }
figcaption span { color: var(--text-secondary); }
code { font-family: var(--font-mono, ui-monospace, monospace); }
</style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">${symbols(set)}</svg>
<header class="panel"><h1>${esc(set.name)}</h1>
<p>${set.icons.length} icons · ${g}×${g} grid, live area ${fmt(g - 2 * set.padding)} · stroke ${fmt(set.stroke.width)}, ${set.stroke.linecap} caps, ${set.stroke.linejoin} joins · corner radius ${fmt(set.cornerRadius)} · colour token --${set.colorToken}</p>
${set.description ? `<p>${esc(set.description)}</p>\n` : ''}<p>Source: ${esc(source)}. Shown at 4× over the pixel grid (dashed: live area), 2× and 1×.</p></header>
${(themes.length ? themes : [null]).map(panel).join('\n')}
</body>
</html>
`;
}

/* ------------------------------------------------------------------ CLI */

export const USAGE = `Usage:
  node icon-set.mjs --spec <icons.spec.json> (--out <dir> | --topic <name>) [--tokens <tokens.css>] [--size <px>]
  node icon-set.mjs --spec <icons.spec.json> --check
  node icon-set.mjs --help

Options:
  --spec <file>      the icon set spec (see icons.spec.example.json)
  --out <dir>        output folder; use a distinct one per parallel run. Inside a git work tree it
                     must be git-ignored (never a product repository)
  --topic <name>     instead of --out: tmp/<name>/graphics/ at the git root of the current folder
  --tokens <file>    design-system tokens.css, inlined into preview.html (default: neutral tokens)
  --size <px>        add width and height to each icon SVG (default: none, viewBox only)
  --check            validate the spec and print warnings; write nothing
  --debug            print the stack trace of errors
  -h, --help         this text

Writes svg/<name>.svg, icons.svg (sprite), preview.html and manifest.json.
Exit codes: 0 ok, 1 invalid spec, 64 bad usage or arguments.
`;

const OPTIONS = ['spec', 'out', 'topic', 'tokens', 'size', 'check', 'debug', 'help'];

function readSpec(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    throw new UsageError(`cannot read the spec ${file}: ${err.code === 'ENOENT' ? 'file not found' : err.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new UsageError(`the spec ${file} is not valid JSON: ${err.message}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2), new Set(['check', 'debug', 'help']));
  if (args.help) return void process.stdout.write(USAGE);
  assertKnownOptions(args, OPTIONS);
  const specFile = path.resolve(requireValue(args, 'spec', 'spec file'));
  const raw = readSpec(specFile);
  let size;
  if (args.size !== undefined) {
    size = Number(requireValue(args, 'size', 'size in px'));
    if (!(Number.isInteger(size) && size > 0)) throw new UsageError('--size must be a whole number of pixels');
  }
  let tokensCss;
  const out = args.check ? null : resolveOutDir(args);
  if (args.tokens !== undefined) {
    const tokensFile = requireValue(args, 'tokens', 'tokens.css file');
    if (!fs.existsSync(tokensFile)) throw new UsageError(`cannot read the tokens ${tokensFile}: file not found`);
    tokensCss = inlineTokens(tokensFile, out ?? path.dirname(specFile));
  }

  const { set, errors, warnings } = validateSpec(raw);
  if (set && tokensCss !== undefined && !new RegExp(`--${set.colorToken.replace(/\./g, '\\.')}\\s*:`).test(tokensCss))
    warnings.push(`the colour token --${set.colorToken} is not declared in ${args.tokens}; the preview falls back to --text-primary`);
  for (const w of warnings) process.stderr.write(`warning: ${w}\n`);
  if (errors.length) throw new ValidationError(errors);
  if (args.check) return void process.stdout.write(`${set.name}: ${set.icons.length} icons valid (${set.grid}×${set.grid} grid, stroke ${fmt(set.stroke.width)})\n`);

  const sha = sha256File(specFile);
  const record = { tool: TOOL, ...sourceRecord(specFile, out), generatedAt: new Date().toISOString() };
  const entries = [];
  for (const icon of set.icons) {
    const file = `svg/${icon.name}.svg`;
    writeFileAtomic(path.join(out, file), iconSvg(icon, set, { size, comment: provenanceComment(`${TOOL} ${icon.name}`, specFile, sha) }));
    entries.push({ file, kind: 'icon', item: icon.name, ...record });
  }
  writeFileAtomic(path.join(out, 'icons.svg'), spriteSvg(set, provenanceComment(TOOL, specFile, sha)));
  entries.push({ file: 'icons.svg', kind: 'sprite', ...record });
  const source = `${path.basename(specFile)} (sha256 ${sha.slice(0, 12)})`;
  writeFileAtomic(path.join(out, 'preview.html'), previewHtml(set, { tokensCss, comment: provenanceComment(TOOL, specFile, sha), source }));
  entries.push({ file: 'preview.html', kind: 'preview', ...record });

  for (const stale of writeManifest(out, entries, { replaceTool: TOOL })) {
    const p = path.resolve(out, stale.file);
    if (p.startsWith(out + path.sep)) fs.rmSync(p, { force: true });
  }
  process.stdout.write(`${set.name}: ${set.icons.length} icons → ${out} (svg/, icons.svg, preview.html, manifest.json)\n`);
}

if (isMain(import.meta.url)) runCli(TOOL, main);
