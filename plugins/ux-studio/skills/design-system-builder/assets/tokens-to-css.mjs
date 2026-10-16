#!/usr/bin/env node
/**
 * tokens-to-css.mjs — compile a Design System `tokens.json` into `tokens.css`, and check it
 * against the UX Studio token contract (references/tokens-contract.md).
 *
 *   node tokens-to-css.mjs <tokens.json> [--out tokens.css] [--motion motion.json] [--check] [--style-classes]
 *
 * --style-classes also emits one class per text style (`.body { font-family; font-size; … }`), the
 * way the Design System page compiles its own tokens.css, so component previews render locally.
 * Off by default: `.label` or `.title` would collide with class names in prototypes.
 *
 * Without --check: prints (or writes) the CSS; contract problems are reported as warnings and
 * invalid values are dropped, the way the Design System page drops them.
 * With --check: validates the contract and exits non-zero on any error; writes CSS only when
 * --out is given and the check passes.
 *
 * Exit codes: 0 ok · 1 invalid tokens or failed check · 2 usage or file error.
 * Pure Node >= 22, no dependencies.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const USAGE = 'usage: node tokens-to-css.mjs <tokens.json> [--out tokens.css] [--motion motion.json] [--check] [--style-classes]';

export const MOTION_DEFAULTS = Object.freeze({
  '--duration-fast': '120ms',
  '--duration-base': '200ms',
  '--duration-slow': '320ms',
  '--ease-out': 'cubic-bezier(.22,1,.36,1)',
  '--ease-in-out': 'cubic-bezier(.65,0,.35,1)',
  '--ease-sheet': 'cubic-bezier(.32,.72,0,1)',
});

export const REQUIRED = Object.freeze({
  color: [
    'surface-page', 'surface-raised', 'surface-overlay', 'surface-sunken',
    'text-primary', 'text-secondary', 'text-tertiary',
    'border-subtle', 'border-strong',
    'accent', 'accent-hover', 'on-accent', 'focus-ring',
    'status-ok', 'status-ok-bg', 'status-warn', 'status-warn-bg',
    'status-danger', 'status-danger-bg', 'status-info', 'status-info-bg',
    'series-1', 'series-2', 'series-3', 'series-4', 'series-5',
  ],
  spacing: ['space-1', 'space-2', 'space-3', 'space-4', 'space-5', 'space-6', 'space-7', 'space-8'],
  radius: ['radius-sm', 'radius-md', 'radius-lg', 'radius-pill'],
  families: ['sans'],
  styles: ['display', 'title', 'heading', 'body', 'label', 'caption'],
});

/** Pairs whose contrast fails the check (text on the page) or only warns (everything else). */
const CONTRAST_ERRORS = [
  ['text-primary', 'surface-page', 4.5],
  ['text-secondary', 'surface-page', 4.5],
];
const CONTRAST_WARNINGS = [
  ['text-primary', 'surface-raised', 4.5],
  ['text-secondary', 'surface-raised', 4.5],
  ['text-tertiary', 'surface-page', 3],
  ['on-accent', 'accent', 4.5],
  ['status-ok', 'status-ok-bg', 4.5],
  ['status-warn', 'status-warn-bg', 4.5],
  ['status-danger', 'status-danger-bg', 4.5],
  ['status-info', 'status-info-bg', 4.5],
  ['border-strong', 'surface-page', 3],
  ['focus-ring', 'surface-page', 3],
  ...[1, 2, 3, 4, 5].map((n) => [`series-${n}`, 'surface-page', 3]),
];

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const META_KEYS = new Set(['name', 'version', 'meta', 'description', '$schema']);
const LENGTH_RE = /^-?(\d+\.?\d*|\.\d+)(px|rem|em|%)?$/;
const HEX_RE = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC_RE = /^(rgba?|hsla?|oklab|oklch)\(([^()]*)\)$/i;
const ALIAS_RE = /^\{([A-Za-z0-9][A-Za-z0-9_.-]{0,63})\}$/;
const ALLOWED_COLORS = 'hex, rgb(), rgba(), hsl(), hsla(), oklab() or oklch()';
const UNSAFE_CSS_RE = /[;{}<>\\]/;

// ---------------------------------------------------------------------------------------------
// Color parsing and contrast
// ---------------------------------------------------------------------------------------------

const NUM_RE = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?(%|deg|rad|grad|turn)?$/i;

