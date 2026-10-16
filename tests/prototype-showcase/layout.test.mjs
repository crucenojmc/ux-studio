// The presentation format comes from the brief: LAYOUT.mode and LAYOUT.sections.
// Every mode keeps the capture contract (window.SHOWCASE, ?capture=, hash, data-go markup).
// Run: cd tests/prototype-showcase && npm test
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, OUT, buildPreview, launch, openPage, templateLayout } from './helpers.mjs';

const BRIEF_FORMAT = join(REPO, 'plugins/ux-studio/skills/presentation-brief/assets/presentation-format.questions.json');
const brief = JSON.parse(readFileSync(BRIEF_FORMAT, 'utf8'));
const MODES = brief.questions.find((q) => q.header === 'Formato').options.map((o) => o.id);
const SECTIONS = brief.questions.find((q) => q.header === 'Secciones').options.map((o) => o.id);
const sectionsFor = (mode) => (mode === 'app' ? [] : SECTIONS);

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

const urls = {};
const urlFor = (mode) => (urls[mode] ??= buildPreview(`layout-${mode}.html`, { layout: { mode, sections: sectionsFor(mode) } }));
const shown = (page, sel) => page.$eval(sel, (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden').catch(() => false);
const sectionOrder = (page) => page.$$eval('.sc-section', (els) => els.map((e) => e.id));

describe('LAYOUT in the template', () => {
  it('declares the format the brief records: mode, sections and their ids', () => {
    const layout = templateLayout();
    assert.ok(MODES.includes(layout.mode), `mode ${layout.mode}`);
    assert.ok(Array.isArray(layout.sections));
    for (const s of layout.sections) assert.ok(SECTIONS.includes(s), `section ${s}`);
  });

  it('rejects an unknown mode, an unknown section and sections in app mode', async () => {
    for (const [name, layout] of [
      ['bad-mode', { mode: 'full', sections: [] }],
      ['bad-section', { mode: 'tour', sections: ['metodo'] }],
      ['app-sections', { mode: 'app', sections: ['sistema'] }],
      ['narrow-web', { mode: 'tour', sections: [], webMinWidth: 600 }],
    ]) {
      const url = buildPreview(`layout-${name}.html`, { layout });
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(url);
      await page.waitForTimeout(200);
      assert.ok(errors.some((e) => /LAYOUT/.test(e)), `${name}: ${errors.join(' | ') || 'no error'}`);
      await context.close();
    }
  });
});

for (const mode of MODES) {
  describe(`mode "${mode}" keeps the capture contract`, () => {
    it('loads with zero console errors and marks the layout', async () => {
      const { context, page, errors } = await openPage(browser, { url: urlFor(mode) });
      await page.evaluate(() => window.SHOWCASE.open({ screen: 'inicio', role: 'tecnica' }));
      assert.equal(await page.$eval('#sc', (el) => el.dataset.layout), mode);
      assert.deepEqual(errors, []);
      await context.close();
    });

    it('?capture=web and ?capture=phone fill the viewport', async () => {
      for (const [frame, viewport, sel] of [
        ['web', { width: 1280, height: 800 }, '[data-frame="web"] .app'],
        ['phone', { width: 390, height: 844 }, '[data-frame="phone"] [data-phone-canvas]'],
      ]) {
        const { context, page } = await openPage(browser, { url: `${urlFor(mode)}?capture=${frame}#screen=ordenes&role=supervision`, viewport });
        await page.evaluate(() => window.SHOWCASE.open({ screen: 'ordenes', role: 'supervision' }));
        const r = await page.$eval(sel, (el) => el.getBoundingClientRect().toJSON());
        assert.ok(Math.abs(r.x) < 1 && Math.abs(r.y) < 1, `${mode}/${frame} at the corner: ${r.x},${r.y}`);
        assert.ok(Math.abs(r.width - viewport.width) < 1 && Math.abs(r.height - viewport.height) < 1, `${mode}/${frame} fills: ${r.width}x${r.height}`);
        assert.equal(await shown(page, '.sc-dock'), false, 'no dock in capture');
        await context.close();
      }
    });

    it('hash deep links, open() and targetRect() work, and data-go navigates', async () => {
      const { context, page } = await openPage(browser, { url: `${urlFor(mode)}#screen=reportes&role=administracion` });
      await page.waitForFunction(() => document.querySelector('[data-frame="web"] .app')?.dataset.screen === 'reportes');
      await page.evaluate(() => window.SHOWCASE.open({ screen: 'ordenes', role: 'supervision' }));
      const frame = (await shown(page, '[data-frame="web"]')) ? 'web' : 'phone';
      const rect = await page.evaluate((f) => window.SHOWCASE.targetRect('[data-go="orden"]', f), frame);
      assert.ok(rect && rect.width > 0, `target in ${frame}`);
      await page.click(`[data-frame="${frame}"] .app [data-go="orden"]`);
      assert.equal(await page.$eval(`[data-frame="${frame}"] .app`, (a) => a.dataset.screen), 'orden');
      assert.ok((await page.evaluate(() => window.SHOWCASE.flows())).length >= 4, 'flows() keeps its data');
      await context.close();
    });
  });
}

describe('mode "app": the simulated app alone', () => {
  it('fills the viewport under a demo-data strip, with no hero, index, flows or sections', async () => {
    const { context, page } = await openPage(browser, { url: urlFor('app') });
    for (const sel of ['.sc-hero', '[data-index]', '.sc-foot', '[data-frame="phone"]']) assert.equal(await shown(page, sel), false, sel);
    assert.deepEqual(await sectionOrder(page), []);
    assert.equal(await page.$('.sc-annex'), null);
    assert.match(await page.textContent('.sc-dock'), /demostración/i);
    const dock = await page.$eval('.sc-dock', (el) => el.getBoundingClientRect().height);
    const r = await page.$eval('[data-frame="web"] .app', (el) => el.getBoundingClientRect().toJSON());
    assert.ok(Math.abs(r.x) < 1 && Math.abs(r.y - dock) < 1, `under the dock: ${r.x},${r.y}`);
    assert.ok(Math.abs(r.width - 1440) < 1 && Math.abs(r.bottom - 900) < 1, `fills: ${r.width}x${r.bottom}`);
    const scroll = await page.evaluate(() => document.documentElement.scrollHeight);
    assert.ok(scroll <= 900, `no page scroll: ${scroll}`);
    await page.screenshot({ path: join(OUT, 'layout-app-1440.png') });
    await context.close();
  });

  it('switches role from the strip', async () => {
    const { context, page } = await openPage(browser, { url: urlFor('app') });
    await page.selectOption('.sc-dock select', 'administracion');
    await page.waitForFunction(() => document.querySelector('[data-frame="web"] .app').dataset.role === 'administracion');
    assert.equal(await page.$eval('.sc-dock select', (s) => s.value), 'administracion');
    await context.close();
  });

  it('shows the phone layout full width on a phone', async () => {
    const { context, page, errors } = await openPage(browser, { url: urlFor('app'), viewport: { width: 390, height: 844 } });
    assert.equal(await shown(page, '[data-frame="web"]'), false);
    const r = await page.$eval('[data-frame="phone"] .app', (el) => el.getBoundingClientRect().toJSON());
    assert.ok(Math.abs(r.width - 390) < 1, `full width: ${r.width}`);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(width <= 390, `no horizontal scroll: ${width}`);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: join(OUT, 'layout-app-390.png') });
    await context.close();
  });

  it('keeps the desktop frame on a phone when the product has no phone frame', async () => {
    const url = buildPreview('layout-app-desktop-only.html', { layout: { mode: 'app', sections: [], platforms: ['web'] } });
    const { context, page, errors } = await openPage(browser, { url, viewport: { width: 390, height: 844 } });
    assert.equal(await page.$('[data-frame="phone"]'), null, 'phone frame removed');
    assert.ok(await shown(page, '[data-frame="web"]'), 'web frame shown');
    assert.deepEqual(errors, []);
    await context.close();
  });
});

