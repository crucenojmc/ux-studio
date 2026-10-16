// Chromium render checks for the ux-recipes starters, offline (every http(s) request is aborted).
// animation.html and html-email.html must work with no network at all; diagram.html and
// object-3d.html must degrade visibly when their CDN is unreachable.
// UX_RECIPES_NETWORK=1 also renders diagram.html and object-3d.html against the real CDN.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { findChrome, hasPlaywright, horizontalOverflow, launch, openStarter } from './helpers.mjs';

const chrome = hasPlaywright() ? await findChrome() : null;
const skip = !hasPlaywright() ? 'playwright-core is not installed' : !chrome ? 'no Chromium-family browser (set CHROME_PATH)' : false;
const PHONE = { width: 390, height: 844 };

let browser;
before(async () => { if (!skip) browser = await launch(['--enable-unsafe-swiftshader']); });
after(async () => { await browser?.close(); });

/** Opacity and transform of every step target: the animation's visible state. */
const state = (page) => page.evaluate(() => window.ANIMATION.steps
  .map((s) => { const cs = getComputedStyle(document.querySelector(s.target)); return `${s.target}:${cs.opacity}|${cs.transform}`; })
  .join(';'));

describe('animation.html renders', { skip }, () => {
  test('at 390 px: no console errors, no network, no horizontal scroll', async () => {
    const { context, page, errors, requests } = await openStarter(browser, 'animation.html', { viewport: PHONE });
    await page.waitForFunction(() => window.ANIMATION?.steps?.length >= 2);
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
    assert.equal(await horizontalOverflow(page), 0);
    await context.close();
  });

  test('seek(t) changes the computed state and is deterministic', async () => {
    const { context, page } = await openStarter(browser, 'animation.html', { viewport: PHONE });
    await page.waitForFunction(() => window.ANIMATION?.steps?.length >= 2);
    await page.evaluate(() => window.ANIMATION.seek(0));
    const start = await state(page);
    await page.evaluate(() => window.ANIMATION.seek(window.ANIMATION.duration));
    const end = await state(page);
    assert.notEqual(start, end);
    await page.evaluate(() => window.ANIMATION.seek(0));
    assert.equal(await state(page), start);
    await context.close();
  });

  test('every step names its target and sits inside the timeline', async () => {
    const { context, page } = await openStarter(browser, 'animation.html', { viewport: PHONE });
    await page.waitForFunction(() => window.ANIMATION?.steps?.length >= 2);
    const steps = await page.evaluate(() => window.ANIMATION.steps.map((s) => ({ ...s, found: !!document.querySelector(s.target) })));
    const total = await page.evaluate(() => window.ANIMATION.duration);
    for (const s of steps) {
      assert.ok(s.name && s.found, `step ${s.name} → ${s.target}`);
      assert.ok(s.start >= 0 && s.duration > 0 && s.start + s.duration <= total, `${s.name} fits in ${total} ms`);
    }
    await context.close();
  });

  test('the controls drive it: speed, scrubber, replay', async () => {
    const { context, page } = await openStarter(browser, 'animation.html', { viewport: PHONE });
    await page.waitForFunction(() => window.ANIMATION?.steps?.length >= 2);
    await page.click('[data-speed="2"]');
    assert.equal(await page.evaluate(() => window.ANIMATION.speed), 2);
    assert.equal(await page.getAttribute('[data-speed="2"]', 'aria-pressed'), 'true');
    const total = await page.evaluate(() => window.ANIMATION.duration);
    await page.locator('input[type="range"]').fill(String(total));
    const end = await state(page);
    await page.evaluate(() => window.ANIMATION.seek(0));
    const start = await state(page);
    await page.locator('input[type="range"]').fill(String(total));
    assert.equal(await state(page), end);
    assert.notEqual(start, end);
    await page.getByRole('button', { name: 'Repetir' }).click();
    assert.equal(await page.evaluate(() => window.ANIMATION.playing), true);
    await context.close();
  });

  test('with reduced motion it shows the end state, also after play()', async () => {
    const { context, page, errors } = await openStarter(browser, 'animation.html', { viewport: PHONE, reducedMotion: 'reduce' });
    await page.waitForFunction(() => window.ANIMATION?.steps?.length >= 2);
    const shown = await state(page);
    await page.evaluate(() => window.ANIMATION.play());
    const afterPlay = await state(page);
    await page.evaluate(() => window.ANIMATION.seek(window.ANIMATION.duration));
    const end = await state(page);
    assert.equal(shown, end);
    assert.equal(afterPlay, end);
    assert.deepEqual(errors, []);
    await context.close();
  });
});

