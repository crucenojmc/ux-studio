#!/usr/bin/env node
// Accessibility audit (WCAG 2.2, automatic and partial): contrast, keyboard, names, structure, target size, reduced motion.
//
// Usage:
//   node a11y-audit.mjs --url <http-url>... [--storage-state [role=]auth.json]... [--platform web|phone|both] [--scope <css>] [--out <dir>]
//   node a11y-audit.mjs --showcase <http-url> [--role <id>]... [--screen <id>]... [--platform web|phone|both] [--scope <css>] [--out <dir>]
//
// Needs playwright-core and an installed Chromium-family browser (never downloaded). axe-core is optional: when it resolves
// like playwright-core (cwd, NODE_PATH, global npm root, next to this script) its violations are merged, labelled `axe`.
// Writes <out>/a11y.json and <out>/a11y.md (default out: tmp/ux-audit/ under the working directory). The caller gives a
// unique --out per invocation; two runs with different --out never touch the same file.
// Exit: 0 ok · 1 runtime error · 2 missing playwright-core or browser · 64 usage error.
// Loads only the pages it is given; it never crawls. Point it at local or test environments, never production.

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { EXIT, UsageError, cell, emit, isMain, runCli } from './lib/cli.mjs';
import { failOnShowcaseReason, launchBrowser, resolveDependency } from './lib/browser.mjs';

export const DISCLAIMER = 'verificación automática parcial: no demuestra conformidad con WCAG; lo que exige criterio humano está en «Requiere revisión humana».';

const VIEWPORTS = {
  web: { name: 'web', width: 1440, height: 900 },
  phone: { name: 'phone', width: 390, height: 844, mobile: true },
};

/**
 * Runs in the page. Installs window.__uxA11y (for the Tab walk) and returns the static findings.
 * Self-contained on purpose: Playwright serialises it.
 */
