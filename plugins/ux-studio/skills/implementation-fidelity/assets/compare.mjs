#!/usr/bin/env node
// Compare the captures written by capture-states.mjs and write the fidelity report.
//
//   node compare.mjs --config fidelity.config.json [--out <dir>] [--previous <old fidelity.json>]
//
// Per state x viewport x theme:
//   - computed-style diff of every mapped element: colours with CIEDE2000 (alpha composited over
//     white, alpha compared too), lengths in px, font-size / font-weight exact by default, the rest
//     as exact strings; each finding gets a priority (A tokens, B components, C layout, D details)
//     and the exact change to make;
//   - pixel diff (pixelmatch) with the union of both sides' masks painted out, a diff PNG and a
//     prototype | implementation | diff image.
// Writes <outDir>/fidelity.json and <outDir>/fidelity.md (from report-template.md).
// With --previous it adds the before/after delta: resolved, new, still open, not re-measured.
// Exit codes: 0 ok, 1 error, 2 missing dependency.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseColor, deltaE2000Css, toHex } from './delta-e.mjs';
import { parseTokensCss, resolveTokens } from './tokens-css.mjs';
import {
  assertKnownOptions,
  elementNamesFor,
  isPending,
  loadConfig,
  parseArgs,
  propertiesFor,
  requireDependencies,
  requireValue,
  runCli,
  stateKey,
} from './capture-states.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_TOLERANCES = {
  deltaE: 2, // CIEDE2000
  alpha: 0.02, // absolute difference of the alpha channel
  px: 1, // sizes, spacing, radii, borders, line-height
  fontSize: 0, // px, exact
  fontWeight: 0, // exact
  durationMs: 0, // transition/animation durations
  pixelRatio: 0.02, // share of differing pixels outside masks
  pixelThreshold: 0.1, // pixelmatch per-pixel threshold (0..1)
  maskPadding: 1, // css px added around each mask rectangle
};

const PRIORITY_LABEL = {
  A: 'A. Tokens',
  B: 'B. Componentes',
  C: 'C. Disposición',
  D: 'D. Detalles',
};

const isColorProp = (p) => /(^|-)color$/.test(p) || p === 'fill' || p === 'stroke';
const TYPOGRAPHY = new Set([
  'font-family',
  'rendered-font',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'font-feature-settings',
  'font-variation-settings',
]);
const LAYOUT = /^(width|height|x|y|top|right|bottom|left|gap|row-gap|column-gap|display|position)$|^(margin|flex|grid|align|justify)/;
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const pxList = (v) => (/^-?[\d.]+px(\s+-?[\d.]+px)*$/.test(v) ? v.split(/\s+/).map(parseFloat) : null);
const firstFamily = (v) => v.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
const msList = (v) =>
  /^-?[\d.]+m?s(\s*,\s*-?[\d.]+m?s)*$/.test(v)
    ? v.split(',').map((t) => (t.trim().endsWith('ms') ? parseFloat(t) : parseFloat(t) * 1000))
    : null;