describe('mode "tour": the app with guided flows', () => {
  it('keeps controls, index and flows; drops the lede and the annex; shows only the chosen sections in order', async () => {
    const url = buildPreview('layout-tour-chosen.html', { layout: { mode: 'tour', sections: ['inventario', 'definiciones'] } });
    const { context, page, errors } = await openPage(browser, { url });
    for (const sel of ['[data-pref="theme"]', '[data-index]', '[data-flow-play]']) assert.ok(await shown(page, sel), sel);
    assert.equal(await page.$('.sc-lede'), null);
    assert.equal(await page.$('.sc-annex'), null);
    assert.deepEqual(await sectionOrder(page), ['flujos', 'inventario', 'definiciones']);
    await page.click('[data-flow-play]');
    assert.equal(await page.getAttribute('[data-player-bar]', 'data-state'), 'playing');
    assert.deepEqual(errors, []);
    await page.screenshot({ path: join(OUT, 'layout-tour-1440.png') });
    await context.close();
  });
});

describe('mode "ux-system": the complete UX system', () => {
  it('keeps the hero, the annex and the chosen sections in order', async () => {
    const url = buildPreview('layout-ux-system-chosen.html', { layout: { mode: 'ux-system', sections: ['definiciones', 'principios'] } });
    const { context, page, errors } = await openPage(browser, { url });
    for (const sel of ['.sc-hero', '.sc-lede', '.sc-annex', '[data-flow-play]']) assert.ok(await shown(page, sel), sel);
    assert.deepEqual(await sectionOrder(page), ['flujos', 'definiciones', 'principios']);
    assert.equal(await page.$('#sistema'), null, 'Sistema only when chosen');
    assert.deepEqual(errors, []);
    await context.close();
  });
});