function pageAudit({ scope }) {
  const root = (scope && document.querySelector(scope)) || document.body;
  const findings = [];
  const needsHuman = [];
  const add = (rule, wcag, severity, el, evidence) => findings.push({ rule, wcag, severity, selector: selectorOf(el), evidence });

  function selectorOf(el) {
    if (el === document.documentElement) return 'html';
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    for (let n = el; n && n.nodeType === 1 && n !== document.documentElement; n = n.parentElement) {
      if (n.id) { parts.unshift(`#${CSS.escape(n.id)}`); break; }
      const same = [...n.parentElement.children].filter((c) => c.tagName === n.tagName);
      parts.unshift(same.length > 1 ? `${n.tagName.toLowerCase()}:nth-of-type(${same.indexOf(n) + 1})` : n.tagName.toLowerCase());
    }
    return parts.join(' > ');
  }
  const cs = (el, pseudo) => getComputedStyle(el, pseudo);
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = cs(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0;
  };
  const hiddenFromAT = (el) => !!el.closest('[aria-hidden="true"], [hidden], [inert]');
  const all = (sel) => [...root.querySelectorAll(sel)];

  // ---- colour --------------------------------------------------------------------------------------------------
  function parseColor(str) {
    if (!str) return null;
    if (str === 'transparent') return [0, 0, 0, 0];
    let m = str.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    }
    m = str.match(/^color\(srgb ([^)]+)\)$/);
    if (m) {
      const p = m[1].split(/[\s/]+/).filter(Boolean).map(Number);
      return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1];
    }
    return null;
  }
  const over = (top, bottom) => {
    const a = top[3] + bottom[3] * (1 - top[3]);
    if (a === 0) return [0, 0, 0, 0];
    return [0, 1, 2].map((i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a).concat(a);
  };
  const lum = ([r, g, b]) => {
    const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const rgb = (c) => `rgb(${c.slice(0, 3).map(Math.round).join(', ')})`;
  /** Opaque background behind an element, resolving transparent layers up the tree. */
  function backgroundOf(el) {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const s = cs(n);
      if (s.backgroundImage !== 'none') return { indeterminate: 'imagen o degradado de fondo' };
      const c = parseColor(s.backgroundColor);
      if (!c) return { indeterminate: 'color de fondo en un formato no soportado' };
      if (c[3] > 0) layers.push(c);
      if (c[3] >= 1) break;
    }
    let out = [255, 255, 255, 1];
    for (const l of layers.reverse()) out = over(l, out);
    return { color: out };
  }
  const opacityOf = (el) => { let o = 1; for (let n = el; n; n = n.parentElement) o *= Number(cs(n).opacity); return o; };

  // ---- contrast (1.4.3, 1.4.11) -------------------------------------------------------------------------------
  const skipText = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'OPTION', 'TITLE']);
  const indeterminate = new Map(); // reason -> selectors
  const skipped = (reason, el) => { if (!indeterminate.has(reason)) indeterminate.set(reason, []); const l = indeterminate.get(reason); if (l.length < 5) l.push(selectorOf(el)); };
  const shadowBound = [];
  for (const el of [root, ...root.querySelectorAll('*')]) {
    if (skipText.has(el.tagName) || el.closest('svg')) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own || !visible(el) || el.matches(':disabled') || el.closest('fieldset[disabled]') || el.getAttribute('aria-disabled') === 'true') continue;
    const s = cs(el);
    const bg = backgroundOf(el);
    if (bg.indeterminate) { skipped(bg.indeterminate, el); continue; }
    const fg = parseColor(s.color);
    if (!fg) { skipped('color de texto en un formato no soportado', el); continue; }
    const eff = over([fg[0], fg[1], fg[2], fg[3] * opacityOf(el)], bg.color);
    const size = parseFloat(s.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700);
    const min = large ? 3 : 4.5;
    const r = ratio(eff, bg.color);
    if (r < min) add('contrast-text', '1.4.3', 'serious', el, `medido ${r.toFixed(2)}:1, mínimo ${min}:1 (texto ${large ? 'grande' : 'normal'} ${size}px; ${rgb(eff)} sobre ${rgb(bg.color)})`);
  }
  if (indeterminate.size) needsHuman.push({ topic: 'Contraste que no se pudo calcular', why: `${[...indeterminate].map(([reason, sels]) => `${reason} (${sels.join(', ')})`).join('; ')}. Medirlo a mano en los puntos más claros y más oscuros.` });

  const notBox = new Set(['checkbox', 'radio', 'hidden', 'range', 'color', 'file', 'image']);
  for (const el of all('input, select, textarea, button')) {
    if (!visible(el) || el.matches(':disabled') || el.closest('fieldset[disabled]')) continue;
    const isField = el.tagName !== 'BUTTON' && !(el.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes(el.type));
    if (el.tagName === 'INPUT' && notBox.has(el.type)) continue;
    const s = cs(el);
    const parentBg = backgroundOf(el.parentElement);
    const ownBg = backgroundOf(el);
    if (parentBg.indeterminate || ownBg.indeterminate) continue;
    const side = ['Top', 'Right', 'Bottom', 'Left'].find((x) => parseFloat(s[`border${x}Width`]) > 0 && !['none', 'hidden'].includes(s[`border${x}Style`]));
    const border = side ? parseColor(s[`border${side}Color`]) : null;
    const borderRatio = border && border[3] > 0 ? ratio(over(border, parentBg.color), parentBg.color) : 1;
    const fillRatio = ratio(ownBg.color, parentBg.color);
    if (!isField && fillRatio >= 1.1) continue; // a filled button is identified by its fill and label, not by an outline
    if (!isField && !side) continue;
    if (borderRatio >= 3 || fillRatio >= 3) continue;
    if (s.boxShadow !== 'none') { if (shadowBound.length < 5) shadowBound.push(selectorOf(el)); continue; } // boundary drawn by a shadow or ring: not decidable here
    add('contrast-ui', '1.4.11', 'serious', el, `borde ${borderRatio.toFixed(2)}:1 y relleno ${fillRatio.toFixed(2)}:1 contra el fondo contiguo, mínimo 3:1`);
  }

  if (shadowBound.length) needsHuman.push({ topic: 'Límite del control dado por sombra', why: `El borde es una sombra o anillo (${shadowBound.join(', ')}): medir a mano su contraste contra el fondo (mínimo 3:1).` });

  // ---- accessible names (4.1.2, 1.1.1, 2.4.4, 1.3.1) ---------------------------------------------------------
  function textFrom(el, depth = 0) {
    if (depth > 8 || el.nodeType !== 1) return el.nodeType === 3 ? el.textContent : '';
    if (el.getAttribute('aria-hidden') === 'true' || cs(el).display === 'none') return '';
    const label = el.getAttribute('aria-label');
    if (label && label.trim()) return label;
    if (el.tagName === 'IMG') return el.getAttribute('alt') ?? '';
    if (el.tagName === 'svg') return el.querySelector(':scope > title')?.textContent ?? '';
    if (el.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes(el.type)) return el.value;
    return [...el.childNodes].map((n) => textFrom(n, depth + 1)).join(' ');
  }
  function nameOf(el) {
    const by = el.getAttribute('aria-labelledby');
    if (by) {
      const t = by.split(/\s+/).map((id) => document.getElementById(id)).filter(Boolean).map((n) => textFrom(n)).join(' ').trim();
      if (t) return t;
    }
    const label = el.getAttribute('aria-label')?.trim();
    if (label) return label;
    if (el.labels?.length) {
      const t = [...el.labels].map((l) => textFrom(l)).join(' ').trim();
      if (t) return t;
    }
    if (el.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes(el.type) && el.value) return el.value;
    if (el.tagName === 'INPUT' && el.type === 'image') return el.getAttribute('alt')?.trim() ?? '';
    if (el.tagName === 'IMG') return el.getAttribute('alt')?.trim() ?? '';
    if (el.tagName === 'svg') return el.querySelector(':scope > title')?.textContent.trim() ?? '';
    const t = [...el.childNodes].map((n) => textFrom(n)).join(' ').trim();
    return t || el.getAttribute('title')?.trim() || '';
  }
  const checkable = (el) => visible(el) && !hiddenFromAT(el);
  for (const el of all('button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"]')) {
    if (!checkable(el) || nameOf(el)) continue;
    const icon = el.querySelector('svg, img, i, [class*="icon"]') ? 'botón solo con icono (icon-only), sin nombre accesible' : 'botón sin nombre accesible';
    add('button-name', '4.1.2', 'serious', el, icon);
  }
  for (const el of all('a[href], [role="link"]')) {
    if (!checkable(el) || nameOf(el)) continue;
    add('link-name', '2.4.4', 'serious', el, 'enlace sin nombre accesible');
  }
  for (const el of all('input, select, textarea')) {
    if (!checkable(el) || (el.tagName === 'INPUT' && ['hidden', 'button', 'submit', 'reset', 'image'].includes(el.type)) || nameOf(el)) continue;
    add('input-label', '1.3.1', 'serious', el, 'campo sin etiqueta (label, aria-label ni aria-labelledby)');
  }
  for (const el of all('img, [role="img"], input[type="image"]')) {
    if (!checkable(el) || ['presentation', 'none'].includes(el.getAttribute('role'))) continue;
    if (el.tagName === 'IMG' && el.hasAttribute('alt')) continue;
    if (!nameOf(el)) add('img-alt', '1.1.1', 'serious', el, el.tagName === 'IMG' ? 'imagen sin atributo alt' : 'imagen sin nombre accesible');
  }

  // ---- structure (3.1.1, 1.3.1, 4.1.2) ------------------------------------------------------------------------
  if (!document.documentElement.getAttribute('lang')?.trim()) add('html-lang', '3.1.1', 'serious', document.documentElement, 'el elemento html no declara lang');
  let prevLevel = null;
  for (const h of all('h1, h2, h3, h4, h5, h6, [role="heading"]')) {
    if (!checkable(h)) continue;
    const level = h.tagName[0] === 'H' && h.tagName.length === 2 ? Number(h.tagName[1]) : Number(h.getAttribute('aria-level')) || 2;
    if (prevLevel !== null && level > prevLevel + 1) add('heading-order', '1.3.1', 'moderate', h, `salta de h${prevLevel} a h${level}`);
    prevLevel = level;
  }
  const idCount = new Map();
  for (const el of document.querySelectorAll('[id]')) idCount.set(el.id, (idCount.get(el.id) ?? 0) + 1);
  for (const [id, n] of idCount) if (n > 1 && id) add('duplicate-id', '4.1.2', 'moderate', root.querySelector(`[id="${CSS.escape(id)}"]`) ?? document.getElementById(id), `id "${id}" repetido ${n} veces`);

  const ROLES = new Set('alert alertdialog application article banner blockquote button caption cell checkbox code columnheader combobox complementary contentinfo definition deletion dialog directory document emphasis feed figure form generic grid gridcell group heading img insertion link list listbox listitem log main marquee math menu menubar menuitem menuitemcheckbox menuitemradio meter navigation none note option paragraph presentation progressbar radio radiogroup region row rowgroup rowheader scrollbar search searchbox separator slider spinbutton status strong subscript superscript switch tab table tablist tabpanel term textbox time timer toolbar tooltip tree treegrid treeitem'.split(' '));
  const ARIA = new Set('activedescendant atomic autocomplete busy checked colcount colindex colspan controls current describedby details disabled errormessage expanded flowto haspopup hidden invalid keyshortcuts label labelledby level live modal multiline multiselectable orientation owns placeholder posinset pressed readonly relevant required roledescription rowcount rowindex rowspan selected setsize sort valuemax valuemin valuenow valuetext'.split(' '));
  const REQUIRED = { checkbox: ['checked'], switch: ['checked'], radio: ['checked'], menuitemcheckbox: ['checked'], menuitemradio: ['checked'], slider: ['valuenow'], scrollbar: ['valuenow', 'controls'], heading: [] };
  for (const el of root.querySelectorAll('*')) {
    const role = el.getAttribute('role')?.trim().split(/\s+/)[0];
    if (role && !ROLES.has(role)) add('aria-invalid-role', '4.1.2', 'serious', el, `role="${role}" no es un rol ARIA válido`);
    for (const a of el.attributes) {
      if (!a.name.startsWith('aria-')) continue;
      const name = a.name.slice(5);
      if (!ARIA.has(name)) add('aria-invalid-attr', '4.1.2', 'serious', el, `${a.name} no es un atributo ARIA válido`);
      if (['labelledby', 'describedby', 'controls', 'owns', 'activedescendant', 'flowto', 'details', 'errormessage'].includes(name)) {
        const missing = a.value.split(/\s+/).filter((id) => id && !document.getElementById(id));
        if (missing.length) add('aria-ref-missing', '4.1.2', 'serious', el, `${a.name} apunta a ids que no existen: ${missing.join(', ')}`);
      }
    }
    if (role && REQUIRED[role]) {
      const lacking = REQUIRED[role].filter((a) => !el.hasAttribute(`aria-${a}`));
      if (lacking.length && el.tagName !== 'INPUT') add('aria-required-attr', '4.1.2', 'serious', el, `role="${role}" requiere ${lacking.map((a) => `aria-${a}`).join(', ')}`);
    }
  }
  const FOCUSABLE = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [contenteditable="true"], [tabindex]';
  for (const hid of all('[aria-hidden="true"]')) {
    const inner = [...hid.querySelectorAll(FOCUSABLE)].concat(hid.matches(FOCUSABLE) ? [hid] : []).find((f) => !f.matches(':disabled') && f.getAttribute('tabindex') !== '-1');
    if (inner) add('aria-hidden-focusable', '4.1.2', 'serious', inner, 'elemento enfocable dentro de aria-hidden="true"');
  }

  // ---- target size (2.5.8) ------------------------------------------------------------------------------------
  const TARGET = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="checkbox"], [role="switch"], [role="tab"], [role="menuitem"], [role="radio"], [onclick]';
  const targets = all(TARGET).filter((el) => visible(el) && !(el.tagName === 'A' && cs(el).display === 'inline')).map((el) => ({ el, r: el.getBoundingClientRect() }));
  const small = (t) => t.r.width < 24 || t.r.height < 24;
  const center = (r) => [r.left + r.width / 2, r.top + r.height / 2];
  for (const t of targets.filter(small)) {
    const [cx, cy] = center(t.r);
    const clash = targets.some((o) => {
      if (o === t) return false;
      if (small(o)) { const [ox, oy] = center(o.r); return Math.hypot(cx - ox, cy - oy) < 24; }
      const nx = Math.max(o.r.left, Math.min(cx, o.r.right));
      const ny = Math.max(o.r.top, Math.min(cy, o.r.bottom));
      return Math.hypot(cx - nx, cy - ny) < 12;
    });
    if (clash) add('target-size', '2.5.8', 'moderate', t.el, `${Math.round(t.r.width * 10) / 10}×${Math.round(t.r.height * 10) / 10} px, mínimo 24×24 px, sin separación suficiente respecto de otros objetivos`);
  }

  // ---- keyboard helpers for the Tab walk (2.1.1, 2.1.2, 2.4.7) ------------------------------------------------
  const ids = new WeakMap();
  let nextId = 0;
  const idOf = (el) => { if (!ids.has(el)) ids.set(el, (nextId += 1)); return ids.get(el); };
  const look = (el) => {
    const s = cs(el);
    const sides = ['Top', 'Right', 'Bottom', 'Left'].map((x) => `${s[`border${x}Width`]} ${s[`border${x}Style`]} ${s[`border${x}Color`]}`).join('|');
    return { bg: s.backgroundColor, outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`, outlineOn: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0, shadow: s.boxShadow, border: sides };
  };
  const interactive = 'a[href], button, input:not([type="hidden"]):not([type="radio"]), select, textarea, summary, [role="button"], [role="link"], [role="checkbox"], [role="switch"], [role="tab"], [role="menuitem"], [onclick]';
  const composite = '[role="tablist"], [role="menu"], [role="menubar"], [role="toolbar"], [role="listbox"], [role="radiogroup"], [role="grid"], [role="tree"]';
  const candidates = all(interactive).filter((el) => visible(el) && !el.matches(':disabled') && !hiddenFromAT(el) && !el.closest(composite) && !el.querySelector(FOCUSABLE));
  const before = new Map();
  for (const el of all(FOCUSABLE)) before.set(idOf(el), look(el));
  window.__uxA11y = {
    selectorOf,
    candidates: candidates.map((el) => ({ id: idOf(el), selector: selectorOf(el), tabindex: el.getAttribute('tabindex'), native: el.matches('a[href], button, input, select, textarea, summary') })),
    active() {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      return { id: idOf(el), selector: selectorOf(el), inScope: root.contains(el), before: before.get(idOf(el)) ?? null, after: look(el) };
    },
    reset() { document.activeElement?.blur?.(); window.scrollTo(0, 0); },
    tabbableCount: all(FOCUSABLE).length,
  };

  if (document.querySelector('video, audio')) needsHuman.push({ topic: 'Subtítulos y alternativas de medios', why: 'La página incluye video o audio: la calidad de subtítulos, transcripción y audiodescripción (1.2.x) no se verifica sola.' });
  return { findings, needsHuman };
}

/** Runs in the page, after prefers-reduced-motion: reduce was emulated. */
function motionAudit() {
  const selectorOf = (el) => {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    for (let n = el; n && n.nodeType === 1 && n !== document.documentElement; n = n.parentElement) {
      if (n.id) { parts.unshift(`#${CSS.escape(n.id)}`); break; }
      const same = [...n.parentElement.children].filter((c) => c.tagName === n.tagName);
      parts.unshift(same.length > 1 ? `${n.tagName.toLowerCase()}:nth-of-type(${same.indexOf(n) + 1})` : n.tagName.toLowerCase());
    }
    return parts.join(' > ');
  };
  const running = new Map();
  for (const a of document.getAnimations()) {
    const el = a.effect?.target;
    if (!el || a.playState !== 'running' || a.effect.pseudoElement) continue;
    const t = a.effect.getComputedTiming();
    if (!(t.activeDuration > 0)) continue;
    const name = a.animationName ?? a.transitionProperty ?? 'animación';
    if (!running.has(el)) running.set(el, { name, infinite: t.iterations === Infinity, seconds: Math.round(t.duration / 100) / 10 });
  }
  const motion = [...running].map(([el, v]) => ({ selector: selectorOf(el), ...v }));
  const transitions = [];
  for (const el of document.querySelectorAll('body *')) {
    const s = getComputedStyle(el);
    const secs = s.transitionDuration.split(',').map((x) => parseFloat(x));
    const props = s.transitionProperty.split(',').map((x) => x.trim());
    if (secs.some((x) => x > 0) && !props.every((p) => p === 'none')) transitions.push(selectorOf(el));
  }
  return { motion, transitions };
}