/** Compare one property value; returns { kind, pass, delta, unit, tolerance, shown: [proto, impl] }. */
export function compareValue(prop, a, b, tol, colors = {}) {
  if (isColorProp(prop)) {
    const ca = parseColor(colors.prototype || a);
    const cb = parseColor(colors.implementation || b);
    if (ca && cb) {
      const delta = round(deltaE2000Css(ca, cb), 2);
      const alpha = Math.abs((ca.a ?? 1) - (cb.a ?? 1));
      return {
        kind: 'color',
        pass: delta <= tol.deltaE && alpha <= tol.alpha,
        delta,
        unit: 'ΔE00',
        tolerance: tol.deltaE,
        shown: [toHex(ca), toHex(cb)],
      };
    }
  }
  if (prop === 'font-weight') {
    const delta = Math.abs(parseFloat(b) - parseFloat(a));
    return { kind: 'font-weight', pass: delta <= tol.fontWeight, delta, unit: '', tolerance: tol.fontWeight, shown: [a, b] };
  }
  if (prop === 'font-family' || prop === 'rendered-font') {
    const pass = firstFamily(a) === firstFamily(b);
    return { kind: 'exact', pass, delta: pass ? 0 : null, unit: '', tolerance: 'igual', shown: [a, b] };
  }
  const norm = (v, p) => (p === 'letter-spacing' && v === 'normal' ? '0px' : v);
  const la = pxList(norm(a, prop));
  const lb = pxList(norm(b, prop));
  if (la && lb && la.length === lb.length) {
    const delta = round(Math.max(...la.map((v, i) => Math.abs(lb[i] - v))), 2);
    const limit = prop === 'font-size' ? tol.fontSize : tol.px;
    return { kind: prop === 'font-size' ? 'font-size' : 'length', pass: delta <= limit + 1e-9, delta, unit: 'px', tolerance: limit, shown: [a, b] };
  }
  const ma = msList(a);
  const mb = msList(b);
  if (ma && mb && ma.length === mb.length) {
    const delta = round(Math.max(...ma.map((v, i) => Math.abs(mb[i] - v))), 1);
    return { kind: 'duration', pass: delta <= tol.durationMs, delta, unit: 'ms', tolerance: tol.durationMs, shown: [a, b] };
  }
  const pass = a.replace(/\s+/g, ' ') === b.replace(/\s+/g, ' ');
  return { kind: 'exact', pass, delta: pass ? 0 : null, unit: '', tolerance: 'igual', shown: [a, b] };
}

/** A tokens (colour, typography, radius, shadow) · B components · C layout · D details. */
export function priorityOf(prop, kind, def = {}) {
  if (def.priority) return def.priority;
  if (kind === 'missing') return 'B';
  if (isColorProp(prop) || TYPOGRAPHY.has(prop) || /radius$/.test(prop) || prop === 'box-shadow') return 'A';
  if (/^padding/.test(prop) || /^border-.*width$/.test(prop)) return 'B';
  if (LAYOUT.test(prop)) return def.level === 'component' ? 'B' : 'C';
  return 'D';
}

const distance = (d) => (!d ? '—' : d.comparable === false ? 'no comparable' : d.delta === null ? 'distinto' : `${d.delta} ${d.unit}`.trim());

/** " = 0.875rem; contra el token: prototipo 0 px, implementación 2 px" when tokensCss resolved the token. */
function tokenText(f) {
  if (f.tokenValue === undefined || !f.vsToken) return '';
  return ` = \`${f.tokenValue}\`; contra el token: prototipo ${distance(f.vsToken.prototype)}, implementación ${distance(f.vsToken.implementation)}`;
}

function changeText(f) {
  if (f.kind === 'missing') return `Agregar el elemento \`${f.element}\` (\`${f.selector}\`): existe en el prototipo y no en la implementación.`;
  const token = f.token ? ` (token \`${f.token}\`${tokenText(f)})` : '';
  return `Cambiar \`${f.property}\` en \`${f.selector}\`: ${f.implementation} → ${f.prototype}${token}.`;
}

/* ------------------------------------------------------------------ pixels */

function readPng(PNG, file) {
  return fs.existsSync(file) ? PNG.sync.read(fs.readFileSync(file)) : null;
}

function padded(PNG, img, w, h, fill) {
  const out = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) out.data.set(fill, i * 4);
  PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0);
  return out;
}

