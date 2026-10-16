// Shared helpers for the ux-recipes starter and recipe checks.
// Render checks use an existing Chromium-family binary (never downloaded) and block the network.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '../..');
export const PLUGIN = path.join(REPO, 'plugins/ux-studio');
export const SKILL = path.join(PLUGIN, 'skills/ux-recipes');
export const RECIPES = path.join(SKILL, 'recipes');
export const STARTERS = path.join(SKILL, 'assets/starters');

export const starter = (name) => path.join(STARTERS, name);
export const readStarter = (name) => readFileSync(starter(name), 'utf8');
export const starterUrl = (name) => pathToFileURL(starter(name)).href;

/** ux-studio skills that exist as a folder with a SKILL.md (ux-recipes itself excluded). */
export function pluginSkills() {
  return readdirSync(path.join(PLUGIN, 'skills'), { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'ux-recipes' && existsSync(path.join(PLUGIN, 'skills', e.name, 'SKILL.md')))
    .map((e) => e.name);
}

export function hasPlaywright() {
  try {
    createRequire(path.join(HERE, 'package.json')).resolve('playwright-core');
    return true;
  } catch {
    return false;
  }
}

/** CHROME_PATH or the detection shared with implementation-fidelity's capture-states.mjs. */
export async function findChrome() {
  const mod = await import(path.join(PLUGIN, 'skills/implementation-fidelity/assets/capture-states.mjs'));
  return mod.findChrome();
}

export async function launch(args = []) {
  const executablePath = await findChrome();
  if (!executablePath) throw new Error('No Chromium-family browser found. Set CHROME_PATH.');
  const { chromium } = await import('playwright-core');
  return chromium.launch({ executablePath, headless: true, args });
}

/**
 * Open a starter in a fresh context. Every http(s) request is recorded and, unless `network`
 * is true, aborted: the starters must work offline or degrade visibly.
 */
export async function openStarter(browser, name, { viewport = { width: 390, height: 844 }, colorScheme = 'light', reducedMotion = 'no-preference', network = false } = {}) {
  const context = await browser.newContext({ viewport, colorScheme, reducedMotion });
  const requests = [];
  await context.route(/^https?:\/\//, (route) => {
    requests.push(route.request().url());
    return network ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(starterUrl(name));
  return { context, page, errors, requests };
}

/** Pixels the page scrolls sideways (0 when it fits the viewport). */
export const horizontalOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/* ---------------------------------------------------------------- static parsing */

const ALLOWED_SCRIPT = [
  /^https:\/\/cdn\.jsdelivr\.net\/npm\/(?:@[^/@]+\/)?[^/@]+@\d+\.\d+\.\d+(?:\/|$)/,
  /^https:\/\/unpkg\.com\/(?:@[^/@]+\/)?[^/@]+@\d+\.\d+\.\d+(?:\/|$)/,
  /^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/[^/]+\/\d+\.\d+\.\d+\//,
];
const FONT_HOSTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;
const NAMESPACE = /^https?:\/\/www\.w3\.org\//;

/** Navigation targets (href on anything but <link>): links, not loaded resources. */
function navigationUrls(html) {
  return new Set([...html.matchAll(/<(?!link\b)[a-z][\w:-]*\b[^>]*?\bhref="(https?:[^"]*)"/gi)].map((m) => m[1]));
}

/** Every http(s) URL the page would load: scripts, import maps, imports, stylesheets, media. */
export function resourceUrls(html) {
  const nav = navigationUrls(html);
  return [...html.matchAll(/https?:\/\/[^\s"'`()<>,]+/g)]
    .map((m) => m[0].replace(/[.;]+$/, ''))
    .filter((u) => !nav.has(u) && !NAMESPACE.test(u));
}

/** Why a resource URL breaks the artifact rules, or null when it is allowed and pinned. */
export function urlProblem(url) {
  if (/@latest\b/.test(url)) return 'uses @latest';
  if (FONT_HOSTS.test(url)) return null;
  if (ALLOWED_SCRIPT.some((re) => re.test(url))) return null;
  if (/^https:\/\/(cdn\.jsdelivr\.net\/npm|unpkg\.com|cdnjs\.cloudflare\.com)\//.test(url)) return 'not pinned to an exact x.y.z version';
  return 'host not allowed';
}

/** Markup without ordinary comments; Outlook conditional comments (<!--[if ...]>) stay, they render there. */
export const markup = (html) => html.replace(/<!--(?!\[if)[\s\S]*?-->/g, '');

/** Body of every <style> block. */
export const styleBlocks = (html) => [...markup(html).matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);

/** Every opening tag of one element name, comments excluded. */
export const tags = (html, name) => [...markup(html).matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map((m) => m[0]);

/** CSS left after removing comments and every @media block (brace-matched). */
export function cssOutsideMedia(css) {
  let src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let out = '';
  for (let i = 0; i < src.length;) {
    if (src.startsWith('@media', i)) {
      const open = src.indexOf('{', i);
      let depth = 0;
      let j = open;
      for (; j < src.length; j++) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}' && --depth === 0) break;
      }
      i = j + 1;
    } else out += src[i++];
  }
  return out.trim();
}

/** Visible copy of a page: text outside tags, scripts and styles (for the language checks). */
export function visibleText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

// Voseo forms that never occur in neutral Spanish (ambiguous forms such as "elegí" are left out).
const VOSEO = /(?<!\p{L})(vos|sos|tenés|querés|podés|sabés|hacés|decís|necesitás|usás|elegís|mirá|fijate|tocá|hacé|decime|contame|probá|revisá|completá|ingresá|seleccioná|confirmá|guardá|descargá|elegilo|usalo)(?!\p{L})/giu;
export const voseo = (text) => [...text.matchAll(VOSEO)].map((m) => m[0]);
