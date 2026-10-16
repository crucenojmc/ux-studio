#!/usr/bin/env node
// Navigation graph and reachability, from a prototype showcase or by crawling a real app.
//
//   node nav-graph.mjs --showcase <http-url> [--scope <css>] [--features features.json] [--out <dir>] [--format json|md]
//   node nav-graph.mjs --crawl <url> [--storage-state [role=]auth.json]... [--max-depth 4] [--max-pages 150]
//        [--max-clicks 25] [--same-origin] [--routes routes.json] [--allow-post] [--features features.json]
//        [--out <dir>] [--format json|md] [--timeout 15000]
//
// --showcase reads window.SHOWCASE v1 (screens, roles, flows; sheets() when present). For every role and every
//   screen the role can access (screen.access: missing, empty, "all" or "*" = every role; array or comma list
//   of role ids otherwise) it calls SHOWCASE.open({screen, role}) and collects links INSIDE the app frame only
//   (--scope, else [data-frame="web"] .app, [data-frame="web"], [data-app], .app, body), so the presenter's
//   own screen list never counts as an edge. A link targets a screen when (first match wins):
//     0. data-go="<screenId>" (screen) or data-act="sheet" + data-arg="<sheetId>" (sheet), the prototype-showcase markup;
//        other data-act values are in-screen actions, never navigation;
//     1. data-a / data-to / data-screen contains a token equal to a screen (or sheet) id, e.g. data-a="go:pedidos";
//     2. href is a hash link with screen= (or sheet=), e.g. href="#screen=pedidos";
//     3. href equals a screen's registry `path`;
//     4. a button-like control's visible text equals a screen title or id (accent and case insensitive).
//   Flow steps are checked against these edges: a step that changes screen without a UI link is "not backed"
//   (the flow teleports; the user could only get there by URL).
// --crawl walks the app breadth-first from <url>, one pass per role (--storage-state role=file, repeatable).
//   Anchors are followed by URL; [role=menuitem], [role=tab], [role=button], button and input buttons are
//   clicked on a freshly loaded copy of the page. Safety, in two layers:
//     labels: never clicks submit buttons inside a form, nor controls whose label/href/class says
//       destructive (borrar, eliminar, delete, remove, anular, cancelar, baja, desactivar, archivar, purgar,
//       vaciar, reset, descartar…), committing (guardar, enviar, confirmar, aprobar, pagar, publicar, emitir,
//       facturar, procesar, ejecutar, importar, sincronizar, finalizar, cerrar, asignar, generar…)
//       or session-ending (cerrar sesión, salir, logout, sign out…). Skipped controls are reported.
//     network: every non-GET/HEAD/OPTIONS request is aborted (POST is allowed only with --allow-post for apps
//       that read through POST); window dialogs are dismissed; popups are recorded as edges and closed.
//   Controls with the same role and label on one page are clicked once (row actions repeat).
//   Never leaves the start origin (--same-origin is the default and is accepted for explicitness): external,
//   mailto/tel and file links (download, .pdf, .xlsx, .csv…) are recorded as leaf nodes and never visited.
//   --routes (JSON array of paths, or of {path}) lists the app's known routes (router, sitemap, backend):
//   any route not found by the crawl is probed by URL and reported as an orphan (exists, nothing links to it).
// Both modes: --features features.json ([{id, name, roles, match: {screen?|url?|text?}}]) adds per-role
//   reachability (min depth, path), unreachable features, only-by-URL and role-locked features.
//   match.url is an exact path (or a glob with *); match.text matches screen titles/headings (depth d) or
//   control labels on a screen (depth d + 1).
// Exit codes: 0 ok · 1 usage or runtime error · 2 playwright-core or browser missing (prints the hint).

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { failOnShowcaseReason, launchBrowser } from './lib/browser.mjs';
import { cell, emit, isMain, norm, runCli } from './lib/cli.mjs';

const NAV_KINDS = new Set(['screen', 'page']);
const FILE_EXT = /\.(pdf|xlsx?|csv|zip|docx?|pptx?|txt|json|xml|png|jpe?g|gif|svg|mp4|mp3)$/i;