function pixelDiff({ PNG, pixelmatch }, files, rects, scale, tol, outDir, key) {
  const a = readPng(PNG, files.prototype);
  const b = readPng(PNG, files.implementation);
  if (!a || !b) return null;
  const w = Math.max(a.width, b.width);
  const h = Math.max(a.height, b.height);
  // Area present on one side only always counts as different (distinct fills).
  const pa = padded(PNG, a, w, h, [255, 0, 255, 255]);
  const pb = padded(PNG, b, w, h, [0, 255, 0, 255]);
  let masked = 0;
  const pad = tol.maskPadding;
  const hit = new Uint8Array(w * h);
  for (const r of rects) {
    const x0 = Math.max(0, Math.floor((r.x - pad) * scale));
    const y0 = Math.max(0, Math.floor((r.y - pad) * scale));
    const x1 = Math.min(w, Math.ceil((r.x + r.width + pad) * scale));
    const y1 = Math.min(h, Math.ceil((r.y + r.height + pad) * scale));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = y * w + x;
        if (hit[i]) continue;
        hit[i] = 1;
        masked++;
        pa.data.set([128, 128, 128, 255], i * 4);
        pb.data.set([128, 128, 128, 255], i * 4);
      }
    }
  }
  const diff = new PNG({ width: w, height: h });
  const different = pixelmatch(pa.data, pb.data, diff.data, w, h, { threshold: tol.pixelThreshold });
  const compared = w * h - masked;
  const ratio = compared > 0 ? round(different / compared, 6) : 0;

  const diffRel = path.join('diff', `${key}.png`);
  const sbsRel = path.join('side-by-side', `${key}.png`);
  fs.mkdirSync(path.join(outDir, 'diff'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'side-by-side'), { recursive: true });
  fs.writeFileSync(path.join(outDir, diffRel), PNG.sync.write(diff));
  const gap = 8;
  const sbs = new PNG({ width: w * 3 + gap * 2, height: h });
  sbs.data.fill(255);
  PNG.bitblt(pa, sbs, 0, 0, w, h, 0, 0);
  PNG.bitblt(pb, sbs, 0, 0, w, h, w + gap, 0);
  PNG.bitblt(diff, sbs, 0, 0, w, h, (w + gap) * 2, 0);
  fs.writeFileSync(path.join(outDir, sbsRel), PNG.sync.write(sbs));

  return {
    ratio,
    differentPixels: different,
    comparedPixels: compared,
    maskedPixels: masked,
    threshold: tol.pixelRatio,
    pass: ratio <= tol.pixelRatio,
    diff: diffRel,
    sideBySide: sbsRel,
    sizeMismatch:
      a.width !== b.width || a.height !== b.height
        ? { prototype: [a.width, a.height], implementation: [b.width, b.height] }
        : null,
  };
}

/* ------------------------------------------------------------------ measurement */

