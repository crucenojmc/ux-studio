// Smoke tests for assets/showcase-template.html, wrapped by assets/preview.mjs.
// Run: cd tests/prototype-showcase && npm test
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TEMPLATE, OUT, buildPreview, launch, openPage, contrastPairs } from './helpers.mjs';

let browser;
let url;

before(async () => {
  url = buildPreview();
  browser = await launch();
});

after(async () => {
  await browser?.close();
});

async function session(opts = {}) {
  return openPage(browser, { url: url + (opts.suffix || ''), ...opts });
}

describe('template file', () => {
  it('is an artifact fragment: no document skeleton, short title, allowed hosts, lean', () => {
    const src = readFileSync(TEMPLATE, 'utf8');
    assert.doesNotMatch(src, /<!doctype/i, 'no doctype');
    assert.doesNotMatch(src, /<html[\s>]|<head[\s>]|<body[\s>]/i, 'no html/head/body tags');
    const title = src.match(/<title>([^<]*)<\/title>/i);
    assert.ok(title, 'has a <title>');
    const words = title[1].trim().split(/\s+/).length;
    assert.ok(words >= 2 && words <= 4, `title has 2-4 words, got "${title[1]}"`);
    for (const m of src.matchAll(/<script[^>]+src="([^"]+)"/gi)) {
      assert.match(m[1], /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net\/npm|unpkg\.com)\//, `script host allowed: ${m[1]}`);
    }
    for (const m of src.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"/gi)) {
      assert.match(m[1], /^https:\/\/fonts\.googleapis\.com\//, `stylesheet host allowed: ${m[1]}`);
    }
    assert.doesNotMatch(src, /<iframe/i, 'never iframes');
    assert.doesNotMatch(src, /<img[^>]+src="https?:/i, 'no external images');
    const kb = statSync(TEMPLATE).size / 1024;
    assert.ok(kb < 225, `template under 225 KB, got ${kb.toFixed(1)} KB`);
  });

  it('declares the viewport meta so a phone renders it at device width', () => {
    const src = readFileSync(TEMPLATE, 'utf8');
    assert.match(src, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  });

  it('copy is neutral Spanish: no voseo and no regional forms', () => {
    const src = readFileSync(TEMPLATE, 'utf8');
    // Words ending in a stressed vowel (+ s) that are not voseo: the rest («Navegá», «tenés», «Elegí») are.
    const ALLOWED = new Set(['qué', 'Qué', 'está', 'esté', 'más', 'después', 'Después', 'además', 'detrás', 'aquí', 'Mié', 'Tomás', 'Nicolás']);
    const found = [...new Set([...src.matchAll(/\p{L}+(?:á|é|í)s?(?!\p{L})/gu)].map((m) => m[0]))].filter((w) => !ALLOWED.has(w));
    assert.deepEqual(found, [], `voseo-like forms: ${found.join(', ')}`);
    for (const w of ['acá', 'tomaste', 'Buen día', 'playa de carga']) {
      assert.doesNotMatch(src, new RegExp(`(?<!\\p{L})${w}(?!\\p{L})`, 'u'), w);
    }
  });
});

describe('showcase page', () => {
  it('loads with zero console errors', async () => {
    const { context, page, errors } = await session();
    await page.evaluate(() => window.SHOWCASE.open({ screen: 'inicio', role: 'tecnica' }));
    await page.waitForTimeout(400);
    assert.deepEqual(errors, []);
    await context.close();
  });

  it('index lists every registry screen and sheet', async () => {
    const { context, page } = await session();
    const reg = await page.evaluate(() => ({
      screens: window.SHOWCASE.screens(),
      sheets: window.SHOWCASE.sheets ? window.SHOWCASE.sheets() : [],
    }));
    assert.ok(reg.screens.length >= 7, 'at least 7 screens');
    for (const s of reg.screens) {
      assert.deepEqual(Object.keys(s).sort(), ['access', 'desc', 'group', 'id', 'kind', 'path', 'title'].sort());
      assert.ok(['tab', 'root', 'push'].includes(s.kind), `kind of ${s.id}`);
      assert.ok(Array.isArray(s.access) && s.access.length > 0);
    }
    const expected = [...reg.screens, ...reg.sheets].map((s) => s.id).sort();
    const listed = await page.$$eval('[data-index-item]', (els) => els.map((e) => e.dataset.indexItem).sort());
    assert.deepEqual(listed, expected);
    await context.close();
  });

  it('switching role locks and unlocks screens, naming who can see them', async () => {
    const { context, page } = await session();
    await page.click('[data-pref="role"][data-value="tecnica"]');
    assert.equal(await page.getAttribute('[data-pref="role"][data-value="tecnica"]', 'aria-pressed'), 'true');
    assert.equal(await page.getAttribute('[data-index-item="reportes"]', 'data-locked'), 'true');
    assert.match(await page.textContent('[data-index-item="reportes"]'), /Supervisión|Administración/);
    await page.click('[data-pref="role"][data-value="administracion"]');
    assert.equal(await page.getAttribute('[data-index-item="reportes"]', 'data-locked'), 'false');
    assert.equal(await page.getAttribute('[data-index-item="agenda"]', 'data-locked'), 'true');
    const roles = await page.evaluate(() => window.SHOWCASE.roles());
    for (const r of roles) assert.deepEqual(Object.keys(r).sort(), ['home', 'id', 'label']);
    await context.close();
  });

  it('open() resolves and both frames show the same screen', async () => {
    const { context, page } = await session();
    const detail = await page.evaluate(() => new Promise((resolve) => {
      window.addEventListener('showcase:rendered', (e) => resolve(e.detail), { once: true });
      window.SHOWCASE.open({ screen: 'equipos', role: 'tecnica' });
    }));
    assert.deepEqual(detail, { screen: 'equipos', role: 'tecnica', sheet: null });

    await page.evaluate(() => window.SHOWCASE.open({ screen: 'orden', role: 'supervision', set: { order: 'OT-4817' } }, { view: 'both' }));
    const apps = await page.$$eval('[data-frame] .app', (els) => els.map((a) => ({
      screen: a.dataset.screen,
      role: a.dataset.role,
      title: a.querySelector('[data-app-title]')?.textContent.trim(),
      visible: a.getBoundingClientRect().width > 0,
    })));
    assert.equal(apps.length, 2);
    assert.ok(apps.every((a) => a.visible), 'both frames visible at 1440');
    assert.ok(apps[0].title, 'title rendered');
    assert.deepEqual(apps[0], apps[1]);
    assert.equal(apps[0].screen, 'orden');
    assert.match(await page.textContent('[data-url]'), /\/ordenes\/OT-4817/);
    assert.match(await page.textContent('[data-caption="web"]'), /Supervisión/);
    await context.close();
  });

  it('flows() matches the contract and every target exists in both frames', async () => {
    const { context, page } = await session();
    const { flows, screens, roles } = await page.evaluate(() => ({
      flows: window.SHOWCASE.flows(),
      screens: window.SHOWCASE.screens().map((s) => s.id),
      roles: window.SHOWCASE.roles().map((r) => r.id),
    }));
    const sheets = await page.evaluate(() => (window.SHOWCASE.sheets ? window.SHOWCASE.sheets().map((s) => s.id) : []));
    assert.ok(flows.length >= 4, 'at least 4 flows');
    for (const f of flows) {
      assert.equal(typeof f.id, 'string');
      assert.ok(roles.includes(f.role), `flow ${f.id} role`);
      assert.equal(typeof f.title, 'string');
      assert.equal(typeof f.lede, 'string');
      assert.ok(Array.isArray(f.steps) && f.steps.length >= 2);
      for (const s of f.steps) {
        assert.equal(typeof s.label, 'string');
        assert.ok(screens.includes(s.to.screen), `screen ${s.to.screen}`);
        if (s.to.role) assert.ok(roles.includes(s.to.role));
        if (s.to.sheet) assert.ok(sheets.includes(s.to.sheet));
        if ('say' in s) assert.equal(typeof s.say, 'string');
        if (!s.target) continue;
        await page.evaluate((to) => window.SHOWCASE.open(to), s.to);
        const rects = await page.evaluate((t) => [window.SHOWCASE.targetRect(t, 'web'), window.SHOWCASE.targetRect(t, 'phone')], s.target);
        for (const r of rects) {
          assert.ok(r && r.width > 0 && r.height > 0, `target ${s.target} in ${f.id}/${s.label}`);
        }
      }
    }
    await context.close();
  });

  it('plays a flow, advances steps, and stops when the user clicks inside the app', async () => {
    const { context, page } = await session({ reducedMotion: 'reduce' });
    await page.click('[data-pref="motion"][data-value="reduced"]');
    const first = await page.evaluate(() => window.SHOWCASE.flows()[0].id);
    await page.click(`[data-flow-play="${first}"]`);
    const bar = '[data-player-bar]';
    for (let i = 0; i < 4 && (await page.getAttribute(bar, 'data-speed')) !== '2'; i++) {
      await page.click('[data-player="speed"]');
    }
    assert.equal(await page.getAttribute(bar, 'data-speed'), '2');
    assert.equal(await page.getAttribute(bar, 'data-state'), 'playing');
    await page.waitForFunction(() => Number(document.querySelector('[data-player-bar]').dataset.step) >= 1, null, { timeout: 15000 });
    assert.ok((await page.textContent('[data-player-say]')).trim().length > 0, 'narration line shown');
    await page.click('[data-frame="web"] .app [data-app-title]');
    assert.notEqual(await page.getAttribute(bar, 'data-state'), 'playing');
    const step = await page.getAttribute(bar, 'data-step');
    await page.waitForTimeout(2500);
    assert.equal(await page.getAttribute(bar, 'data-step'), step, 'playback stays stopped');
    await context.close();
  });

  it('theme toggle changes the computed --surface-page and persists', async () => {
    const { context, page } = await session();
    const read = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--surface-page').trim());
    await page.click('[data-pref="theme"][data-value="light"]');
    const light = await read();
    await page.click('[data-pref="theme"][data-value="dark"]');
    const dark = await read();
    assert.notEqual(light, dark);
    assert.equal(await page.getAttribute('[data-pref="theme"][data-value="dark"]', 'aria-pressed'), 'true');
    await page.reload();
    await page.waitForFunction(() => window.SHOWCASE);
    assert.equal(await read(), dark, 'theme persisted');
    await context.close();
  });

  it('meets 4.5:1 text contrast in both themes', async () => {
    const { context, page } = await session();
    const pairs = [
      ['--text-primary', '--surface-page'], ['--text-secondary', '--surface-page'], ['--text-tertiary', '--surface-page'],
      ['--text-primary', '--surface-raised'], ['--text-secondary', '--surface-raised'], ['--text-tertiary', '--surface-raised'],
      ['--text-secondary', '--surface-sunken'], ['--on-accent', '--accent'],
      ['--status-ok', '--status-ok-bg'], ['--status-warn', '--status-warn-bg'],
      ['--status-danger', '--status-danger-bg'], ['--status-info', '--status-info-bg'],
    ];
    for (const theme of ['light', 'dark']) {
      await page.click(`[data-pref="theme"][data-value="${theme}"]`);
      for (const p of await contrastPairs(page, pairs)) {
        assert.ok(p.ratio >= 4.5, `${theme}: ${p.fg} on ${p.bg} = ${p.ratio.toFixed(2)}`);
      }
    }
    await context.close();
  });

  it('?capture=web renders only the web frame filling the viewport', async () => {
    const { context, page } = await session({
      suffix: '?capture=web&theme=dark&motion=reduced#screen=ordenes&role=supervision',
      viewport: { width: 1280, height: 800 },
    });
    await page.evaluate(() => window.SHOWCASE.open({ screen: 'ordenes', role: 'supervision' }));
    const r = await page.$eval('[data-frame="web"] .app', (el) => el.getBoundingClientRect().toJSON());
    assert.ok(Math.abs(r.x) < 1 && Math.abs(r.y) < 1, 'starts at the top-left corner');
    assert.ok(Math.abs(r.width - 1280) < 1 && Math.abs(r.height - 800) < 1, `fills viewport: ${r.width}x${r.height}`);
    assert.equal(await page.isVisible('.sc-hero'), false, 'hero hidden');
    assert.equal(await page.isVisible('[data-frame="phone"]'), false, 'phone hidden');
    assert.equal(await page.isVisible('[data-index]'), false, 'index hidden');
    assert.equal(await page.$eval('[data-frame="web"] .app', (a) => a.dataset.screen), 'ordenes');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
    const scroll = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
    assert.ok(scroll[0] <= 1280 && scroll[1] <= 800, `no page scroll: ${scroll}`);
    const rect = await page.evaluate(() => window.SHOWCASE.targetRect('[data-app-title]', 'web'));
    assert.ok(rect && rect.x >= 0 && rect.y >= 0);
    await page.screenshot({ path: join(OUT, 'capture-web-1280-dark.png') });
    await context.close();
  });

  it('?capture=phone fills a phone viewport', async () => {
    const { context, page } = await session({ suffix: '?capture=phone#screen=inicio&role=tecnica', viewport: { width: 390, height: 844 } });
    await page.evaluate(() => window.SHOWCASE.open({ screen: 'inicio', role: 'tecnica' }));
    const r = await page.$eval('[data-frame="phone"] [data-phone-canvas]', (el) => el.getBoundingClientRect().toJSON());
    assert.ok(Math.abs(r.width - 390) < 1 && Math.abs(r.height - 844) < 1, `fills viewport: ${r.width}x${r.height}`);
    assert.equal(await page.isVisible('[data-frame="web"]'), false);
    await page.screenshot({ path: join(OUT, 'capture-phone-390-light.png') });
    await context.close();
  });

  it('opened without the preview wrapper, a phone renders the page at device width', async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    const page = await context.newPage();
    await page.goto(pathToFileURL(TEMPLATE).href);
    assert.equal(await page.evaluate(() => window.innerWidth), 390);
    await context.close();
  });

  it('the hero title keeps its lines apart when the design system sets an absolute display line height', async () => {
    const abs = buildPreview('preview-absolute-line.html', { edit: (src) => src.replace('--text-display-line: 1.02;', '--text-display-line: 30px;') });
    const { context, page } = await openPage(browser, { url: abs });
    const t = await page.$eval('.sc-title', (el) => {
      const cs = getComputedStyle(el);
      return { token: getComputedStyle(document.documentElement).getPropertyValue('--text-display-line').trim(), size: parseFloat(cs.fontSize), line: parseFloat(cs.lineHeight) };
    });
    assert.equal(t.token, '30px', 'token overridden');
    assert.ok(t.line >= t.size, `line-height ${t.line}px is below the font size ${t.size}px`);
    await context.close();
  });

  it('hash deep links select screen and role', async () => {
    const { context, page } = await session({ suffix: '#screen=reportes&role=administracion' });
    await page.waitForFunction(() => document.querySelector('[data-frame="web"] .app')?.dataset.screen === 'reportes');
    assert.equal(await page.$eval('[data-frame="web"] .app', (a) => a.dataset.role), 'administracion');
    await context.close();
  });

  it('has no horizontal scroll at 390px, with and without the screen index open', async () => {
    const { context, page, errors } = await session({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
    const overflow = () => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
    assert.ok((await overflow()) <= 390, `scrollWidth ${await overflow()}`);
    await page.click('[data-index-toggle]');
    assert.equal(await page.getAttribute('[data-index-toggle]', 'aria-expanded'), 'true');
    assert.ok((await overflow()) <= 390);
    await page.keyboard.press('Escape');
    assert.equal(await page.getAttribute('[data-index-toggle]', 'aria-expanded'), 'false');
    assert.deepEqual(errors, []);
    await context.close();
  });

  it('writes review screenshots (1440 dark, 1440 light, 390 dark)', async () => {
    const shots = [
      { name: 'showcase-1440-dark.png', viewport: { width: 1440, height: 900 }, colorScheme: 'dark' },
      { name: 'showcase-1440-light.png', viewport: { width: 1440, height: 900 }, colorScheme: 'light' },
      { name: 'showcase-390-dark.png', viewport: { width: 390, height: 844 }, colorScheme: 'dark' },
    ];
    for (const s of shots) {
      const { context, page, errors } = await session({ ...s, reducedMotion: 'reduce' });
      await page.evaluate(() => window.SHOWCASE.open({ screen: 'inicio', role: 'supervision' }));
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(OUT, s.name.replace('.png', '-fold.png')) });
      // Full page by growing the viewport: Chromium's fullPage capture dims scaled, scrollable layers.
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width: s.viewport.width, height });
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(OUT, s.name) });
      assert.deepEqual(errors, [], `${s.name}: console clean`);
      await context.close();
    }
  });
});