export const SAFETY = Object.freeze({
  destructive: ['borrar', 'eliminar', 'suprimir', 'delete', 'remove', 'quitar', 'anular', 'void', 'cancelar', 'cancel',
    'revocar', 'revoke', 'rechazar', 'reject', 'desactivar', 'deactivate', 'dar de baja', 'baja', 'archivar', 'archive',
    'purgar', 'purge', 'vaciar', 'reset', 'restablecer', 'reiniciar', 'destroy', 'drop', 'descartar', 'discard'],
  commit: ['guardar', 'save', 'enviar', 'send', 'submit', 'confirmar', 'confirm', 'aprobar', 'approve', 'autorizar',
    'authorize', 'publicar', 'publish', 'pagar', 'pay', 'facturar', 'emitir', 'despachar', 'procesar', 'process',
    'ejecutar', 'execute', 'run', 'importar', 'import', 'sincronizar', 'sync', 'finalizar', 'finish', 'cerrar', 'close',
    'asignar', 'assign', 'generar', 'generate', 'subir', 'upload', 'transferir', 'transfer'],
  session: ['cerrar sesion', 'salir', 'logout', 'log out', 'sign out', 'signout', 'desconectar', 'disconnect', 'cambiar de usuario', 'switch user'],
  hrefPattern: /(^|[/_\-.?=&])(delete|remove|destroy|eliminar|borrar|anular|logout|log-out|signout|sign-out|salir|cerrar-sesion)([/_\-.?=&]|$)/i,
});

const hasWord = (label, words) => words.some((w) => new RegExp(`(^|[^a-z0-9])${w.replace(/ /g, '\\s+')}([^a-z0-9]|$)`).test(label));

/** Classify a crawl control: null (safe to click) or the reason it is skipped. */
export function unsafeReason(item) {
  if (item.inForm && (item.type === 'submit' || (item.tag === 'button' && !item.type) || (item.tag === 'input' && item.type === 'submit'))) return 'submit';
  const label = norm(item.text);
  if (hasWord(label, SAFETY.session) || (item.href && /logout|signout|sign-out|cerrar-sesion/i.test(item.href))) return 'session';
  if (item.danger || hasWord(label, SAFETY.destructive) || (item.href && SAFETY.hrefPattern.test(item.href))) return 'destructive';
  if (hasWord(label, SAFETY.commit)) return 'commit';
  if (item.disabled) return 'disabled';
  if (!item.visible) return 'hidden';
  return null;
}

// ---------------------------------------------------------------------------
// Pure helpers

/** Map one collected link to target node ids using the showcase registry. */
export function linkTargets(link, registry) {
  const screens = new Set(registry.screens ?? []);
  const sheets = new Set(registry.sheets ?? []);
  if (link.dataGo && screens.has(link.dataGo)) return [link.dataGo];
  if (link.dataAct === 'sheet' && sheets.has(link.dataArg)) return [`sheet:${link.dataArg}`];
  if (link.dataA) {
    const tokens = String(link.dataA).split(/[^\p{L}\p{N}_-]+/u).filter(Boolean);
    const hit = tokens.find((t) => screens.has(t)) ?? tokens.find((t) => sheets.has(t));
    if (hit) return [screens.has(hit) ? hit : `sheet:${hit}`];
  }
  const href = link.href ?? '';
  if (href.startsWith('#') && href.length > 1) {
    const params = new URLSearchParams(href.slice(1));
    if (params.get('sheet') && sheets.has(params.get('sheet'))) return [`sheet:${params.get('sheet')}`];
    if (params.get('screen') && screens.has(params.get('screen'))) return [params.get('screen')];
    if (screens.has(href.slice(1))) return [href.slice(1)];
  }
  if (href && registry.paths?.[href]) return [registry.paths[href]];
  if (link.control) {
    const t = norm(link.text);
    if (t && registry.titles?.[t]) return [registry.titles[t]];
    if (t && screens.has(t)) return [t];
  }
  return [];
}

function urlMatches(node, pattern) {
  const trim = (s) => (s.length > 1 ? s.replace(/\/+$/, '') : s);
  const p = trim(pattern);
  const re = p.includes('*') ? new RegExp(`^${p.split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`) : null;
  return [node.id, node.url, node.path].filter(Boolean).map(trim).some((v) => (re ? re.test(v) : v === p));
}

function featureHits(feature, nodes) {
  const m = feature.match ?? {};
  const hits = [];
  const text = m.text ? norm(m.text) : null;
  for (const node of nodes) {
    if (m.screen && node.id === m.screen) hits.push({ id: node.id, extra: 0 });
    else if (m.url && urlMatches(node, m.url)) hits.push({ id: node.id, extra: 0 });
    else if (text) {
      const own = [node.title, ...(node.texts ?? [])].some((x) => norm(x).includes(text));
      if (own) hits.push({ id: node.id, extra: 0 });
      else {
        const label = (node.labels ?? []).find((x) => norm(x).includes(text));
        if (label) hits.push({ id: node.id, extra: 1, label });
      }
    }
  }
  return hits;
}

/**
 * Reachability over a graph { nodes:[{id, kind, title?, url?, texts?, labels?}],
 * roles:[{id, home, allowed?:[ids], edges:[{from,to,label?,via?}]}] } and a feature list.
 */