function readCapture(outDir, side, key) {
  const file = path.join(outDir, 'captures', side, `${key}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

function metaWarnings(key, p, q) {
  const w = [];
  const pm = p.meta || {};
  const qm = q.meta || {};
  if (pm.browser && qm.browser && pm.browser !== qm.browser) w.push(`${key}: navegadores distintos (${pm.browser} / ${qm.browser}).`);
  if (pm.devicePixelRatio !== qm.devicePixelRatio) w.push(`${key}: devicePixelRatio distinto (${pm.devicePixelRatio} / ${qm.devicePixelRatio}).`);
  if (pm.innerWidth !== qm.innerWidth || pm.innerHeight !== qm.innerHeight)
    w.push(`${key}: ventana distinta (${pm.innerWidth}×${pm.innerHeight} / ${qm.innerWidth}×${qm.innerHeight}).`);
  if (pm.prefersDark !== qm.prefersDark) w.push(`${key}: esquema de color distinto entre los dos lados.`);
  for (const [side, m] of [['prototipo', pm], ['implementación', qm]]) {
    if (m.fontsStatus && m.fontsStatus !== 'loaded') w.push(`${key}: fuentes sin terminar de cargar en ${side} (${m.fontsStatus}).`);
    for (const pr of m.problems || []) w.push(`${key}: ${side}: ${pr}`);
  }
  return w;
}

/** `rem` at the browser default of 16 px, and a bare 0, so token values compare with computed pixels. */
export function tokenForCompare(prop, value) {
  return isColorProp(prop) ? value : value.replace(/(-?[\d.]+)rem\b/g, (m, n) => `${round(parseFloat(n) * 16, 3)}px`).replace(/^(-?0)$/, '$1px');
}

function vsToken(prop, tokenValue, sideValue, sideColor, tol) {
  if (isColorProp(prop) && !parseColor(tokenValue)) return { delta: null, unit: '', pass: null, comparable: false };
  const r = compareValue(prop, tokenForCompare(prop, tokenValue), sideValue, tol, { implementation: sideColor });
  return { delta: r.delta, unit: r.unit, pass: r.pass };
}

export function measure(config, deps) {
  const tol = { ...DEFAULT_TOLERANCES, ...(config.tolerances || {}) };
  const outDir = config.__out;
  const pairs = [];
  const findings = [];
  const measurements = [];
  const warnings = [];
  const tokenCache = new Map();
  const tokensFor = (theme) => {
    if (!config.__tokensCss) return null;
    if (!tokenCache.has(theme)) tokenCache.set(theme, resolveTokens(parseTokensCss(config.__tokensCss.css), theme, config.themes));
    return tokenCache.get(theme);
  };
  const undeclared = new Set();
  const pending = config.states.filter(isPending).map((s) => ({ state: s.id, reason: s.reason.trim() }));

  for (const state of config.states) {
    if (isPending(state)) continue;
    for (const viewport of config.viewports) {
      for (const theme of config.themes) {
        const key = stateKey(state, viewport, theme);
        const p = readCapture(outDir, 'prototype', key);
        const q = readCapture(outDir, 'implementation', key);
        if (!p || !q) {
          warnings.push(`${key}: falta la captura de ${!p ? 'prototipo' : 'implementación'}; no se midió.`);
          continue;
        }
        warnings.push(...metaWarnings(key, p, q));
        let measured = 0;
        let within = 0;
        const pairFindings = [];

        for (const name of elementNamesFor(config, state)) {
          const def = config.elements[name];
          if (!def) {
            warnings.push(`${key}: el estado nombra \`${name}\` y el mapa de elementos no lo define.`);
            continue;
          }
          const pe = p.elements?.[name];
          const qe = q.elements?.[name];
          const props = propertiesFor(def);
          if (!pe?.found) {
            warnings.push(`${key}: \`${name}\` no aparece en el prototipo (\`${def.prototype}\`): corregir el mapa.`);
            continue;
          }
          if (!qe?.found) {
            const n = props.filter((pr) => pe.values[pr] !== undefined).length || 1;
            measured += n;
            const f = { pair: key, state: state.id, viewport: viewport.id, theme, element: name, selector: def.implementation, property: '(elemento)', kind: 'missing', prototype: 'presente', implementation: 'ausente', delta: null, unit: '', tolerance: 'presente', priority: priorityOf('', 'missing', def), token: null };
            f.change = changeText(f);
            pairFindings.push(f);
            continue;
          }
          for (const prop of props) {
            const a = pe.values[prop];
            const b = qe.values[prop];
            if (a === undefined || b === undefined) continue;
            const r = compareValue(prop, a, b, tol, { prototype: pe.colors?.[prop], implementation: qe.colors?.[prop] });
            measured++;
            if (r.pass) within++;
            const measurement = { pair: key, element: name, property: prop, prototype: r.shown[0], implementation: r.shown[1], delta: r.delta, unit: r.unit, pass: r.pass };
            const tokenName = def.tokens?.[prop];
            let tokenExtra = {};
            const declared = tokenName ? tokensFor(theme) : null;
            if (declared) {
              const tokenValue = declared.get(tokenName);
              if (tokenValue === undefined) {
                const w = `${key}: el token \`${tokenName}\` de \`${name}\` (\`${prop}\`) no está declarado en ${path.basename(config.__tokensCss.path)} para el tema ${theme}.`;
                if (!undeclared.has(w)) {
                  undeclared.add(w);
                  warnings.push(w);
                }
              } else {
                tokenExtra = {
                  tokenValue,
                  vsToken: {
                    prototype: vsToken(prop, tokenValue, a, pe.colors?.[prop], tol),
                    implementation: vsToken(prop, tokenValue, b, qe.colors?.[prop], tol),
                  },
                };
              }
            }
            Object.assign(measurement, tokenExtra);
            measurements.push(measurement);
            if (r.pass) continue;
            const f = {
              pair: key,
              state: state.id,
              viewport: viewport.id,
              theme,
              element: name,
              selector: def.implementation,
              property: prop,
              kind: r.kind,
              prototype: r.shown[0],
              implementation: r.shown[1],
              delta: r.delta,
              unit: r.unit,
              tolerance: r.tolerance,
              priority: priorityOf(prop, r.kind, def),
              token: tokenName || null,
              ...tokenExtra,
            };
            f.change = changeText(f);
            pairFindings.push(f);
          }
        }

        const scale = (viewport.scale || 'css') === 'device' ? viewport.deviceScaleFactor ?? 1 : 1;
        const pixel = pixelDiff(
          deps,
          {
            prototype: path.join(outDir, 'captures/prototype', p.meta?.png || `${key}.png`),
            implementation: path.join(outDir, 'captures/implementation', q.meta?.png || `${key}.png`),
          },
          [...(p.masks || []), ...(q.masks || [])],
          scale,
          tol,
          outDir,
          key
        );
        if (!pixel) warnings.push(`${key}: sin las dos capturas PNG; se compararon solo los estilos.`);
        else if (!pixel.pass && pairFindings.length === 0)
          warnings.push(`${key}: la diferencia de píxeles (${pct(pixel.ratio)}) supera el umbral y ninguna propiedad medida la explica: ampliar el mapa de elementos.`);
        if (pixel?.sizeMismatch) warnings.push(`${key}: las capturas tienen tamaños distintos; el área sobrante cuenta como diferente.`);

        findings.push(...pairFindings);
        pairs.push({
          key,
          state: state.id,
          viewport: viewport.id,
          theme,
          measured,
          withinTolerance: within,
          score: measured ? round((within / measured) * 100, 1) : null,
          findings: pairFindings.length,
          pixel,
        });
      }
    }
  }

  findings.sort((x, y) => x.priority.localeCompare(y.priority) || x.pair.localeCompare(y.pair) || x.element.localeCompare(y.element));
  findings.forEach((f, i) => (f.id = `F${i + 1}`));
  const measuredAll = pairs.reduce((s, p) => s + p.measured, 0);
  const withinAll = pairs.reduce((s, p) => s + p.withinTolerance, 0);
  return {
    generatedAt: new Date().toISOString(),
    config: config.__path,
    tokensCss: config.__tokensCss ? config.__tokensCss.path : null,
    tolerances: tol,
    summary: {
      score: measuredAll ? round((withinAll / measuredAll) * 100, 1) : null,
      measured: measuredAll,
      withinTolerance: withinAll,
      pairs: pairs.length,
      findings: findings.length,
      pixelFailures: pairs.filter((p) => p.pixel && !p.pixel.pass).length,
      pendingStates: pending.length,
    },
    pending,
    pairs,
    findings,
    measurements,
    warnings,
    delta: null,
  };
}