describe('LAYOUT.webMinWidth: the logical width of the desktop canvas', () => {
  it('is 1080 in the template', () => {
    assert.equal(templateLayout().webMinWidth, 1080);
  });

  it('renders the desktop layout at that width and scales it to the frame', async () => {
    const url = buildPreview('layout-web-1440.html', { layout: { webMinWidth: 1440 } });
    const { context, page, errors } = await openPage(browser, { url: `${url}?capture=web`, viewport: { width: 1280, height: 800 } });
    await page.evaluate(() => window.SHOWCASE.open({ screen: 'ordenes', role: 'supervision' }));
    const app = await page.$eval('[data-frame="web"] .app', (el) => ({ logical: el.offsetWidth, shown: el.getBoundingClientRect().width }));
    assert.equal(app.logical, 1440);
    assert.ok(Math.abs(app.shown - 1280) < 1, `scaled to the viewport: ${app.shown}`);
    assert.deepEqual(errors, []);
    await context.close();
  });
});

describe('section "Definiciones y decisiones"', () => {
  it('renders every definition and decision with its status and date', async () => {
    const url = buildPreview('layout-defs.html', { layout: { mode: 'tour', sections: ['definiciones'] } });
    const { context, page } = await openPage(browser, { url });
    const items = await page.$$eval('#definiciones [data-status]', (els) => els.map((e) => ({
      kind: e.closest('[data-definitions]') ? 'definition' : e.closest('[data-decisions]') ? 'decision' : null,
      status: e.dataset.status,
      label: e.querySelector('.sc-state')?.textContent.trim(),
      date: e.querySelector('time')?.getAttribute('datetime'),
      when: e.querySelector('time')?.textContent.trim(),
    })));
    for (const kind of ['definition', 'decision']) {
      const list = items.filter((i) => i.kind === kind);
      assert.ok(list.length >= 2, `${kind}s rendered`);
      assert.deepEqual([...new Set(list.map((i) => i.status))].sort(), ['decided', 'open'], `${kind}: open and decided`);
    }
    for (const i of items) {
      assert.match(i.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(i.when.length > 0, 'formatted date');
      assert.equal(i.label, i.status === 'open' ? 'Abierta' : 'Decidida');
    }
    await context.close();
  });
});

// LAYOUT.platforms and LAYOUT.roles come from the BRIEF section "Alcance del diseño".
const loadErrors = async (url) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  await page.waitForTimeout(200);
  return { context, page, errors };
};
const count = (page, sel) => page.$$eval(sel, (els) => els.length);
const ONE_ROLE = (src) => src.replace(/(const ROLES = \[\n[^\n]*\n)(?:[^\n]*\n){2}(\];)/, '$1$2');