export function analyzeReachability(graph, features = []) {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const isNav = (id) => NAV_KINDS.has(nodeById.get(id)?.kind ?? 'screen');
  const isExpandable = (id) => isNav(id) || nodeById.get(id)?.kind === 'redirect';
  const homes = new Set(graph.roles.map((r) => r.home));
  const inbound = new Map();
  const infoByRole = new Map();

  const roles = graph.roles.map((role) => {
    const allowed = new Set(role.allowed ?? graph.nodes.map((n) => n.id));
    const adj = new Map();
    for (const e of role.edges) {
      if (e.from === e.to) continue;
      if (!adj.has(e.from)) adj.set(e.from, []);
      adj.get(e.from).push(e);
      inbound.set(e.to, (inbound.get(e.to) ?? 0) + 1);
    }
    // 0-1 BFS: a redirect costs no interaction, every other edge costs one.
    const info = new Map([[role.home, { depth: 0, path: [role.home] }]]);
    const queue = [role.home];
    const done = new Set();
    while (queue.length) {
      const cur = queue.shift();
      if (done.has(cur)) continue;
      done.add(cur);
      if (cur !== role.home && !isExpandable(cur)) continue;
      const d = info.get(cur);
      for (const e of adj.get(cur) ?? []) {
        if (!allowed.has(e.to)) continue;
        const w = e.via === 'redirect' ? 0 : 1;
        const prev = info.get(e.to);
        if (prev && prev.depth <= d.depth + w) continue;
        info.set(e.to, { depth: d.depth + w, path: [...d.path, e.to] });
        if (w === 0) queue.unshift(e.to);
        else queue.push(e.to);
      }
    }
    infoByRole.set(role.id, { info, allowed });
    const reachable = [...info.keys()];
    return {
      id: role.id,
      home: role.home,
      nodes: reachable.map((id) => ({ id, kind: nodeById.get(id)?.kind ?? 'screen', title: nodeById.get(id)?.title ?? null, ...info.get(id) })),
      reachable,
      onlyByUrl: [...allowed].filter((id) => !info.has(id) && isNav(id)),
      deadEnds: reachable.filter((id) => isNav(id) && !(adj.get(id) ?? []).some((e) => isNav(e.to) && allowed.has(e.to))),
      deep: reachable.filter((id) => info.get(id).depth > 3),
      edgeCount: role.edges.length,
    };
  });

  const uniq = (arrays) => [...new Set(arrays.flat())];
  const roleIds = graph.roles.map((r) => r.id);
  const featureRows = features.map((f) => {
    const hits = featureHits(f, graph.nodes);
    const evaluated = f.roles?.length ? f.roles : roleIds;
    const byRole = {};
    for (const rid of evaluated) {
      const ctx = infoByRole.get(rid);
      if (!ctx) { byRole[rid] = { reachable: false, reason: 'unknown-role' }; continue; }
      if (!hits.length) { byRole[rid] = { reachable: false, reason: 'not-found' }; continue; }
      const reached = hits.filter((h) => ctx.info.has(h.id))
        .map((h) => ({ ...h, depth: ctx.info.get(h.id).depth + h.extra, path: ctx.info.get(h.id).path }))
        .sort((a, b) => a.depth - b.depth || a.extra - b.extra);
      if (reached.length) {
        const best = reached[0];
        byRole[rid] = { reachable: true, depth: best.depth, path: best.path, ...(best.label ? { control: best.label } : {}) };
      } else {
        byRole[rid] = { reachable: false, reason: hits.some((h) => ctx.allowed.has(h.id)) ? 'only-by-url' : 'no-access' };
      }
    }
    const rows = Object.values(byRole);
    const reachable = rows.some((r) => r.reachable);
    const minDepth = reachable ? Math.min(...rows.filter((r) => r.reachable).map((r) => r.depth)) : null;
    return {
      id: f.id,
      name: f.name ?? f.id,
      roles: evaluated,
      byRole,
      reachable,
      minDepth,
      deep: minDepth != null && minDepth > 3,
      onlyByUrl: !reachable && rows.some((r) => r.reason === 'only-by-url'),
      roleLocked: reachable ? Object.entries(byRole).filter(([, r]) => !r.reachable).map(([id]) => id) : [],
    };
  });

  return {
    roles,
    orphans: graph.nodes.filter((n) => isNav(n.id) && !inbound.get(n.id) && !homes.has(n.id)).map((n) => n.id),
    deadEnds: uniq(roles.map((r) => r.deadEnds)),
    deep: uniq(roles.map((r) => r.deep)),
    features: featureRows,
    unreachableFeatures: featureRows.filter((f) => !f.reachable).map((f) => f.id),
  };
}

// ---------------------------------------------------------------------------
// Showcase mode

function accessFor(screen, roleIds) {
  const a = screen.access;
  if (a == null || a === '' || a === 'all' || a === '*' || (Array.isArray(a) && a.length === 0)) return roleIds;
  const list = Array.isArray(a) ? a : String(a).split(/[\s,|]+/);
  if (list.includes('all') || list.includes('*')) return roleIds;
  return roleIds.filter((r) => list.includes(r));
}

