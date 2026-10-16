#!/usr/bin/env node
// Screen space audit: how much of the first viewport is content vs chrome, whether the primary action is
// visible without scrolling, whitespace and text density inside the content, overflow and table usage.
//
//   node space-audit.mjs --config space.json [--out <dir>] [--format json|md]
//   node space-audit.mjs --url <url> [--url <url>]... [--viewport 1440x900]... [--header <css>] [--sidebar <css>]
//        [--footer <css>] [--content <css>] [--primary <css>] [--wait-for <css>] [--storage-state auth.json]
//        [--out <dir>] [--format json|md]
//
// Config: { baseUrl?, storageState?, viewports?: [{name, width, height}], thresholds?: {...},
//           selectors?: {header, sidebar, footer, content, primary}, pages: [{id, url, selectors?, waitFor?}] }
// Defaults: viewports web 1440x900 and phone 390x844 (phone runs as a mobile device); selectors
//   header "header, [role=banner]", sidebar "aside, [role=complementary]", footer "footer, [role=contentinfo]",
//   content "main, [role=main]" (falls back to body), primary "[data-primary]". Chrome elements inside the
//   content element are ignored (an article header is content, not chrome).
// Everything is measured at scroll position 0 (the first screen). Areas are exact unions of rectangles.
//   contentPct   = content area not covered by chrome / viewport area
//   chromePct    = union of header, sidebar and footer / viewport area
//   whitespacePct = share of the visible content area NOT covered by text boxes, images, media or controls
//   textDensity  = visible characters in the content per 10,000 px² of visible content
// Thresholds for flags are conventions (see references/metrics.md) and can be overridden in the config.
// Exit codes: 0 ok · 1 usage or runtime error · 2 playwright-core or browser missing (prints the hint).

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { failOnShowcaseReason, launchBrowser } from './lib/browser.mjs';
import { cell, emit, isMain, runCli } from './lib/cli.mjs';