describe('LAYOUT.platforms: the frames the brief chose', () => {
  it('the template declares both platforms and every role', () => {
    const layout = templateLayout();
    assert.deepEqual(layout.platforms, ['web', 'phone']);
    assert.equal(layout.roles, 'all');
  });

  it('shows the Vista control when both platforms are declared', async () => {
    const { context, page } = await openPage(browser, { url: urlFor('ux-system') });
    assert.ok(await shown(page, '[data-pref="view"]'));
    assert.ok(await shown(page, '[data-frame="web"]') && await shown(page, '[data-frame="phone"]'));
    await context.close();
  });

  for (const [platform, other] of [['web', 'phone'], ['phone', 'web']]) {
    const url = () => buildPreview(`layout-only-${platform}.html`, { layout: { mode: 'ux-system', platforms: [platform] } });

    it(`["${platform}"] renders only that frame and hides the Vista control, on desktop and phone viewports`, async () => {
      for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
        const { context, page, errors } = await openPage(browser, { url: url(), viewport });
        assert.equal(await count(page, `[data-frame="${other}"]`), 0, `${other} frame absent`);
        assert.ok(await shown(page, `[data-frame="${platform}"]`), `${platform} frame shown at ${viewport.width}`);
        assert.equal(await shown(page, '[data-pref="view"]'), false, 'no Vista control');
        await page.evaluate(() => window.SHOWCASE.open({ screen: 'ordenes', role: 'supervision' }));
        const rect = await page.evaluate((f) => window.SHOWCASE.targetRect('[data-go="orden"]', f), platform);
        assert.ok(rect && rect.width > 0, `target in ${platform}`);
        assert.deepEqual(errors, []);
        await context.close();
      }
    });

    it(`["${platform}"] captures ${platform} and refuses ?capture=${other} on the page`, async () => {
      const ok = await openPage(browser, { url: `${url()}?capture=${platform}` });
      assert.ok(await shown(ok.page, `[data-frame="${platform}"]`));
      assert.deepEqual(ok.errors, []);
      await ok.context.close();
      const { context, page, errors } = await loadErrors(`${url()}?capture=${other}`);
      assert.ok(errors.some((e) => e.includes(`capture=${other}`) && /LAYOUT\.platforms/.test(e)), errors.join(' | ') || 'no error');
      assert.equal(await page.evaluate(() => typeof window.SHOWCASE), 'undefined');
      assert.equal(await count(page, '[data-frame]'), 0, 'no frame is rendered');
      assert.match(await page.textContent('body'), /LAYOUT\.platforms/);
      await context.close();
    });
  }

  it('in mode "app" with only the phone, shows the phone on a desktop viewport', async () => {
    const url = buildPreview('layout-app-only-phone.html', { layout: { mode: 'app', sections: [], platforms: ['phone'] } });
    const { context, page, errors } = await openPage(browser, { url });
    assert.equal(await count(page, '[data-frame="web"]'), 0);
    assert.ok(await shown(page, '[data-frame="phone"]'));
    assert.deepEqual(errors, []);
    await context.close();
  });

  it('rejects platforms that are not web and/or phone, each once', async () => {
    for (const [name, platforms] of [['none', []], ['tablet', ['tablet']], ['twice', ['web', 'web']], ['string', 'web']]) {
      const { context, errors } = await loadErrors(buildPreview(`layout-platforms-${name}.html`, { layout: { platforms } }));
      assert.ok(errors.some((e) => /LAYOUT\.platforms/.test(e)), `${name}: ${errors.join(' | ') || 'no error'}`);
      await context.close();
    }
  });
});