/* Runs in the page: collect link candidates inside the app frame. */
function showcaseCollect(scopeSel) {
  const candidates = [scopeSel, '[data-frame="web"] .app', '[data-frame="web"]', '[data-app]', '.app'].filter(Boolean);
  let root = null;
  let scope = 'body';
  for (const s of candidates) {
    const el = document.querySelector(s);
    if (el) { root = el; scope = s; break; }
  }
  root = root || document.body;
  const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const links = [...root.querySelectorAll('a[href], button, [role=button], [role=menuitem], [role=tab], [role=link], [data-a], [data-to], [data-screen], [data-go], [data-act="sheet"]')]
    .map((el) => {
      const href = el.getAttribute('href');
      return {
        dataGo: el.getAttribute('data-go'),
        dataAct: el.getAttribute('data-act'),
        dataArg: el.getAttribute('data-arg'),
        dataA: el.getAttribute('data-a') ?? el.getAttribute('data-to') ?? el.getAttribute('data-screen'),
        href,
        text: clean(el.innerText || el.getAttribute('aria-label') || el.getAttribute('title')),
        control: !(el.tagName === 'A' && href && href.startsWith('#')),
        hidden: !visible(el),
      };
    });
  const texts = [...root.querySelectorAll('h1, h2, h3, [data-app-title], [role=heading]')].map((h) => clean(h.innerText)).filter(Boolean);
  return { scope, links, texts };
}

const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function buildShowcaseGraph(page, url, { scope, timeout }) {
  const target = new URL(url);
  if (!target.searchParams.has('capture')) target.searchParams.set('capture', 'web');
  await page.goto(target.href, { waitUntil: 'load', timeout });
  await page.waitForFunction(() => document.querySelector('.sc-fatal') || (window.SHOWCASE && window.SHOWCASE.version === '1'), null, { timeout });
  await failOnShowcaseReason(page);
  const reg = await page.evaluate(() => ({
    screens: window.SHOWCASE.screens(),
    roles: window.SHOWCASE.roles(),
    flows: window.SHOWCASE.flows ? window.SHOWCASE.flows() : [],
    sheets: typeof window.SHOWCASE.sheets === 'function' ? window.SHOWCASE.sheets() : [],
  }));
  const roleIds = reg.roles.map((r) => r.id);
  const registry = {
    screens: reg.screens.map((s) => s.id),
    sheets: reg.sheets.map((s) => s.id),
    titles: Object.fromEntries(reg.screens.map((s) => [norm(s.title), s.id])),
    paths: Object.fromEntries(reg.screens.filter((s) => s.path).map((s) => [s.path, s.id])),
  };
  const nodes = new Map(reg.screens.map((s) => [s.id, { id: s.id, kind: 'screen', title: s.title ?? s.id, url: s.path ?? null, group: s.group ?? null, texts: [], labels: [] }]));
  for (const sh of reg.sheets) nodes.set(`sheet:${sh.id}`, { id: `sheet:${sh.id}`, kind: 'sheet', title: sh.title ?? sh.id, texts: [], labels: [] });
  const warnings = [];
  let usedScope = null;
  const roles = [];

  for (const role of reg.roles) {
    const allowed = reg.screens.filter((s) => accessFor(s, roleIds).includes(role.id)).map((s) => s.id);
    const edges = [];
    for (const screenId of allowed) {
      try {
        await page.evaluate(async (to) => { await window.SHOWCASE.open(to, { view: 'web' }); }, { screen: screenId, role: role.id });
        await settle(page);
      } catch (err) {
        warnings.push(`open(${screenId}, ${role.id}) failed: ${err.message.split('\n')[0]}`);
        continue;
      }
      const { scope: s, links, texts } = await page.evaluate(showcaseCollect, scope ?? null);
      usedScope ??= s;
      const node = nodes.get(screenId);
      node.texts = [...new Set([...node.texts, ...texts])];
      node.labels = [...new Set([...node.labels, ...links.map((l) => l.text).filter(Boolean)])];
      for (const link of links) {
        for (const to of linkTargets(link, registry)) {
          if (to !== screenId) edges.push({ from: screenId, to, label: link.text || null, via: link.dataGo ? 'data-go' : link.dataAct === 'sheet' ? 'data-act' : link.dataA ? 'data-a' : link.href?.startsWith('#') ? 'href' : 'text', hidden: link.hidden });
        }
      }
    }
    const home = role.home && allowed.includes(role.home) ? role.home : allowed[0];
    if (home !== role.home) warnings.push(`role ${role.id}: home "${role.home}" is not accessible; using "${home}"`);
    roles.push({ id: role.id, label: role.label ?? role.id, home, allowed: [...allowed, ...registry.sheets.map((id) => `sheet:${id}`)], edges });
  }

  const flows = reg.flows.map((flow) => {
    let screen = null;
    let roleId = flow.role;
    const steps = (flow.steps ?? []).map((step, i) => {
      const to = step.to ?? {};
      if (to.role) roleId = to.role;
      const next = to.sheet ? `sheet:${to.sheet}` : (to.screen ?? screen);
      const from = screen;
      if (!to.sheet && to.screen) screen = to.screen;
      const edges = roles.find((r) => r.id === roleId)?.edges ?? [];
      const backed = from == null || from === next ? null : edges.some((e) => e.from === from && e.to === next);
      return { index: i + 1, label: step.label ?? null, role: roleId, from, to: next, backed };
    });
    return { id: flow.id, role: flow.role, title: flow.title ?? flow.id, steps, unbacked: steps.filter((s) => s.backed === false).length };
  });

  return { graph: { nodes: [...nodes.values()], roles }, flows, warnings, scope: usedScope };
}