describe('html-email.html renders', { skip }, () => {
  test('at 390 px: no console errors, no network, no horizontal scroll', async () => {
    const { context, page, errors, requests } = await openStarter(browser, 'html-email.html', { viewport: PHONE });
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
    assert.equal(await horizontalOverflow(page), 0);
    await context.close();
  });

  test('the container is 600 px wide on a desktop viewport', async () => {
    const { context, page } = await openStarter(browser, 'html-email.html', { viewport: { width: 900, height: 900 } });
    assert.equal(await page.locator('table[width="600"]').first().evaluate((t) => t.getBoundingClientRect().width), 600);
    await context.close();
  });

  test('the preheader stays hidden and the button is a link', async () => {
    const { context, page } = await openStarter(browser, 'html-email.html', { viewport: PHONE });
    assert.equal(await page.locator('body > div').first().isVisible(), false);
    assert.ok(await page.getByRole('link', { name: /\S/ }).first().isVisible());
    await context.close();
  });

  test('dark mode changes the card background', async () => {
    const bg = async (colorScheme) => {
      const { context, page } = await openStarter(browser, 'html-email.html', { viewport: PHONE, colorScheme });
      const value = await page.locator('table[width="600"]').first().evaluate((t) => getComputedStyle(t).backgroundColor);
      await context.close();
      return value;
    };
    assert.notEqual(await bg('light'), await bg('dark'));
  });
});

describe('CDN starters degrade offline', { skip }, () => {
  test('diagram.html keeps the raw diagram text visible', async () => {
    const { context, page } = await openStarter(browser, 'diagram.html', { viewport: PHONE });
    await page.waitForFunction(() => document.documentElement.dataset.diagram === 'fallback', null, { timeout: 10_000 });
    const pre = page.locator('pre.mermaid').first();
    assert.ok(await pre.isVisible());
    assert.match(await pre.innerText(), /^\s*flowchart\b/);
    assert.ok(await page.locator('[role="status"]').isVisible());
    assert.equal(await horizontalOverflow(page), 0);
    await context.close();
  });

  test('object-3d.html shows its fallback text', async () => {
    const { context, page } = await openStarter(browser, 'object-3d.html', { viewport: PHONE });
    await page.waitForFunction(() => document.documentElement.dataset.scene === 'fallback', null, { timeout: 10_000 });
    const fallback = page.locator('.fallback');
    assert.ok(await fallback.isVisible());
    assert.match(await fallback.innerText(), /\p{L}+(\s+\p{L}+){3,}/u);
    assert.equal(await horizontalOverflow(page), 0);
    await context.close();
  });
});

const network = process.env.UX_RECIPES_NETWORK === '1' ? skip : 'set UX_RECIPES_NETWORK=1 to render against the real CDN';

describe('CDN starters render online', { skip: network }, () => {
  test('diagram.html draws the flowchart as SVG', async () => {
    const { context, page, errors } = await openStarter(browser, 'diagram.html', { viewport: PHONE, network: true });
    await page.waitForFunction(() => document.documentElement.dataset.diagram === 'ready', null, { timeout: 30_000 });
    assert.ok(await page.locator('figure svg').first().isVisible());
    assert.equal(await page.locator('pre.mermaid').first().isVisible(), false);
    assert.deepEqual(errors, []);
    assert.equal(await horizontalOverflow(page), 0);
    await context.close();
  });

  test('object-3d.html draws the scene', async () => {
    const { context, page, errors } = await openStarter(browser, 'object-3d.html', { viewport: PHONE, network: true });
    await page.waitForFunction(() => document.documentElement.dataset.scene === 'ready', null, { timeout: 30_000 });
    assert.ok(await page.locator('canvas').isVisible());
    assert.equal(await page.locator('.fallback').isVisible(), false);
    assert.deepEqual(errors, []);
    assert.equal(await horizontalOverflow(page), 0);
    await context.close();
  });
});