function numberOf(token, percentScale = 1) {
  if (token === 'none') return 0;
  if (!NUM_RE.test(token)) return Number.NaN;
  const n = Number.parseFloat(token);
  return token.endsWith('%') ? (n / 100) * percentScale : n;
}

function angleOf(token) {
  if (token === 'none') return 0;
  if (!NUM_RE.test(token) || token.endsWith('%')) return Number.NaN;
  const n = Number.parseFloat(token);
  if (/turn$/i.test(token)) return n * 360;
  if (/grad$/i.test(token)) return n * 0.9;
  if (/rad$/i.test(token)) return (n * 180) / Math.PI;
  return n;
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function oklabToSrgb(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => toGamma(clamp01(c)));
}

function hslToSrgb(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const k = (n) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map((n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
}

/**
 * Parses an allowed color literal into gamma-encoded sRGB channels 0..1 plus alpha.
 * Returns null when the literal is not one of the allowed forms.
 */
export function parseColor(raw) {
  const value = String(raw).trim();
  if (HEX_RE.test(value)) {
    let hex = value.slice(1);
    if (hex.length <= 4) hex = [...hex].map((c) => c + c).join('');
    const byte = (i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return { r: byte(0), g: byte(2), b: byte(4), a: hex.length === 8 ? byte(6) : 1 };
  }
  const match = FUNC_RE.exec(value);
  if (!match) return null;
  const fn = match[1].toLowerCase();
  const [channelsPart, alphaPart, extra] = match[2].split('/');
  if (extra !== undefined) return null;
  const parts = channelsPart.replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean);
  let alphaToken = alphaPart?.trim();
  if (parts.length === 4 && alphaToken === undefined && match[2].includes(',')) alphaToken = parts.pop();
  if (parts.length !== 3) return null;
  const alpha = alphaToken === undefined ? 1 : numberOf(alphaToken);
  let rgb;
  if (fn.startsWith('rgb')) {
    rgb = parts.map((p) => numberOf(p, 255) / 255);
  } else if (fn.startsWith('hsl')) {
    const [h, s, l] = [angleOf(parts[0]), numberOf(parts[1], 100) / 100, numberOf(parts[2], 100) / 100];
    rgb = [h, s, l].some(Number.isNaN) ? [Number.NaN] : hslToSrgb(h, clamp01(s), clamp01(l));
  } else {
    const L = numberOf(parts[0], 1);
    if (fn === 'oklab') {
      rgb = oklabToSrgb(L, numberOf(parts[1], 0.4), numberOf(parts[2], 0.4));
    } else {
      const C = numberOf(parts[1], 0.4);
      const H = (angleOf(parts[2]) * Math.PI) / 180;
      rgb = oklabToSrgb(L, C * Math.cos(H), C * Math.sin(H));
    }
  }
  if ([...rgb, alpha].some(Number.isNaN)) return null;
  const [r, g, b] = rgb.map(clamp01);
  return { r, g, b, a: clamp01(alpha) };
}

const luminance = ({ r, g, b }) => 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

/** WCAG 2 contrast of `fg` drawn over an opaque `bg` (fg alpha composited first). */
export function contrastRatio(fg, bg) {
  const over = (c) => fg[c] * fg.a + bg[c] * (1 - fg.a);
  const top = { r: over('r'), g: over('g'), b: over('b') };
  const [hi, lo] = [luminance(top), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// ---------------------------------------------------------------------------------------------
// Analysis: shape, names, values, contract
// ---------------------------------------------------------------------------------------------

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isAlias = (v) => typeof v === 'string' && ALIAS_RE.test(v.trim());
const quote = (v) => JSON.stringify(v);

function describeBadColor(value) {
  const v = String(value).trim();
  if (/^[a-z]+$/i.test(v)) return `${quote(value)} is a named color, not an allowed color value (use ${ALLOWED_COLORS})`;
  if (/var\(/i.test(v)) return `${quote(value)} uses var(), not an allowed color value (write an alias "{token-name}" instead)`;
  if (/color-mix\(/i.test(v)) return `${quote(value)} uses color-mix(), not an allowed color value (write the mixed color as hex)`;
  return `${quote(value)} is not an allowed color value (use ${ALLOWED_COLORS} or an alias "{token-name}")`;
}

function lengthValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value === 0 ? '0' : `${value}px`;
  if (typeof value === 'string' && LENGTH_RE.test(value.trim())) return value.trim();
  return null;
}

function lineHeightValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value < 10 ? String(value) : `${value}px`;
  return lengthValue(value);
}

function weightValue(value) {
  if (value === 'normal') return '400';
  if (value === 'bold') return '700';
  if (typeof value === 'number' && value >= 1 && value <= 1000) return String(value);
  if (typeof value === 'string' && /^\d{1,4}( \d{1,4})?$/.test(value.trim())) return value.trim();
  return null;
}

function stackIsSafe(stack) {
  if (typeof stack !== 'string' || stack.length === 0 || stack.length > 200) return false;
  if (/[;{}<>\\()]/.test(stack)) return false;
  return (stack.match(/"/g) ?? []).length % 2 === 0 && (stack.match(/'/g) ?? []).length % 2 === 0;
}

/**
 * Reads a parsed tokens.json. Returns `{ report, model }`:
 *  - report.fatal: shape problems that make the file unusable (always exit 1);
 *  - report.errors: contract or value problems (exit 1 with --check, warnings otherwise);
 *  - report.warnings: advice that never fails.
 */
export function analyze(doc) {
  const report = { fatal: [], errors: [], warnings: [] };
  const model = {
    title: 'Design system', themes: [], synthetic: false,
    colors: new Map(), themed: [], statics: [], families: [], styles: [], fonts: [],
    familyOf: new Map(),
  };
  if (!isPlainObject(doc)) {
    report.fatal.push('tokens.json must be a JSON object with families such as "color", "type", "spacing" and "radius"');
    return { report, model };
  }
  if (typeof doc.name === 'string' && doc.name.trim()) model.title = doc.name.trim();

  const claimName = (name, family, where) => {
    if (typeof name !== 'string' || !NAME_RE.test(name)) {
      report.errors.push(`${where}: name ${quote(name)} must match [A-Za-z0-9][A-Za-z0-9_.-]{0,63} (no spaces, no "/")`);
      return false;
    }
    if (model.familyOf.has(name)) {
      const first = model.familyOf.get(name);
      report.errors.push(first === family
        ? `name ${quote(name)} is used twice in the ${quote(family)} family; names are unique (duplicate dropped)`
        : `name ${quote(name)} is used more than once, in the ${quote(first)} and ${quote(family)} families; names are unique across every family but type: prefix each with its family (${quote(`${first}-${name}`)}, ${quote(`${family}-${name}`)}) (duplicate dropped)`);
      return false;
    }
    model.familyOf.set(name, family);
    return true;
  };

  const listShaped = (key, family) => {
    if (!isPlainObject(family)) {
      report.errors.push(`family ${quote(key)} must be an object {"tokens": [{"name", "value", "usage"}]} (family skipped)`);
      return false;
    }
    if (!Array.isArray(family.tokens)) {
      report.fatal.push(`family ${quote(key)} is a name→value map (DTCG / W3C style) or has no "tokens" list; the Design System page reads only lists: {"tokens": [{"name": "…", "value": "…", "usage": "…"}]}`);
      return false;
    }
    return true;
  };

  // --- color -------------------------------------------------------------------------------
  const color = doc.color;
  if (!isPlainObject(color)) {
    report.fatal.push(color === undefined
      ? 'family "color" is missing'
      : 'family "color" must be an object {"themes": […], "tokens": [{"name", "value", "usage"}]}');
  } else if (listShaped('color', color)) {
    if (Array.isArray(color.themes) && color.themes.length > 0) {
      const seen = new Set();
      for (const theme of color.themes) {
        const id = String(theme?.id ?? '').toLowerCase();
        if (!NAME_RE.test(id) || seen.has(id)) {
          report.errors.push(`color.themes: theme id ${quote(theme?.id)} is invalid or repeated (theme skipped)`);
          continue;
        }
        seen.add(id);
        model.themes.push({ id, name: theme.name ?? id });
      }
    }
    if (model.themes.length === 0) {
      model.themes.push({ id: 'default', name: 'Default' });
      model.synthetic = true;
    }
    const themeIds = model.themes.map((t) => t.id);
    const first = themeIds[0];
    color.tokens.forEach((token, index) => {
      const where = `color.tokens[${token?.name ?? index}]`;
      if (!isPlainObject(token)) {
        report.errors.push(`color.tokens[${index}] must be an object {"name", "value", "usage"}`);
        return;
      }
      if (!claimName(token.name, 'color', where)) return;
      if (!token.usage) report.warnings.push(`${where}: no "usage" note (say where the color goes)`);
      let raw = token.value;
      if (typeof raw === 'string') raw = { [first]: raw };
      if (!isPlainObject(raw)) {
        report.errors.push(`${where}.value must be a color string or {"<theme id>": "<color>"} (token dropped)`);
        return;
      }
      const values = new Map();
      for (const [themeKey, themeValue] of Object.entries(raw)) {
        const themeId = themeKey.toLowerCase();
        if (!themeIds.includes(themeId)) {
          report.warnings.push(`${where}.value.${themeKey}: theme ${quote(themeKey)} is not declared in color.themes (ignored)`);
          continue;
        }
        const v = typeof themeValue === 'string' ? themeValue.trim() : themeValue;
        if (isAlias(v) || (typeof v === 'string' && parseColor(v))) {
          values.set(themeId, HEX_RE.test(v) ? v.toLowerCase() : v);
        } else {
          report.errors.push(`${where}.value.${themeKey}: ${describeBadColor(themeValue)} (value dropped)`);
        }
      }
      if (!values.has(first) && values.size > 0) values.set(first, values.values().next().value);
      if (values.size === 0) {
        report.errors.push(`${where}: no valid value in any theme (token dropped)`);
        return;
      }
      model.colors.set(token.name, values);
    });

    // Aliases must point at an existing color token, without cycles, at most 16 deep.
    for (const [name, values] of model.colors) {
      for (const [themeId, v] of values) {
        if (!isAlias(v)) continue;
        const problem = resolveColor(model, name, themeId).error;
        if (problem) {
          report.errors.push(`color.tokens[${name}].value.${themeId}: alias ${v} ${problem} (value dropped)`);
          values.delete(themeId);
        }
      }
      if (values.size === 0) model.colors.delete(name);
      else if (!values.has(first)) values.set(first, values.values().next().value);
    }
  }

  // --- other {tokens:[…]} families -------------------------------------------------------------
  for (const [key, family] of Object.entries(doc)) {
    if (META_KEYS.has(key) || key === 'color' || key === 'type') continue;
    if (key === 'motion') {
      report.errors.push('family "motion" is not supported by the Design System page; motion lives in tokens-to-css defaults (override with --motion) and the README "Motion" section');
      continue;
    }
    if (!listShaped(key, family)) continue;
    family.tokens.forEach((token, index) => {
      const where = `${key}.tokens[${token?.name ?? index}]`;
      if (!isPlainObject(token)) {
        report.errors.push(`${key}.tokens[${index}] must be an object {"name", "value", "usage"}`);
        return;
      }
      if (!claimName(token.name, key, where)) return;
      if (!token.usage) report.warnings.push(`${where}: no "usage" note`);
      const check = (v) => checkFamilyValue(key, v);
      if (isPlainObject(token.value)) {
        if (key !== 'shadow') {
          report.errors.push(`${where}: per-theme values are read only for color and shadow (token dropped)`);
          return;
        }
        const values = new Map();
        for (const [themeKey, v] of Object.entries(token.value)) {
          const out = check(v);
          if (out.error) report.errors.push(`${where}.value.${themeKey}: ${out.error} (value dropped)`);
          else values.set(themeKey.toLowerCase(), out.value);
        }
        const firstId = model.themes[0]?.id;
        if (firstId && !values.has(firstId) && values.size > 0) values.set(firstId, values.values().next().value);
        if (values.size > 0) model.themed.push({ name: token.name, values });
        return;
      }
      const out = check(token.value);
      if (out.error) report.errors.push(`${where}: ${out.error} (token dropped)`);
      else model.statics.push({ name: token.name, value: out.value, family: key });
    });
  }

  // --- type --------------------------------------------------------------------------------
  const type = doc.type;
  if (type !== undefined && !isPlainObject(type)) {
    report.fatal.push('family "type" must be {"fonts": […], "families": {…}, "groups": […]}');
  } else if (type) {
    if (type.families !== undefined && !isPlainObject(type.families)) {
      report.errors.push('type.families must be an object {"sans": "<font stack>", …}');
    }
    for (const [key, stack] of Object.entries(isPlainObject(type.families) ? type.families : {})) {
      const id = key.toLowerCase();
      if (!NAME_RE.test(id)) report.errors.push(`type.families.${key}: invalid key`);
      else if (!stackIsSafe(stack)) report.errors.push(`type.families.${key}: ${quote(stack)} is not a plain font stack (≤200 chars, no ; { } < > \\ ( ), balanced quotes)`);
      else model.families.push({ key: id, stack });
    }
    for (const font of Array.isArray(type.fonts) ? type.fonts : []) {
      if (!isPlainObject(font) || typeof font.family !== 'string' || /["'{};<>]/.test(font.family)) {
        report.errors.push(`type.fonts: ${quote(font)} needs a bare "family" name`);
        continue;
      }
      if (font.file !== undefined && (typeof font.file !== 'string' || /["'()\\]|\.\./.test(font.file))) {
        report.errors.push(`type.fonts[${font.family}]: file ${quote(font.file)} is not a plain relative path`);
        continue;
      }
      if (font.file) model.fonts.push(font);
    }
    const styleNames = new Set();
    for (const group of Array.isArray(type.groups) ? type.groups : []) {
      for (const style of Array.isArray(group?.styles) ? group.styles : []) {
        const where = `type.groups[${group.name ?? '?'}].styles[${style?.name ?? '?'}]`;
        if (!isPlainObject(style) || typeof style.name !== 'string' || !NAME_RE.test(style.name)) {
          report.errors.push(`${where}: style needs a valid "name"`);
          continue;
        }
        if (styleNames.has(style.name)) {
          report.errors.push(`${where}: style name used more than once (duplicate dropped)`);
          continue;
        }
        const size = lengthValue(style.fontSize);
        if (!size) {
          report.errors.push(`${where}: fontSize ${quote(style.fontSize)} is not a length (style dropped)`);
          continue;
        }
        styleNames.add(style.name);
        const line = style.lineHeight === undefined ? null : lineHeightValue(style.lineHeight);
        const weight = style.fontWeight === undefined ? null : weightValue(style.fontWeight);
        if (style.lineHeight !== undefined && !line) report.errors.push(`${where}: lineHeight ${quote(style.lineHeight)} is not valid`);
        if (style.fontWeight !== undefined && !weight) report.errors.push(`${where}: fontWeight ${quote(style.fontWeight)} is not valid`);
        const family = String(style.family ?? group.family ?? 'sans').toLowerCase();
        const tracking = style.letterSpacing === undefined ? null : lengthValue(style.letterSpacing);
        model.styles.push({ name: style.name, size, line, weight, family, tracking });
      }
    }
  }
  return { report, model };
}

function checkFamilyValue(key, value) {
  if (key === 'spacing' || key === 'radius') {
    const v = lengthValue(value);
    return v ? { value: v } : { error: `${quote(value)} is not a length (px, rem, em, % or a number)` };
  }
  if (typeof value === 'number' && Number.isFinite(value)) return { value: String(value) };
  if (typeof value !== 'string' || value.trim() === '') return { error: `${quote(value)} is not a CSS value` };
  const v = value.trim();
  if (key === 'shadow') {
    if (v.length > 400 || UNSAFE_CSS_RE.test(v) || /var\(|url\(/i.test(v)) {
      return { error: `${quote(value)} is not a plain box-shadow (no var(), url(), ; { } < >, ≤400 chars)` };
    }
    return { value: v };
  }
  if (v.length > 200 || !/^[A-Za-z0-9 #%(),./+_-]+$/.test(v) || /var\(|url\(/i.test(v)) {
    return { error: `${quote(value)} is not a plain CSS value` };
  }
  return { value: v };
}

/** Follows aliases to a literal color for one theme. Returns { value } or { error }. */
function resolveColor(model, name, themeId, depth = 0, seen = new Set()) {
  if (depth > 16) return { error: 'chains more than 16 aliases' };
  const values = model.colors.get(name);
  if (!values) return { error: `points at ${quote(name)}, which is not a color token` };
  if (seen.has(name)) return { error: 'forms a cycle' };
  seen.add(name);
  const v = values.get(themeId) ?? values.get(model.themes[0].id);
  if (!isAlias(v)) return { value: v };
  return resolveColor(model, ALIAS_RE.exec(v.trim())[1], themeId, depth + 1, seen);
}

/** Contract rules on top of the shape: required names, themes and text contrast. */
export function checkContract(doc, model, report) {
  const colorNames = new Set(Array.isArray(doc.color?.tokens) ? doc.color.tokens.map((t) => t?.name) : []);
  const familyNames = (key) => new Set(Array.isArray(doc[key]?.tokens) ? doc[key].tokens.map((t) => t?.name) : []);
  const missing = (label, required, present) => {
    const absent = required.filter((n) => !present.has(n));
    if (absent.length) report.errors.push(`missing required ${label}: ${absent.join(', ')}`);
  };
  missing('color tokens', REQUIRED.color, colorNames);
  missing('spacing tokens', REQUIRED.spacing, familyNames('spacing'));
  missing('radius tokens', REQUIRED.radius, familyNames('radius'));
  missing('type.families keys', REQUIRED.families, new Set(model.families.map((f) => f.key)));
  missing('text styles', REQUIRED.styles, new Set(model.styles.map((s) => s.name)));
  if (model.themes.length < 2) {
    report.warnings.push('only one color theme: UX Studio systems ship a light and a dark theme');
  }

  for (const theme of model.themes) {
    for (const [pairs, bucket] of [[CONTRAST_ERRORS, report.errors], [CONTRAST_WARNINGS, report.warnings]]) {
      for (const [fgName, bgName, minimum] of pairs) {
        if (!model.colors.has(fgName) || !model.colors.has(bgName)) continue;
        const fg = parseColor(resolveColor(model, fgName, theme.id).value);
        const bg = parseColor(resolveColor(model, bgName, theme.id).value);
        if (!fg || !bg) continue;
        if (bg.a < 1) {
          bucket.push(`contrast: ${bgName} is translucent in theme ${quote(theme.id)}; ground colors must be opaque to measure ${fgName} on it`);
          continue;
        }
        const ratio = contrastRatio(fg, bg);
        if (ratio + 1e-9 < minimum) {
          bucket.push(`contrast: ${fgName} on ${bgName} is ${ratio.toFixed(2)}:1 in theme ${quote(theme.id)}; needs at least ${minimum}:1`);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// CSS output
// ---------------------------------------------------------------------------------------------

const cssName = (name) => `--${name.replace(/\./g, '\\.')}`;
const cssValue = (v) => (isAlias(v) ? `var(${cssName(ALIAS_RE.exec(v.trim())[1])})` : v);

function rule(selector, decls, indent = '') {
  if (decls.length === 0) return '';
  const body = decls.map(([name, value]) => `${indent}  ${name}: ${value};`).join('\n');
  return `${indent}${selector} {\n${body}\n${indent}}\n`;
}

/** The two themes the browser knows how to render; any other theme id gets no color-scheme. */
const colorSchemeOf = (themeId) => (themeId === 'light' || themeId === 'dark' ? [['color-scheme', themeId]] : []);

function themeDecls(model, themeId, isDefault) {
  const first = model.themes[0].id;
  const decls = colorSchemeOf(themeId);
  const tokens = [...[...model.colors].map(([name, values]) => ({ name, values })), ...model.themed];
  for (const { name, values } of tokens) {
    const base = values.get(first);
    if (isDefault) {
      decls.push([cssName(name), cssValue(base)]);
      continue;
    }
    const own = values.get(themeId);
    if (own !== undefined && (own !== base || isAlias(own))) decls.push([cssName(name), cssValue(own)]);
    else if (own === undefined && isAlias(base)) decls.push([cssName(name), cssValue(base)]);
  }
  return decls;
}

export function compileCss(model, motion = MOTION_DEFAULTS, { styleClasses = false } = {}) {
  const out = [`/* ${model.title.replace(/\*\//g, '* /')} — generated from tokens.json by tokens-to-css.mjs; regenerate, do not edit. */\n`];
  for (const font of model.fonts) {
    const decls = [
      ['font-family', quote(font.family)],
      ['src', `url(${quote(font.file.includes('/') ? font.file : `fonts/${font.file}`)})`],
      ['font-weight', weightValue(font.weight) ?? '400'],
      ['font-style', /^(italic|oblique)$/.test(font.style) ? font.style : 'normal'],
      ['font-display', 'swap'],
    ];
    out.push(rule('@font-face', decls));
  }
  const [first, ...rest] = model.themes;
  out.push(rule(model.synthetic ? ':root' : `:root, [data-theme="${first.id}"]`, themeDecls(model, first.id, true)));
  for (const theme of rest) out.push(rule(`[data-theme="${theme.id}"]`, themeDecls(model, theme.id, false)));
  const ids = model.themes.map((t) => t.id);
  if (ids.length === 2 && ids.includes('light') && ids.includes('dark')) {
    const other = rest[0].id;
    const inner = rule(`:root:not([data-theme="${first.id}"])`, themeDecls(model, other, false), '  ');
    if (inner) out.push(`@media (prefers-color-scheme: ${other}) {\n${inner}}\n`);
  }
  const statics = model.statics.map(({ name, value }) => [cssName(name), value]);
  const fonts = model.families.map(({ key, stack }) => [`--font-${key}`, stack]);
  const styles = model.styles.flatMap(({ name, size, line, weight }) => [
    [`--text-${name}-size`, size],
    ...(line ? [[`--text-${name}-line`, line]] : []),
    ...(weight ? [[`--text-${name}-weight`, weight]] : []),
  ]);
  out.push(rule(':root', [...statics, ...fonts, ...styles, ...Object.entries(motion)]));
  if (styleClasses) {
    for (const { name, line, weight, family, tracking } of model.styles) {
      out.push(rule(`.${name.replace(/\./g, '\\.')}`, [
        ['font-family', `var(--font-${family})`],
        ['font-size', `var(--text-${name}-size)`],
        ...(line ? [['line-height', `var(--text-${name}-line)`]] : []),
        ...(weight ? [['font-weight', `var(--text-${name}-weight)`]] : []),
        ...(tracking ? [['letter-spacing', tracking]] : []),
      ]));
    }
  }
  return out.filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { input: null, out: null, motion: null, check: false, styleClasses: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check') args.check = true;
    else if (arg === '--style-classes') args.styleClasses = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg === '--out' || arg === '--motion') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} needs a file path`);
      args[arg.slice(2)] = value;
      i += 1;
    } else if (arg.startsWith('--')) throw new Error(`unknown option ${arg}`);
    else if (args.input) throw new Error(`unexpected argument ${arg}`);
    else args.input = arg;
  }
  return args;
}

function readMotion(file) {
  const motion = JSON.parse(readFileSync(file, 'utf8'));
  if (!isPlainObject(motion)) throw new Error(`${file}: motion overrides must be a JSON object {"--duration-fast": "…"}`);
  for (const [key, value] of Object.entries(motion)) {
    if (!/^--[A-Za-z0-9_-]+$/.test(key) || typeof value !== 'string' || UNSAFE_CSS_RE.test(value) || !value.trim()) {
      throw new Error(`${file}: ${quote(key)}: ${quote(value)} is not a custom property and plain value`);
    }
  }
  return { ...MOTION_DEFAULTS, ...motion };
}

export function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`error: ${error.message}\n${USAGE}\n`);
    return 2;
  }
  if (args.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  if (!args.input) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  let text;
  let motion;
  try {
    text = readFileSync(args.input, 'utf8');
    motion = args.motion ? readMotion(args.motion) : MOTION_DEFAULTS;
  } catch (error) {
    process.stderr.write(`error: ${error.message}\n`);
    return 2;
  }
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (error) {
    process.stderr.write(`error: ${args.input} is not valid JSON: ${error.message}\n`);
    return 1;
  }

  const { report, model } = analyze(doc);
  if (report.fatal.length === 0) checkContract(doc, model, report);
  const print = (label, list) => list.forEach((m) => process.stderr.write(`${label}: ${m}\n`));
  print('error', report.fatal);
  print(args.check ? 'error' : 'warning', report.errors);
  print('warning', report.warnings);
  if (report.fatal.length || (args.check && report.errors.length)) {
    const count = report.fatal.length + (args.check ? report.errors.length : 0);
    process.stderr.write(`${args.input}: ${count} error(s); see references/tokens-contract.md\n`);
    return 1;
  }

  const css = compileCss(model, motion, { styleClasses: args.styleClasses });
  if (args.out) {
    mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    writeFileSync(args.out, css);
  }
  if (args.check) {
    const themes = model.themes.map((t) => t.id).join(', ');
    process.stdout.write(`OK: ${args.input} meets the UX Studio token contract (${model.colors.size} colors; themes ${themes}; ${report.warnings.length} warning(s))${args.out ? `; wrote ${args.out}` : ''}\n`);
  } else if (!args.out) {
    process.stdout.write(css);
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = main();
}