// ---------------------------------------------------------------------------
// Crawl mode

/** Node key for a URL: path (no trailing slash) + query + hash only for hash routing (#/ or #!). */
export function nodeKey(href) {
  const u = new URL(href);
  const pathname = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, '') : u.pathname;
  const hash = /^#[/!]/.test(u.hash) ? u.hash : '';
  return `${pathname}${u.search}${hash}`;
}

/* Runs in the page: tag and describe every navigation candidate. */
function crawlCollect() {
  const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const items = [];
  document.querySelectorAll('a[href], button, [role=button], [role=menuitem], [role=tab], [role=link], input[type=submit], input[type=button]').forEach((el) => {
    const idx = items.length;
    el.setAttribute('data-uxfa', String(idx));
    const tag = el.tagName.toLowerCase();
    const cls = typeof el.className === 'string' ? el.className : (el.className?.baseVal ?? '');
    items.push({
      idx,
      tag,
      role: el.getAttribute('role'),
      type: el.getAttribute('type'),
      href: tag === 'a' ? el.getAttribute('href') : null,
      abs: tag === 'a' ? el.href : null,
      download: el.hasAttribute('download'),
      text: clean(el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('title')),
      inForm: !!el.closest('form'),
      disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true',
      visible: visible(el),
      danger: el.hasAttribute('data-danger') || el.hasAttribute('data-destructive') || /\b(danger|destructive)\b/i.test(cls),
    });
  });
  return {
    title: clean(document.title),
    headings: [...document.querySelectorAll('h1, h2, h3, [role=heading]')].map((h) => clean(h.innerText)).filter(Boolean).slice(0, 20),
    dialogs: document.querySelectorAll('[role=dialog], [role=alertdialog], dialog[open], [aria-modal="true"]').length,
    items,
  };
}