export const DEFAULT_VIEWPORTS = Object.freeze([
  { name: 'web', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
]);

export const DEFAULT_SELECTORS = Object.freeze({
  header: 'header, [role=banner]',
  sidebar: 'aside, [role=complementary]',
  footer: 'footer, [role=contentinfo]',
  content: 'main, [role=main]',
  primary: '[data-primary]',
});

export const DEFAULT_THRESHOLDS = Object.freeze({
  chromeMaxPctWide: 30,
  chromeMaxPctNarrow: 20,
  narrowBelowPx: 600,
  contentStartMaxPct: 50,
  otherMaxPct: 50,
  whitespaceMaxPct: 90,
  whitespaceMinPct: 40,
  emptyColumnRatio: 0.9,
});

const round = (n, d = 1) => (n == null ? null : Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d);

/** Exact area of the union of rectangles {x, y, width, height} clipped to `clip`. */
export function coveredArea(rects, clip) {
  const rs = [];
  for (const r of rects) {
    const x1 = Math.max(r.x, clip.x);
    const y1 = Math.max(r.y, clip.y);
    const x2 = Math.min(r.x + r.width, clip.x + clip.width);
    const y2 = Math.min(r.y + r.height, clip.y + clip.height);
    if (x2 > x1 && y2 > y1) rs.push([x1, y1, x2, y2]);
  }
  if (!rs.length) return 0;
  const xs = [...new Set(rs.flatMap((r) => [r[0], r[2]]))].sort((a, b) => a - b);
  let area = 0;
  for (let i = 0; i < xs.length - 1; i += 1) {
    const xa = xs[i];
    const xb = xs[i + 1];
    const spans = rs.filter((r) => r[0] <= xa && r[2] >= xb).map((r) => [r[1], r[3]]).sort((a, b) => a[0] - b[0]);
    let len = 0;
    let start = -Infinity;
    let end = -Infinity;
    for (const [s, e] of spans) {
      if (s > end) {
        if (end > start) len += end - start;
        start = s;
        end = e;
      } else if (e > end) {
        end = e;
      }
    }
    if (end > start) len += end - start;
    area += len * (xb - xa);
  }
  return area;
}

/* Runs in the page at scroll position 0. */
function measure(sel) {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const box = (r) => ({ x: r.left, y: r.top, width: r.width, height: r.height });
  const visible = (el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0 && r.width > 0 && r.height > 0;
  };
  const q = (s) => { try { return s ? [...document.querySelectorAll(s)] : []; } catch { return []; } };
  const contentEl = q(sel.content).find(visible) || null;
  const root = contentEl || document.body;
  const chrome = [sel.header, sel.sidebar, sel.footer]
    .flatMap(q)
    .filter((el) => visible(el) && !(contentEl && contentEl.contains(el)) && !(contentEl && el.contains(contentEl)))
    .map((el) => box(el.getBoundingClientRect()));

  const inVp = (r) => r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw && r.width > 0 && r.height > 0;
  const ink = [];
  let chars = 0;
  let firstInkTop = null;
  const noteTop = (r) => { if (firstInkTop == null || r.top < firstInkTop) firstInkTop = r.top; };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue.trim() && n.parentElement && visible(n.parentElement) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    range.selectNodeContents(n);
    let counted = false;
    for (const r of range.getClientRects()) {
      noteTop(r);
      if (!inVp(r)) continue;
      ink.push(box(r));
      if (!counted) { chars += n.nodeValue.replace(/\s+/g, '').length; counted = true; }
    }
  }
  for (const el of root.querySelectorAll('img, svg, canvas, video, picture, iframe, object, [role=img], input, select, textarea, button, progress, meter')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    noteTop(r);
    if (inVp(r)) ink.push(box(r));
  }

  const primaryEl = q(sel.primary).find(visible) || null;
  const primary = primaryEl ? box(primaryEl.getBoundingClientRect()) : null;

  const tables = [];
  for (const t of root.querySelectorAll('table, [role=table], [role=grid]')) {
    if (!visible(t)) continue;
    const isAria = t.tagName !== 'TABLE';
    const rows = isAria ? [...t.querySelectorAll('[role=row]')] : [...t.rows];
    const cellsOf = (row) => (isAria ? [...row.querySelectorAll('[role=columnheader], [role=cell], [role=gridcell], [role=rowheader]')] : [...row.cells]);
    const headerRow = isAria
      ? rows.find((r) => r.querySelector('[role=columnheader]'))
      : (t.tHead && t.tHead.rows[0]) || rows[0];
    const body = rows.filter((r) => r !== headerRow);
    const columns = Math.max(0, ...rows.map((r) => cellsOf(r).length));
    const headers = headerRow ? cellsOf(headerRow).map((c) => c.innerText.trim()) : [];
    const emptyRatio = [];
    for (let c = 0; c < columns; c += 1) {
      const cells = body.map((r) => cellsOf(r)[c]).filter(Boolean);
      const empty = cells.filter((x) => !x.innerText.trim()).length;
      emptyRatio.push(cells.length ? empty / cells.length : 0);
    }
    let scroller = t.parentElement;
    while (scroller && scroller !== document.body && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowX)) scroller = scroller.parentElement;
    const tr = t.getBoundingClientRect();
    const overflowX = scroller && scroller !== document.body ? scroller.scrollWidth > scroller.clientWidth + 1 : tr.right > vw + 1;
    const contentWidth = (contentEl || document.body).getBoundingClientRect().width;
    tables.push({ columns, rows: body.length, headers, emptyRatio, widthPct: contentWidth ? (tr.width / contentWidth) * 100 : null, overflowX });
  }

  return {
    vw,
    vh,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0),
    contentFound: Boolean(contentEl),
    content: box(root.getBoundingClientRect()),
    chrome,
    ink,
    chars,
    firstInkTop,
    primaryConfigured: Boolean(sel.primary),
    primary,
    tables,
  };
}