export function deltaAgainst(previous, current, previousPath) {
  const id = (f) => `${f.pair}|${f.element}|${f.property}`;
  const now = new Map(current.findings.map((f) => [id(f), f]));
  const before = new Map(previous.findings.map((f) => [id(f), f]));
  const remeasured = new Set(current.pairs.map((p) => p.key));
  const resolved = [];
  const open = [];
  const notRemeasured = [];
  for (const [k, f] of before) {
    if (!remeasured.has(f.pair)) notRemeasured.push(f);
    else if (now.has(k)) open.push({ ...now.get(k), before: f.implementation });
    else resolved.push(f);
  }
  const added = current.findings.filter((f) => !before.has(id(f)));
  return {
    previous: previousPath,
    before: previous.summary?.score ?? null,
    after: current.summary.score,
    resolved,
    new: added,
    open,
    notRemeasured,
  };
}

/* ------------------------------------------------------------------ markdown */

const pct = (r) => `${round(r * 100, 2)} %`;
const cell = (v) => String(v ?? '—').replace(/\|/g, '\\|').replace(/\n/g, ' ');

function renderMarkdown(report, config, template) {
  const t = report.tolerances;
  const summaryRows = report.pairs
    .map((p) => {
      const px = p.pixel ? `${pct(p.pixel.ratio)} ${p.pixel.pass ? '✓' : '✗'}` : 'sin captura';
      return `| ${p.state} | ${p.viewport} | ${p.theme} | ${p.score ?? '—'} % | ${p.withinTolerance} de ${p.measured} | ${px} | ${p.findings} |`;
    })
    .join('\n');
  const summary = [
    '| Estado | Viewport | Tema | Puntaje | Propiedades en tolerancia | Diferencia de píxeles | Hallazgos |',
    '|---|---|---|---|---|---|---|',
    summaryRows || '| — | — | — | — | — | — | — |',
  ].join('\n');

  const findings = report.findings.length
    ? [
        '| # | Prioridad | Estado | Elemento | Propiedad | Prototipo | Implementación | Diferencia | Tolerancia |',
        '|---|---|---|---|---|---|---|---|---|',
        ...report.findings.map(
          (f) =>
            `| ${f.id} | ${f.priority} | ${f.state} · ${f.viewport} · ${f.theme} | ${cell(f.element)} | \`${cell(f.property)}\` | ${cell(f.prototype)} | ${cell(f.implementation)} | ${f.delta === null ? 'distinto' : `${f.delta} ${f.unit}`.trim()} | ${cell(f.tolerance)} |`
        ),
      ].join('\n')
    : 'Sin hallazgos: todas las propiedades medidas están dentro de la tolerancia.';

  // One correction per element/property/value pair, whatever the number of viewports and themes.
  const groups = new Map();
  for (const f of report.findings) {
    const k = `${f.priority}|${f.element}|${f.property}|${f.prototype}|${f.implementation}`;
    if (!groups.has(k)) groups.set(k, { ...f, ids: [], where: new Set() });
    const g = groups.get(k);
    g.ids.push(f.id);
    g.where.add(`${f.state} · ${f.viewport} · ${f.theme}`);
  }
  const corrections = ['A', 'B', 'C', 'D']
    .map((p) => {
      const items = [...groups.values()].filter((g) => g.priority === p);
      if (!items.length) return `### ${PRIORITY_LABEL[p]} (0)\n\nNada.`;
      return [
        `### ${PRIORITY_LABEL[p]} (${items.length})`,
        '',
        ...items.map((g) => `- ${g.change} Hallazgos ${g.ids.join(', ')}; en ${[...g.where].join('; ')}.`),
      ].join('\n');
    })
    .join('\n\n');

  const images = report.pairs
    .filter((p) => p.pixel)
    .map((p) => `- ${p.key}: [prototipo | implementación | diferencia](${p.pixel.sideBySide}) · [solo diferencia](${p.pixel.diff})`)
    .join('\n') || 'Sin imágenes.';

  let delta = 'Primera medición: no hay una anterior con la que comparar.';
  if (report.delta) {
    const d = report.delta;
    const list = (arr, fn) => (arr.length ? arr.map(fn).join('\n') : '- Ninguno.');
    delta = [
      `Medición anterior: \`${d.previous}\`. Puntaje ${d.before ?? '—'} % → ${d.after ?? '—'} %.`,
      '',
      `**Resueltos (${d.resolved.length})**`,
      '',
      list(d.resolved, (f) => `- ${f.element} \`${f.property}\` (${f.pair}): era ${f.implementation}, objetivo ${f.prototype}.`),
      '',
      `**Siguen abiertos (${d.open.length})**`,
      '',
      list(d.open, (f) => `- ${f.element} \`${f.property}\` (${f.pair}): ${f.before} → ${f.implementation}, objetivo ${f.prototype}.`),
      '',
      `**Nuevos (${d.new.length})**`,
      '',
      list(d.new, (f) => `- ${f.element} \`${f.property}\` (${f.pair}): ${f.implementation}, objetivo ${f.prototype}.`),
      '',
      `**No se volvieron a medir (${d.notRemeasured.length})**`,
      '',
      list(d.notRemeasured, (f) => `- ${f.element} \`${f.property}\` (${f.pair}).`),
    ].join('\n');
  }

  const tolerances = [
    `ΔE2000 ≤ ${t.deltaE} (y alfa ±${t.alpha})`,
    `tamaños y espaciados ±${t.px} px`,
    `tamaño de fuente ±${t.fontSize} px`,
    `peso de fuente ±${t.fontWeight}`,
    `duraciones ±${t.durationMs} ms`,
    `píxeles distintos ≤ ${pct(t.pixelRatio)} fuera de las máscaras (umbral por píxel ${t.pixelThreshold})`,
  ].join(' · ');

  const pending = report.pending.length
    ? [
        'Estos estados no se midieron: no están verificados.',
        '',
        '| Estado | Motivo |',
        '|---|---|',
        ...report.pending.map((p) => `| ${cell(p.state)} | ${cell(p.reason)} |`),
      ].join('\n')
    : 'Ninguno.';

  const anyPair = report.pairs[0];
  const firstMeta = anyPair ? readCapture(config.__out, 'implementation', anyPair.key)?.meta : null;
  const values = {
    fecha: report.generatedAt.slice(0, 10),
    prototipo: config.prototype?.url ?? '—',
    implementacion: config.implementation?.url ?? '—',
    navegador: firstMeta?.browser ? `${firstMeta.executable} ${firstMeta.browser}` : '—',
    puntaje: report.summary.score === null ? '—' : `${report.summary.score} %`,
    medidas: `${report.summary.withinTolerance} de ${report.summary.measured}`,
    tolerancias: tolerances,
    resumen: summary,
    pendientes: pending,
    hallazgos: findings,
    correcciones: corrections,
    imagenes: images,
    delta,
    avisos: report.warnings.length ? report.warnings.map((w) => `- ${w}`).join('\n') : '- Ninguno.',
  };
  return template.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in values ? values[k] : m));
}