function classifyAnchor(item, origin) {
  const raw = item.href ?? '';
  if (/^(mailto|tel|sms):/i.test(raw)) return { kind: 'external', id: raw };
  if (raw === '' || raw === '#' || /^javascript:/i.test(raw)) return { kind: 'control' };
  let u;
  try { u = new URL(item.abs); } catch { return { kind: 'skip', reason: 'invalid-href' }; }
  if (u.origin !== origin) return { kind: 'external', id: u.href };
  if (raw.startsWith('#') && !/^#[/!]/.test(raw)) return { kind: 'skip', reason: 'in-page-anchor' };
  if (item.download || FILE_EXT.test(u.pathname)) return { kind: 'file', id: nodeKey(u.href), url: u.href };
  return { kind: 'page', id: nodeKey(u.href), url: u.href };
}

async function crawlRole(browser, role, opts) {
  const { start, maxDepth, maxPages, maxClicks, allowPost, timeout, settleMs, probe } = opts;
  const origin = new URL(start).origin;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...(role.storageState ? { storageState: role.storageState } : {}) });
  const blocked = [];
  await context.route('**/*', (route) => {
    const method = route.request().method();
    if (['GET', 'HEAD', 'OPTIONS'].includes(method) || (allowPost && method === 'POST')) return route.continue();
    blocked.push(`${method} ${route.request().url()}`);
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  page.on('dialog', (d) => d.dismiss().catch(() => {}));

  const nodes = new Map();
  const edges = [];
  const skipped = [];
  const broken = [];
  const visitedPages = new Set();
  const addNode = (n) => { if (!nodes.has(n.id)) nodes.set(n.id, { texts: [], labels: [], ...n }); return nodes.get(n.id); };

  const load = async (url) => {
    const res = await page.goto(url, { waitUntil: 'load', timeout }).catch((err) => ({ error: err }));
    if (res?.error) return { error: res.error.message.split('\n')[0] };
    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
    return { status: res?.status?.() ?? 200, finalKey: nodeKey(page.url()) };
  };

  const home = nodeKey(start);
  const queue = [{ id: home, url: start, depth: 0 }];
  const queued = new Set([home]);

  while (queue.length && visitedPages.size < maxPages) {
    const cur = queue.shift();
    const loaded = await load(cur.url);
    visitedPages.add(cur.id);
    if (loaded.error || loaded.status >= 400) {
      addNode({ id: cur.id, kind: 'error', url: cur.url, status: loaded.status ?? null });
      broken.push({ id: cur.id, status: loaded.status ?? null, error: loaded.error ?? null });
      continue;
    }
    if (loaded.finalKey !== cur.id) {
      addNode({ id: cur.id, kind: 'redirect', url: cur.url, title: `→ ${loaded.finalKey}` });
      edges.push({ from: cur.id, to: loaded.finalKey, label: null, via: 'redirect' });
      if (!queued.has(loaded.finalKey)) {
        queued.add(loaded.finalKey);
        queue.push({ id: loaded.finalKey, url: page.url(), depth: cur.depth });
      }
      continue;
    }
    const snap = await page.evaluate(crawlCollect);
    const node = addNode({ id: cur.id, kind: 'page', url: cur.url });
    node.title = snap.title || snap.headings[0] || cur.id;
    node.texts = [snap.title, ...snap.headings].filter(Boolean);
    node.labels = [...new Set(snap.items.map((i) => i.text).filter(Boolean))];
    const expand = cur.depth < maxDepth;
    const enqueue = (id, url) => {
      if (expand && !queued.has(id)) {
        queued.add(id);
        queue.push({ id, url, depth: cur.depth + 1 });
      }
    };

    const clickable = [];
    const seenLabels = new Set();
    for (const item of snap.items) {
      const reason = unsafeReason(item);
      if (item.tag === 'a') {
        const target = classifyAnchor(item, origin);
        if (target.kind === 'skip') continue;
        // A GET link is followed unless its label or href says destructive or session-ending.
        if (reason === 'destructive' || reason === 'session') {
          skipped.push({ node: cur.id, label: item.text, reason });
          continue;
        }
        if (target.kind === 'external' || target.kind === 'file') {
          addNode({ id: target.id, kind: target.kind, url: target.url ?? target.id, title: item.text });
          edges.push({ from: cur.id, to: target.id, label: item.text, via: 'link' });
          continue;
        }
        if (target.kind === 'page') {
          edges.push({ from: cur.id, to: target.id, label: item.text, via: 'link' });
          enqueue(target.id, target.url);
          continue;
        }
      }
      if (reason) {
        if (reason !== 'hidden') skipped.push({ node: cur.id, label: item.text, reason });
        continue;
      }
      const key = `${item.role ?? item.tag}:${norm(item.text)}`;
      if (seenLabels.has(key)) continue;
      seenLabels.add(key);
      clickable.push(item);
    }

    for (const item of clickable.slice(0, maxClicks)) {
      const again = await load(cur.url);
      if (again.error || again.finalKey !== cur.id) break;
      const fresh = await page.evaluate(crawlCollect);
      const same = fresh.items[item.idx];
      if (!same || same.text !== item.text) {
        skipped.push({ node: cur.id, label: item.text, reason: 'unstable' });
        continue;
      }
      const before = page.url();
      const popup = page.waitForEvent('popup', { timeout: settleMs }).catch(() => null);
      try {
        await page.click(`[data-uxfa="${item.idx}"]`, { timeout: 3000, noWaitAfter: true });
      } catch {
        skipped.push({ node: cur.id, label: item.text, reason: 'not-clickable' });
        continue;
      }
      await page.waitForURL((u) => u.href !== before, { timeout: settleMs }).catch(() => {});
      await page.waitForLoadState('load', { timeout }).catch(() => {});
      const opened = await popup;
      let nowUrl = page.url();
      if (opened) {
        await opened.waitForLoadState('domcontentloaded', { timeout: settleMs }).catch(() => {});
        nowUrl = opened.url();
        await opened.close().catch(() => {});
      }
      let nowKey = null;
      try { nowKey = new URL(nowUrl).origin === origin ? nodeKey(nowUrl) : null; } catch { nowKey = null; }
      if (nowKey && nowKey !== cur.id) {
        edges.push({ from: cur.id, to: nowKey, label: item.text, via: 'click' });
        enqueue(nowKey, nowUrl);
        continue;
      }
      const after = await page.evaluate(crawlCollect).catch(() => null);
      if (after && (after.dialogs > fresh.dialogs || item.role === 'tab')) {
        const id = `${cur.id} › ${item.text}`;
        addNode({ id, kind: 'state', title: item.text, url: cur.url, texts: after.headings.filter((h) => !fresh.headings.includes(h)) });
        edges.push({ from: cur.id, to: id, label: item.text, via: 'click' });
      }
    }
  }

  const probes = [];
  for (const path of probe) {
    let url;
    try { url = new URL(path, start).href; } catch { continue; }
    const id = nodeKey(url);
    if (visitedPages.has(id) || nodes.has(id)) continue;
    const loaded = await load(url);
    const ok = !loaded.error && loaded.status < 400 && loaded.finalKey === id;
    probes.push({ id, status: loaded.status ?? null, redirectedTo: loaded.finalKey !== id ? loaded.finalKey ?? null : null, ok });
    if (!ok) continue;
    const snap = await page.evaluate(crawlCollect);
    addNode({ id, kind: 'page', url, title: snap.title || snap.headings[0] || id, texts: [snap.title, ...snap.headings].filter(Boolean), labels: [...new Set(snap.items.map((i) => i.text).filter(Boolean))], probedOnly: true });
  }

  await context.close();
  return { home, nodes, edges, skipped, broken, blocked, probes, pages: visitedPages.size };
}

async function buildCrawlGraph(browser, start, opts) {
  const nodes = new Map();
  const roles = [];
  const skipped = [];
  const broken = [];
  const blocked = [];
  const probes = [];
  for (const role of opts.roles) {
    const r = await crawlRole(browser, role, { ...opts, start });
    for (const [id, n] of r.nodes) {
      const prev = nodes.get(id);
      if (!prev || (prev.kind !== 'page' && n.kind === 'page')) nodes.set(id, { ...n });
    }
    roles.push({ id: role.id, home: r.home, allowed: [...r.nodes.keys()], edges: r.edges, pages: r.pages });
    skipped.push(...r.skipped.map((s) => ({ role: role.id, ...s })));
    broken.push(...r.broken.map((b) => ({ role: role.id, ...b })));
    blocked.push(...r.blocked.map((b) => ({ role: role.id, request: b })));
    probes.push(...r.probes.map((p) => ({ role: role.id, ...p })));
  }
  const dedupe = (list) => [...new Map(list.map((x) => [JSON.stringify(x), x])).values()];
  return { graph: { nodes: [...nodes.values()], roles }, skipped: dedupe(skipped), broken, blocked: dedupe(blocked), probes };
}

// ---------------------------------------------------------------------------
// Report

function pathText(p) {
  return p.path.join(' › ') + (p.control ? ` › «${p.control}»` : '');
}

/** Render the report as Markdown (neutral Spanish). */
export function toMarkdown(report) {
  const L = [
    `# Grafo de navegación (${report.mode === 'crawl' ? 'recorrido de la app' : 'prototipo'})`,
    '',
    `Fuente: ${report.source} · Generado: ${report.generatedAt}`,
    '',
    '## Alcanzabilidad por rol',
    '',
    '| Rol | Inicio | Alcanzables | Solo por URL | Sin salida | Profundidad > 3 |',
    '|---|---|--:|---|---|---|',
    ...report.roles.map((r) => `| ${cell(r.id)} | ${cell(r.home)} | ${r.nodes.filter((n) => NAV_KINDS.has(n.kind)).length} | ${cell(r.onlyByUrl.join(', ') || '—')} | ${cell(r.deadEnds.join(', ') || '—')} | ${cell(r.deep.join(', ') || '—')} |`),
  ];
  if (report.features.length) {
    const roleIds = report.roles.map((r) => r.id);
    L.push('', '## Funcionalidades por rol', '', `| Id | Funcionalidad | ${roleIds.map(cell).join(' | ')} | Estado |`, `|---|---|${roleIds.map(() => '---').join('|')}|---|`);
    for (const f of report.features) {
      const cols = roleIds.map((rid) => {
        const r = f.byRole[rid];
        if (!r) return 'n/a';
        return r.reachable ? `${r.depth} (${cell(pathText(r))})` : `✗ ${r.reason}`;
      });
      const state = !f.reachable ? (f.onlyByUrl ? 'Solo por URL' : 'Inalcanzable') : f.roleLocked.length ? `Bloqueada para ${f.roleLocked.join(', ')}` : f.deep ? 'Profunda (> 3)' : 'OK';
      L.push(`| ${cell(f.id)} | ${cell(f.name)} | ${cols.join(' | ')} | ${state} |`);
    }
  }
  L.push('', '## Pantallas huérfanas (nada enlaza a ellas)', '', report.orphans.length ? report.orphans.map((id) => `- ${id}`).join('\n') : 'Ninguna.');
  L.push('', '## Pantallas sin salida', '', report.deadEnds.length ? report.deadEnds.map((id) => `- ${id}`).join('\n') : 'Ninguna.');
  if (report.flows?.length) {
    L.push('', '## Pasos de flujos sin enlace en la interfaz', '');
    const rows = report.flows.flatMap((f) => f.steps.filter((s) => s.backed === false).map((s) => `| ${cell(f.id)} | ${s.index} | ${cell(s.label)} | ${cell(s.from)} → ${cell(s.to)} |`));
    L.push(rows.length ? ['| Flujo | Paso | Etiqueta | Salto |', '|---|--:|---|---|', ...rows].join('\n') : 'Todos los pasos tienen un enlace visible.');
  }
  if (report.broken?.length) {
    L.push('', '## Enlaces rotos', '', ...report.broken.map((b) => `- ${b.id} (${b.status ?? b.error})`));
  }
  if (report.skipped?.length) {
    L.push('', '## Controles no accionados por seguridad', '', '| Pantalla | Control | Motivo |', '|---|---|---|', ...report.skipped.map((s) => `| ${cell(s.node)} | ${cell(s.label)} | ${s.reason} |`));
  }
  if (report.warnings?.length) L.push('', '## Advertencias', '', ...report.warnings.map((w) => `- ${w}`));
  return `${L.join('\n')}\n`;
}

function readJson(file, what) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`Cannot read ${what} ${file}: ${err.message}`);
  }
}