/** Turn raw page measurements into metrics and flags. */
export function summarize(raw, viewport, thresholds = DEFAULT_THRESHOLDS) {
  const th = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const vp = { x: 0, y: 0, width: raw.vw, height: raw.vh };
  const vpArea = raw.vw * raw.vh;
  const chromeArea = coveredArea(raw.chrome, vp);
  const contentAll = coveredArea([raw.content, ...raw.chrome], vp);
  const contentArea = Math.max(0, contentAll - chromeArea);
  const contentClip = {
    x: Math.max(0, raw.content.x),
    y: Math.max(0, raw.content.y),
    width: Math.min(raw.vw, raw.content.x + raw.content.width) - Math.max(0, raw.content.x),
    height: Math.min(raw.vh, raw.content.y + raw.content.height) - Math.max(0, raw.content.y),
  };
  const contentVisible = contentClip.width > 0 && contentClip.height > 0 ? contentClip.width * contentClip.height : 0;
  const inkArea = contentVisible ? coveredArea(raw.ink, contentClip) : 0;
  const narrow = raw.vw < th.narrowBelowPx;

  const p = raw.primary;
  const primary = p
    ? {
      found: true,
      top: round(p.y),
      bottom: round(p.y + p.height),
      aboveFold: p.y >= 0 && p.y + p.height <= raw.vh && p.x >= 0 && p.x + p.width <= raw.vw,
      scrollPx: round(Math.max(0, p.y + p.height - raw.vh)),
    }
    : { found: false, aboveFold: false, scrollPx: null };

  const tables = raw.tables.map((t) => ({
    columns: t.columns,
    rows: t.rows,
    headers: t.headers,
    emptyColumns: t.emptyRatio.map((r, i) => (t.rows > 0 && r >= th.emptyColumnRatio ? t.headers[i] || `#${i + 1}` : null)).filter(Boolean),
    widthPct: round(t.widthPct),
    overflowX: t.overflowX,
  }));

  const result = {
    viewport,
    measured: { width: raw.vw, height: raw.vh },
    contentFound: raw.contentFound,
    contentPct: round((contentArea / vpArea) * 100),
    chromePct: round((chromeArea / vpArea) * 100),
    otherPct: round(Math.max(0, 100 - ((contentArea + chromeArea) / vpArea) * 100)),
    whitespacePct: contentVisible ? round((1 - inkArea / contentVisible) * 100) : null,
    textDensity: contentVisible ? round(raw.chars / (contentVisible / 10000), 1) : null,
    primary,
    contentStartPx: raw.firstInkTop == null ? null : round(raw.firstInkTop),
    contentStartPct: raw.firstInkTop == null ? null : round((raw.firstInkTop / raw.vh) * 100),
    pageScreens: round(raw.scrollHeight / raw.vh, 2),
    horizontalOverflow: raw.scrollWidth > raw.vw + 1,
    tables,
    flags: [],
  };

  const f = result.flags;
  if (raw.primaryConfigured && !primary.found) f.push('primary-not-found');
  if (primary.found && !primary.aboveFold) f.push('primary-below-fold');
  if (result.chromePct > (narrow ? th.chromeMaxPctNarrow : th.chromeMaxPctWide)) f.push('chrome-heavy');
  if (result.horizontalOverflow) f.push('horizontal-overflow');
  if (result.otherPct > th.otherMaxPct) f.push('viewport-underused');
  if (result.contentStartPct != null && result.contentStartPct > th.contentStartMaxPct) f.push('content-starts-low');
  if (result.whitespacePct != null && result.whitespacePct > th.whitespaceMaxPct) f.push('sparse-content');
  if (result.whitespacePct != null && result.whitespacePct < th.whitespaceMinPct) f.push('dense-content');
  if (tables.some((t) => t.emptyColumns.length)) f.push('table-empty-columns');
  if (tables.some((t) => t.overflowX)) f.push('table-overflow');
  if (!raw.contentFound) f.push('content-selector-not-found');
  return result;
}

function parseViewport(text, i) {
  const m = String(text).match(/^(\d+)x(\d+)$/);
  if (!m) throw new Error(`--viewport must look like 1440x900 (got ${text})`);
  const width = Number(m[1]);
  return { name: width < 600 ? `phone-${i + 1}` : `web-${i + 1}`, width, height: Number(m[2]) };
}

async function audit(browser, config) {
  const results = [];
  const viewports = config.viewports?.length ? config.viewports : DEFAULT_VIEWPORTS;
  for (const viewport of viewports) {
    const mobile = viewport.width < (config.thresholds?.narrowBelowPx ?? DEFAULT_THRESHOLDS.narrowBelowPx);
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.mobile ?? mobile,
      hasTouch: viewport.mobile ?? mobile,
      reducedMotion: 'reduce',
      ...(config.storageState ? { storageState: config.storageState } : {}),
    });
    const page = await context.newPage();
    for (const pg of config.pages) {
      const url = config.baseUrl ? new URL(pg.url, config.baseUrl).href : pg.url;
      const sel = { ...DEFAULT_SELECTORS, ...(config.selectors ?? {}), ...(pg.selectors ?? {}) };
      await page.goto(url, { waitUntil: 'load', timeout: config.timeout ?? 30000 });
      await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
      await failOnShowcaseReason(page);
      if (pg.waitFor ?? config.waitFor) await page.waitForSelector(pg.waitFor ?? config.waitFor, { timeout: config.timeout ?? 30000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const raw = await page.evaluate(measure, sel);
      results.push({ page: pg.id ?? url, url, ...summarize(raw, viewport, config.thresholds) });
    }
    await context.close();
  }
  return results;
}