async function auditPage(page, { scope, axe, withAxe }) {
  const { findings, needsHuman } = await page.evaluate(pageAudit, { scope });
  const notes = [];

  // Tab walk: reachability, traps, visible focus.
  await page.evaluate(() => window.__uxA11y.reset());
  const info = await page.evaluate(() => ({ candidates: window.__uxA11y.candidates, max: window.__uxA11y.tabbableCount }));
  const visited = new Set();
  let first = null;
  let previous = null;
  let completed = false;
  let trapped = false;
  const bgOnly = [];
  for (let i = 0; i < Math.min(info.max + 3, 400); i += 1) {
    await page.keyboard.press('Tab');
    const cur = await page.evaluate(() => window.__uxA11y.active());
    if (!cur) { completed = true; break; }
    if (previous === cur.id || (visited.has(cur.id) && cur.id !== first)) {
      findings.push({ rule: 'kbd-trap', wcag: '2.1.2', severity: 'serious', selector: cur.selector, evidence: previous === cur.id ? 'Tab no saca el foco de este elemento' : 'el foco circula en un ciclo sin llegar al resto de la página' });
      trapped = true;
      break;
    }
    if (visited.has(cur.id)) { completed = true; break; }
    if (first === null) first = cur.id;
    visited.add(cur.id);
    previous = cur.id;
    if (cur.inScope && cur.before) {
      const b = cur.before;
      const a = cur.after;
      const visibleRing = (a.outlineOn && a.outline !== b.outline) || (a.shadow !== b.shadow && a.shadow !== 'none') || a.border !== b.border;
      if (!visibleRing && a.bg !== b.bg) {
        bgOnly.push(cur.selector);
      } else if (!visibleRing) {
        findings.push({ rule: 'kbd-focus-invisible', wcag: '2.4.7', severity: 'serious', selector: cur.selector, evidence: `sin cambio visible de outline, box-shadow ni borde al enfocar (outline: ${a.outline}; box-shadow: ${a.shadow})` });
      }
    }
  }
  if (!trapped && !completed) completed = true;
  const negative = [];
  if (!trapped) {
    for (const c of info.candidates) {
      if (visited.has(c.id)) continue;
      if (c.native) { negative.push(c.selector); continue; }
      const why = 'control personalizado sin tabindex: no recibe foco con el teclado';
      findings.push({ rule: 'kbd-unreachable', wcag: '2.1.1', severity: 'serious', selector: c.selector, evidence: why });
    }
  } else {
    notes.push('Se detectó una trampa de teclado: no se evaluó qué elementos quedan inalcanzables.');
  }

  if (negative.length) needsHuman.push({ topic: 'Controles nativos con tabindex negativo', why: `Tab no llega a ${negative.join(', ')}. Puede ser intencional (se opera por otro medio o dentro de un widget); confirmar que existe un camino por teclado.` });
  if (bgOnly.length) needsHuman.push({ topic: 'Foco indicado solo por el fondo', why: `Al enfocar solo cambia el color de fondo (${bgOnly.slice(0, 5).join(', ')}); confirmar a ojo que el cambio es perceptible (2.4.7, 1.4.11).` });

  if (withAxe) {
    try {
      await page.addScriptTag({ content: axe.source });
      const result = await page.evaluate(async (sel) => window.axe.run(sel ? (document.querySelector(sel) ?? document) : document, { resultTypes: ['violations'] }), scope ?? null);
      for (const v of result.violations) {
        const tag = (v.tags ?? []).map((t) => t.match(/^wcag(\d)(\d)(\d+)$/)).find(Boolean);
        for (const n of v.nodes) {
          findings.push({
            rule: v.id,
            wcag: tag ? `${tag[1]}.${tag[2]}.${tag[3]}` : 'best-practice',
            severity: v.impact === 'minor' ? 'minor' : v.impact === 'moderate' ? 'moderate' : 'serious',
            selector: (n.target ?? []).join(' '),
            evidence: String(n.failureSummary ?? v.help).split('\n').filter(Boolean).slice(0, 2).join(' '),
            source: 'axe',
          });
        }
      }
    } catch (err) {
      notes.push(`axe falló: ${String(err.message).split('\n')[0]}`);
    }
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(250);
  const { motion, transitions } = await page.evaluate(motionAudit);
  for (const m of motion) {
    findings.push({ rule: 'reduced-motion', wcag: m.infinite || m.seconds >= 5 ? '2.2.2' : '2.3.3', severity: 'moderate', selector: m.selector, evidence: `«${m.name}» sigue en marcha con prefers-reduced-motion: reduce (${m.seconds}s${m.infinite ? ', infinita' : ''})` });
  }
  if (transitions.length) {
    findings.push({ rule: 'reduced-motion-transition', wcag: '2.3.3', severity: 'minor', selector: transitions[0], evidence: `${transitions.length} elemento(s) conservan transiciones con prefers-reduced-motion: reduce (p. ej. ${transitions.slice(0, 3).join(', ')})` });
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  return { findings: findings.map((f) => ({ source: 'native', ...f })), needsHuman, notes };
}

const REQUIRES_HUMAN = [
  { topic: 'Experiencia con lector de pantalla', why: 'Orden de lectura, anuncios de cambios dinámicos y claridad de los nombres solo se validan con NVDA, JAWS o VoiceOver.' },
  { topic: 'Carga cognitiva y lenguaje claro', why: 'Complejidad de pasos, vocabulario y mensajes de error (3.3.x, 3.1.5) requieren criterio humano.' },
  { topic: 'Información transmitida solo por color o forma', why: '1.4.1 y 1.3.3 no se pueden decidir desde estilos computados.' },
  { topic: 'Orden de foco con sentido y zoom/reflujo', why: '2.4.3, 1.4.4 y 1.4.10 se revisan con teclado real y con zoom al 200 % y 400 %.' },
  { topic: 'Dispositivos reales y tecnología de apoyo', why: 'Lo que solo valida un dispositivo real queda pendiente, nunca verificado.' },
];

export function summarize(findings) {
  const count = (key) => findings.reduce((acc, f) => ({ ...acc, [f[key]]: (acc[f[key]] ?? 0) + 1 }), {});
  return { total: findings.length, byCriterion: count('wcag'), bySeverity: count('severity'), byRule: count('rule'), bySource: count('source') };
}

export function toMarkdown(report) {
  const L = [
    '# Accesibilidad',
    '',
    `> ${report.disclaimer}`,
    '',
    `Generado: ${report.generatedAt}. Entrada: ${report.input.mode} ${report.input.urls.join(', ')}. Viewports: ${report.viewports.map((v) => `${v.name} ${v.width}×${v.height}`).join(', ')}.`,
    `axe: ${report.axe.available ? `incluido (${report.axe.version ?? 'versión desconocida'})` : 'axe no disponible, se continuó solo con las comprobaciones propias'}.`,
    '',
    `## Resumen`,
    '',
    `Hallazgos: ${report.summary.total}. Graves: ${report.summary.bySeverity.serious ?? 0}; moderados: ${report.summary.bySeverity.moderate ?? 0}; menores: ${report.summary.bySeverity.minor ?? 0}.`,
    '',
    '## Hallazgos por criterio WCAG',
    '',
  ];
  const criteria = Object.keys(report.summary.byCriterion).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  if (!criteria.length) L.push('Sin hallazgos automáticos. Esto no demuestra conformidad.', '');
  for (const c of criteria) {
    L.push(`### ${c}`, '', '| Regla | Severidad | Fuente | Pantalla | Viewport | Selector | Evidencia |', '|---|---|---|---|---|---|---|');
    for (const f of report.findings.filter((x) => x.wcag === c)) {
      L.push(`| ${cell(f.rule)} | ${f.severity} | ${f.source} | ${cell([f.screen, f.role].filter(Boolean).join('@') || f.url)} | ${f.viewport} | \`${cell(f.selector)}\` | ${cell(f.evidence)} |`);
    }
    L.push('');
  }
  if (report.notes.length) L.push('## Notas', '', ...report.notes.map((n) => `- ${n}`), '');
  L.push('## Requiere revisión humana', '', ...report.needsHuman.map((n) => `- **${n.topic}**: ${n.why}`), '');
  return `${L.join('\n')}\n`;
}

const USAGE = `Usage:
  node a11y-audit.mjs --url <http-url>... [--storage-state [role=]auth.json]... [--platform web|phone|both] [--scope <css>] [--out <dir>]
  node a11y-audit.mjs --showcase <http-url> [--role <id>]... [--screen <id>]... [--platform web|phone|both] [--scope <css>] [--out <dir>]
Options:
  --platform   web (1440x900, default), phone (390x844) or both
  --out        output folder for a11y.json and a11y.md (default tmp/ux-audit/); give each invocation its own
  --no-axe     skip axe-core even when it resolves
  --timeout    page load timeout in ms (default 15000)
  --help       this text
Automatic and partial: it never claims WCAG conformance. Local or test environments only, never production.
Exit: 0 ok, 1 error, 2 playwright-core or browser missing, 64 usage error.`;

function usage(message) {
  throw new UsageError(`${message ? `${message}\n` : ''}${USAGE}`);
}

function parseCli(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        url: { type: 'string', multiple: true },
        showcase: { type: 'string' },
        'storage-state': { type: 'string', multiple: true },
        role: { type: 'string', multiple: true },
        screen: { type: 'string', multiple: true },
        platform: { type: 'string', default: 'web' },
        scope: { type: 'string' },
        out: { type: 'string', default: 'tmp/ux-audit' },
        'no-axe': { type: 'boolean', default: false },
        timeout: { type: 'string', default: '15000' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (err) {
    return usage(err.message);
  }
  const v = parsed.values;
  if (v.help) return { help: true };
  if (Boolean(v.url?.length) === Boolean(v.showcase)) usage('Give exactly one of --url or --showcase.');
  if (!['web', 'phone', 'both'].includes(v.platform)) usage('--platform must be web, phone or both.');
  const timeout = Number.parseInt(v.timeout, 10);
  if (!Number.isFinite(timeout) || timeout <= 0) usage('--timeout must be a positive integer.');
  for (const u of v.url ?? [v.showcase]) {
    try {
      if (!/^https?:$/.test(new URL(u).protocol)) throw new Error('protocol');
    } catch {
      usage(`Invalid http(s) URL: ${u}`);
    }
  }
  const roles = (v['storage-state'] ?? []).map((s) => {
    const m = s.match(/^([\w-]+)=(.+)$/);
    if (m) return { id: m[1], storageState: m[2] };
    if (!s || s.startsWith('=')) usage(`--storage-state needs [role=]file, got: ${s}`);
    return { id: null, storageState: s };
  });
  return { ...v, timeout, storage: roles };
}

function loadAxe() {
  const entry = resolveDependency('axe-core');
  if (!entry) return { available: false };
  try {
    let version = null;
    try { version = JSON.parse(readFileSync(entry.replace(/[\\/][^\\/]*$/, '/package.json'), 'utf8')).version; } catch { /* package.json beside the entry is optional */ }
    return { available: true, source: readFileSync(entry, 'utf8'), version };
  } catch {
    return { available: false };
  }
}

const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function run(opts) {
  const viewports = opts.platform === 'both' ? [VIEWPORTS.web, VIEWPORTS.phone] : [VIEWPORTS[opts.platform]];
  const axe = opts['no-axe'] ? { available: false, skipped: true } : loadAxe();
  const browser = await launchBrowser();
  const findings = [];
  const needsHuman = [];
  const notes = [];
  const audited = [];
  try {
    for (const vp of viewports) {
      const base = { viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.mobile, hasTouch: !!vp.mobile };
      const record = (res, label) => {
        for (const f of res.findings) findings.push({ ...label, viewport: vp.name, ...f });
        for (const n of res.needsHuman) if (!needsHuman.some((x) => x.topic === n.topic)) needsHuman.push(n);
        for (const n of res.notes) notes.push(`${vp.name}${label.screen ? ` ${label.screen}` : ''}: ${n}`);
      };
      if (opts.showcase) {
        const context = await browser.newContext(base);
        const page = await context.newPage();
        const target = new URL(opts.showcase);
        target.searchParams.set('capture', vp.name);
        await page.goto(target.href, { waitUntil: 'load', timeout: opts.timeout });
        await page.waitForFunction(() => document.querySelector('.sc-fatal') || (window.SHOWCASE && window.SHOWCASE.version === '1'), null, { timeout: opts.timeout });
        await failOnShowcaseReason(page);
        const reg = await page.evaluate(() => ({ screens: window.SHOWCASE.screens(), roles: window.SHOWCASE.roles() }));
        const roleIds = reg.roles.map((r) => r.id);
        for (const role of reg.roles.filter((r) => !opts.role?.length || opts.role.includes(r.id))) {
          for (const s of reg.screens.filter((x) => !opts.screen?.length || opts.screen.includes(x.id))) {
            const a = s.access;
            const list = a == null || a === '' || a === 'all' || a === '*' ? roleIds : Array.isArray(a) ? (a.length ? a : roleIds) : String(a).split(/[\s,|]+/);
            if (!list.includes('all') && !list.includes('*') && !list.includes(role.id)) continue;
            try {
              await page.evaluate(async (to) => { await window.SHOWCASE.open({ screen: to.screen, role: to.role }, { view: to.view }); }, { screen: s.id, role: role.id, view: vp.name });
              await settle(page);
            } catch (err) {
              notes.push(`${vp.name} ${s.id}@${role.id}: no se pudo abrir (${String(err.message).split('\n')[0]})`);
              continue;
            }
            record(await auditPage(page, { scope: opts.scope ?? (await showcaseScope(page)), axe, withAxe: axe.available }), { screen: s.id, role: role.id, url: opts.showcase });
            audited.push({ screen: s.id, role: role.id, viewport: vp.name });
          }
        }
        await context.close();
      } else {
        const roles = opts.storage.length ? opts.storage : [{ id: null }];
        for (const role of roles) {
          const context = await browser.newContext({ ...base, ...(role.storageState ? { storageState: role.storageState } : {}) });
          const page = await context.newPage();
          for (const url of opts.url) {
            await page.goto(url, { waitUntil: 'load', timeout: opts.timeout });
            await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
            await failOnShowcaseReason(page);
            await settle(page);
            record(await auditPage(page, { scope: opts.scope, axe, withAxe: axe.available }), { url, ...(role.id ? { role: role.id } : {}) });
            audited.push({ url, ...(role.id ? { role: role.id } : {}), viewport: vp.name });
          }
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  return { findings, needsHuman, notes, audited, viewports, axe };
}

/** The app frame of a showcase, like nav-graph: the chrome around it is not the product. */
async function showcaseScope(page) {
  return page.evaluate(() => ['[data-frame="web"] .app', '[data-frame="phone"] .app', '[data-app]', '.app'].find((s) => document.querySelector(s)) ?? null);
}

async function main() {
  const opts = parseCli(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(`${USAGE}\n`);
    return EXIT.OK;
  }
  const res = await run(opts);
  const urls = opts.url ?? [opts.showcase];
  const report = {
    tool: 'ux-flow-audit/a11y-audit',
    disclaimer: DISCLAIMER,
    generatedAt: new Date().toISOString(),
    input: { mode: opts.showcase ? 'showcase' : 'url', url: urls.length === 1 ? urls[0] : null, urls, platform: opts.platform, scope: opts.scope ?? null },
    viewports: res.viewports.map(({ name, width, height }) => ({ name, width, height })),
    axe: res.axe.available ? { available: true, version: res.axe.version } : { available: false, note: res.axe.skipped ? 'omitido con --no-axe' : 'axe no disponible' },
    audited: res.audited,
    summary: summarize(res.findings),
    findings: res.findings,
    needsHuman: [...res.needsHuman, ...REQUIRES_HUMAN],
    notes: res.notes,
  };
  emit(report, toMarkdown(report), { out: opts.out, name: 'a11y' });
  return EXIT.OK;
}

if (isMain(import.meta.url)) await runCli(main);