describe('LAYOUT.roles: the roles the brief chose', () => {
  it('"all" keeps the role selector, every role and the locks', async () => {
    const { context, page } = await openPage(browser, { url: urlFor('ux-system') });
    assert.ok(await shown(page, '[data-seg="role"]'));
    assert.equal((await page.$$('[data-seg="role"] [data-pref="role"]')).length, 3);
    assert.equal((await page.evaluate(() => window.SHOWCASE.roles())).length, 3);
    await page.evaluate(() => window.SHOWCASE.open({ screen: 'inicio', role: 'administracion' }));
    assert.equal(await page.$eval('[data-index-item="agenda"]', (b) => b.dataset.locked), 'true');
    await context.close();
  });

  it('{ focus } shows only that role: its screens, sheets and flows; no selector, no locks', async () => {
    const url = buildPreview('layout-roles-focus.html', { layout: { mode: 'ux-system', roles: { focus: 'administracion' } } });
    const { context, page, errors } = await openPage(browser, { url: `${url}#screen=agenda&role=tecnica` });
    const api = await page.evaluate(() => ({
      roles: window.SHOWCASE.roles().map((r) => r.id),
      screens: window.SHOWCASE.screens(),
      sheets: window.SHOWCASE.sheets(),
      flows: window.SHOWCASE.flows().map((f) => f.id),
    }));
    assert.deepEqual(api.roles, ['administracion']);
    assert.deepEqual(api.screens.map((s) => s.id), ['inicio', 'ordenes', 'orden', 'equipos', 'reportes', 'ajustes']);
    assert.deepEqual(api.sheets.map((s) => s.id), ['nueva-orden']);
    for (const d of [...api.screens, ...api.sheets]) assert.deepEqual(d.access, ['administracion'], d.id);
    assert.deepEqual(api.flows, ['gasto-del-mes']);
    assert.equal(await shown(page, '[data-seg="role"]'), false, 'no role control');
    const index = await page.$$eval('[data-index-item]', (els) => els.map((e) => [e.dataset.indexItem, e.dataset.locked]));
    assert.deepEqual(index.map(([id]) => id).sort(), [...api.screens, ...api.sheets].map((d) => d.id).sort());
    assert.ok(index.every(([, locked]) => locked === 'false'), 'no locked item');
    assert.deepEqual(await page.$$eval('[data-flow]', (els) => els.map((e) => e.dataset.flow)), ['gasto-del-mes']);
    const who = await page.$$eval('[data-inventory] tbody tr td:nth-child(3)', (tds) => [...new Set(tds.map((t) => t.textContent.trim()))]);
    assert.deepEqual(who, ['Administración']);
    const app = await page.$eval('[data-frame="web"] .app', (a) => ({ role: a.dataset.role, screen: a.dataset.screen }));
    assert.deepEqual(app, { role: 'administracion', screen: 'reportes' }, 'a link to another role lands on the focus role home');
    assert.deepEqual(errors, []);
    await context.close();
  });

  it('"single" with one role in ROLES: no selector, that role and its flows only', async () => {
    const url = buildPreview('layout-roles-single.html', { layout: { mode: 'app', sections: [], roles: 'single' }, edit: ONE_ROLE });
    const { context, page, errors } = await openPage(browser, { url });
    assert.deepEqual(await page.evaluate(() => window.SHOWCASE.roles().map((r) => r.id)), ['tecnica']);
    assert.deepEqual(await page.evaluate(() => window.SHOWCASE.flows().map((f) => f.id)), ['cerrar-en-el-lugar']);
    assert.equal(await shown(page, '.sc-dock select'), false, 'no role selector in the strip');
    assert.deepEqual(errors, []);
    await context.close();
  });

  it('rejects "single" with several roles, an unknown focus role and an unknown value', async () => {
    for (const [name, roles] of [['single-of-three', 'single'], ['focus-unknown', { focus: 'nadie' }], ['focus-empty', {}], ['word', 'some']]) {
      const { context, errors } = await loadErrors(buildPreview(`layout-roles-${name}.html`, { layout: { roles } }));
      assert.ok(errors.some((e) => /LAYOUT\.roles/.test(e)), `${name}: ${errors.join(' | ') || 'no error'}`);
      await context.close();
    }
  });
});