const yes = (b) => (b ? 'sí' : 'no');

/** Render the report as Markdown (neutral Spanish). */
export function toMarkdown(report) {
  const L = [
    '# Uso del espacio de pantalla',
    '',
    `Generado: ${report.generatedAt}. Medido en la primera pantalla (sin scroll). Umbrales: convenciones, ver metrics.md.`,
    '',
    '| Pantalla | Viewport | Contenido % | Cromo % | Resto % | Sin uso en contenido % | Densidad de texto | Acción principal visible | Scroll hasta la acción (px) | Inicio del contenido (px) | Alto (pantallas) | Desborde horizontal | Señales |',
    '|---|---|--:|--:|--:|--:|--:|---|--:|--:|--:|---|---|',
    ...report.results.map((r) => `| ${cell(r.page)} | ${r.viewport.name} ${r.measured.width}×${r.measured.height} | ${r.contentPct} | ${r.chromePct} | ${r.otherPct} | ${r.whitespacePct ?? '—'} | ${r.textDensity ?? '—'} | ${r.primary.found ? yes(r.primary.aboveFold) : 'no encontrada'} | ${r.primary.scrollPx ?? '—'} | ${r.contentStartPx ?? '—'} | ${r.pageScreens} | ${yes(r.horizontalOverflow)} | ${r.flags.join(', ') || '—'} |`),
  ];
  const tableRows = report.results.flatMap((r) => r.tables.map((t, i) => `| ${cell(r.page)} | ${r.viewport.name} | ${i + 1} | ${t.columns} | ${t.rows} | ${t.widthPct ?? '—'} | ${cell(t.emptyColumns.join(', ') || '—')} | ${yes(t.overflowX)} |`));
  if (tableRows.length) {
    L.push('', '## Tablas', '', '| Pantalla | Viewport | Tabla | Columnas | Filas | Ancho usado % | Columnas casi vacías | Desborde |', '|---|---|--:|--:|--:|--:|---|---|', ...tableRows);
  }
  return `${L.join('\n')}\n`;
}

async function main() {
  const { values } = parseArgs({
    options: {
      config: { type: 'string' },
      url: { type: 'string', multiple: true },
      viewport: { type: 'string', multiple: true },
      header: { type: 'string' },
      sidebar: { type: 'string' },
      footer: { type: 'string' },
      content: { type: 'string' },
      primary: { type: 'string' },
      'wait-for': { type: 'string' },
      'storage-state': { type: 'string' },
      out: { type: 'string' },
      format: { type: 'string', default: 'json' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help || (!values.config && !values.url?.length)) {
    process.stderr.write('Usage: node space-audit.mjs --config space.json | --url <url> [--viewport WxH]... [--header|--sidebar|--footer|--content|--primary <css>] [--out <dir>] [--format json|md]\n');
    return values.help ? 0 : 1;
  }
  if (!['json', 'md'].includes(values.format)) throw new Error('--format must be json or md');
  const config = values.config ? JSON.parse(readFileSync(values.config, 'utf8')) : { pages: [] };
  if (values.url?.length) config.pages = [...(config.pages ?? []), ...values.url.map((u) => ({ id: u, url: u }))];
  if (values.viewport?.length) config.viewports = values.viewport.map(parseViewport);
  const flagSelectors = Object.fromEntries(['header', 'sidebar', 'footer', 'content', 'primary'].filter((k) => values[k]).map((k) => [k, values[k]]));
  config.selectors = { ...(config.selectors ?? {}), ...flagSelectors };
  if (values['wait-for']) config.waitFor = values['wait-for'];
  if (values['storage-state']) config.storageState = values['storage-state'];
  if (!Array.isArray(config.pages) || !config.pages.length) throw new Error('No pages to audit: pass --url or a config with pages.');
  for (const pg of config.pages) {
    try { new URL(pg.url, config.baseUrl); } catch { throw new Error(`Invalid URL: ${pg.url}`); }
  }

  const browser = await launchBrowser();
  let results;
  try {
    results = await audit(browser, config);
  } finally {
    await browser.close();
  }
  const report = {
    tool: 'ux-flow-audit/space-audit',
    generatedAt: new Date().toISOString(),
    thresholds: { ...DEFAULT_THRESHOLDS, ...(config.thresholds ?? {}) },
    results,
  };
  emit(report, toMarkdown(report), { out: values.out, format: values.format, name: 'space-audit' });
  return 0;
}

if (isMain(import.meta.url)) await runCli(main);