/* ------------------------------------------------------------------ main */

const USAGE = `Usage:
  node compare.mjs --config <fidelity.config.json> [--out <dir>] [--previous <old fidelity.json>] [--debug]
  node compare.mjs --help

Options:
  --config <file>     the same fidelity.config.json used by capture-states.mjs
  --out <dir>         folder holding captures/ and receiving the report (default: outDir of the config)
  --previous <file>   an older fidelity.json: adds resolved / new / still open / not re-measured
  --debug             print the stack trace of errors
  -h, --help          this text

Writes fidelity.json and fidelity.md. Exit codes: 0 ok, 1 error, 2 missing dependency,
64 bad usage or arguments.
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(USAGE);
    return;
  }
  assertKnownOptions(args, ['config', 'out', 'previous', 'debug', 'help']);
  requireValue(args, 'config', 'config file');
  const mods = await requireDependencies(['pixelmatch', 'pngjs']);
  const deps = {
    pixelmatch: mods.pixelmatch.default || mods.pixelmatch,
    PNG: mods.pngjs.PNG || mods.pngjs.default?.PNG,
  };
  const config = loadConfig(args.config, args.out);
  const report = measure(config, deps);
  if (args.previous && args.previous !== true) {
    const prevPath = path.resolve(args.previous);
    report.delta = deltaAgainst(JSON.parse(fs.readFileSync(prevPath, 'utf8')), report, path.relative(config.__out, prevPath));
  }
  const templatePath = config.reportTemplate ? path.resolve(config.__dir, config.reportTemplate) : path.join(HERE, 'report-template.md');
  fs.mkdirSync(config.__out, { recursive: true });
  fs.writeFileSync(path.join(config.__out, 'fidelity.json'), JSON.stringify(report, null, 1));
  fs.writeFileSync(path.join(config.__out, 'fidelity.md'), renderMarkdown(report, config, fs.readFileSync(templatePath, 'utf8')));
  const s = report.summary;
  console.log(
    `Fidelity ${s.score ?? '-'}% (${s.withinTolerance}/${s.measured} properties within tolerance), ${s.findings} findings, ` +
      `${s.pixelFailures} pixel-diff failures. Report: ${path.join(config.__out, 'fidelity.md')}`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runCli('compare.mjs', main);
}