const USAGE = `Usage:
  node nav-graph.mjs --showcase <http-url> [--scope <css>] [--features f.json] [--out <dir>] [--format json|md]
  node nav-graph.mjs --crawl <url> [--storage-state [role=]auth.json]... [--max-depth 4] [--max-pages 150]
       [--max-clicks 25] [--same-origin] [--routes routes.json] [--allow-post] [--features f.json] [--out <dir>]`;

async function main() {
  const { values } = parseArgs({
    options: {
      showcase: { type: 'string' },
      crawl: { type: 'string' },
      scope: { type: 'string' },
      features: { type: 'string' },
      routes: { type: 'string' },
      'storage-state': { type: 'string', multiple: true },
      'max-depth': { type: 'string', default: '4' },
      'max-pages': { type: 'string', default: '150' },
      'max-clicks': { type: 'string', default: '25' },
      'same-origin': { type: 'boolean', default: true },
      'allow-post': { type: 'boolean', default: false },
      timeout: { type: 'string', default: '15000' },
      settle: { type: 'string', default: '1200' },
      out: { type: 'string' },
      format: { type: 'string', default: 'json' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help || Boolean(values.showcase) === Boolean(values.crawl)) {
    process.stderr.write(`${USAGE}\n`);
    return values.help ? 0 : 1;
  }
  if (!['json', 'md'].includes(values.format)) throw new Error('--format must be json or md');
  const int = (name) => {
    const n = Number.parseInt(values[name], 10);
    if (!Number.isFinite(n) || n < 0) throw new Error(`--${name} must be a non-negative integer`);
    return n;
  };
  const features = values.features ? readJson(values.features, 'features') : [];
  const timeout = int('timeout');
  const source = values.showcase ?? values.crawl;
  try { new URL(source); } catch { throw new Error(`Invalid URL: ${source}`); }

  const browser = await launchBrowser();
  let built;
  try {
    if (values.showcase) {
      const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
      built = await buildShowcaseGraph(page, source, { scope: values.scope, timeout });
    } else {
      const roles = (values['storage-state'] ?? []).map((s) => {
        const m = s.match(/^([\w-]+)=(.+)$/);
        return m ? { id: m[1], storageState: m[2] } : { id: 'default', storageState: s };
      });
      if (!roles.length) roles.push({ id: 'default' });
      const routes = values.routes ? readJson(values.routes, 'routes').map((r) => (typeof r === 'string' ? r : r.path)).filter(Boolean) : [];
      const featureUrls = features.map((f) => f.match?.url).filter((u) => u && !u.includes('*'));
      built = await buildCrawlGraph(browser, source, {
        roles,
        maxDepth: int('max-depth'),
        maxPages: int('max-pages'),
        maxClicks: int('max-clicks'),
        allowPost: values['allow-post'],
        timeout,
        settleMs: int('settle'),
        probe: [...new Set([...routes, ...featureUrls])],
      });
    }
  } finally {
    await browser.close();
  }

  const analysis = analyzeReachability(built.graph, features);
  const report = {
    tool: 'ux-flow-audit/nav-graph',
    mode: values.showcase ? 'showcase' : 'crawl',
    source,
    generatedAt: new Date().toISOString(),
    scope: built.scope ?? null,
    nodes: built.graph.nodes,
    edges: built.graph.roles.flatMap((r) => r.edges.map((e) => ({ role: r.id, ...e }))),
    ...analysis,
    flows: built.flows ?? [],
    skipped: built.skipped ?? [],
    broken: built.broken ?? [],
    blockedRequests: built.blocked ?? [],
    probes: built.probes ?? [],
    warnings: built.warnings ?? [],
  };
  emit(report, toMarkdown(report), { out: values.out, format: values.format, name: 'nav-graph' });
  return 0;
}

if (isMain(import.meta.url)) await runCli(main);
