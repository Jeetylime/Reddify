// End-to-end tests for Orbit on X, the shared platform switcher and cross-platform settings.
// Loads the built extension (dist/) into Chromium and drives it against mock x.com and reddit.com servers.
// Run with `npm test` (after the Reddit suite) or `node tests/e2e-x.mjs` after `npm run build`.
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installMockX } from './mock-x.mjs';
import { installMock } from './mock-reddit.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXT = join(root, 'dist');
const OUT = join(root, 'test-results');
const X = 'https://x.com';
mkdirSync(OUT, { recursive: true });

const results = [];
const errors = [];
const xlog = [];
let ctx, page, profile;

async function launch() {
  profile = mkdtempSync(join(tmpdir(), 'orbit-x-e2e-'));
  ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  await installMock(ctx, []);
  await installMockX(ctx, xlog);
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  await ctx.waitForEvent('page', { timeout: 3000 }).catch(() => {});
  page = await ctx.newPage();
  for (const p of ctx.pages()) if (p !== page) await p.close();
  await page.bringToFront();
  watch(page);
}

function watch(p) {
  p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  p.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to load resource/.test(t)) return;
    errors.push(`console: ${t}`);
  });
}

async function test(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push({ name, ok: true }); console.log(`  ✓ ${name} (${Date.now() - t0}ms)`); }
  catch (e) {
    results.push({ name, ok: false, err: e.message });
    console.log(`  ✗ ${name}\n      ${e.message.split('\n')[0]}`);
    await page.screenshot({ path: join(OUT, `FAIL-x-${name.replace(/\W+/g, '_')}.png`) }).catch(() => {});
  }
}
const assert = (c, msg) => { if (!c) throw new Error(msg); };
const shot = (n) => page.screenshot({ path: join(OUT, `${n}.png`) });
const settle = (ms = 350) => page.waitForTimeout(ms);
/** Orbit's chrome lives in a Shadow DOM; Playwright CSS locators pierce open shadow roots. */
const chrome = (sel) => page.locator(`#orbit-x-chrome ${sel}`);
const htmlHas = (c) => page.evaluate((cls) => document.documentElement.classList.contains(cls), c);
const boot = () => page.evaluate(() => window.__mockXBoot);
const sw = () => ctx.serviceWorkers()[0];
const getSettings = () => sw().evaluate(async () => (await chrome.storage.sync.get('settings')).settings);
const patchSettings = (patch) => sw().evaluate(async (p) => {
  const cur = (await chrome.storage.sync.get('settings')).settings ?? {};
  const next = { ...cur, ...p, x: { ...(cur.x ?? {}), ...(p.x ?? {}) }, platforms: { ...(cur.platforms ?? { reddit: true, x: true }), ...(p.platforms ?? {}) } };
  await chrome.storage.sync.set({ settings: next });
}, patch);
const posts = () => page.locator('main [data-orbit-post]');
async function waitPosts(n = 5) { await page.waitForFunction((k) => document.querySelectorAll('main [data-orbit-post]').length >= k, n, { timeout: 10000 }); }

await launch();
console.log('\nOrbit E2E — X / Twitter, platform switching, shared settings\n');

await test('activates on x.com: Orbit chrome replaces X navigation', async () => {
  await page.goto(`${X}/home`);
  await waitPosts();
  await page.waitForFunction(() => document.documentElement.classList.contains('orbit-x-chrome'), null, { timeout: 8000 });
  assert(await htmlHas('orbit-x'), 'skin class missing');
  await chrome('.x-sidebar').waitFor({ timeout: 5000 });
  const nav = await page.evaluate(() => { const n = document.querySelector('[data-orbit-native-nav]'); return n ? getComputedStyle(n).display : 'missing'; });
  assert(nav === 'none', `native nav should be hidden, got ${nav}`);
  for (const label of ['Home', 'Explore', 'Notifications', 'Messages', 'Bookmarks', 'Lists', 'Communities', 'Profile', 'More']) {
    assert(await chrome(`.x-sidebar :is(a, button):has-text("${label}")`).count() > 0, `sidebar missing ${label}`);
  }
  assert(await chrome('.x-sidebar .orb-trigger').count() === 1, 'Orbit logo / switcher missing');
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  assert(bg === 'rgb(18, 19, 22)', `page background should be Orbit's (${bg})`);
  const pad = await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingLeft));
  assert(pad === 244, `content should clear the sidebar (padding-left ${pad})`);
  assert(await chrome('.x-sidebar [data-nav="home"].active').count() === 1, 'Home not marked active');
  assert(await chrome('.x-sidebar [data-nav="notifications"] .sb-count').innerText() === '3', 'unread badge not mirrored');
  assert(await chrome('.x-acc-text').innerText().then((t) => t.includes('@orbit_tester')), 'account not shown');
  await settle(500);
  await shot('x-01-home');
});

await test('timeline posts are restyled as Orbit cards with Orbit typography', async () => {
  const n = await posts().count();
  assert(n >= 15, `expected a page of posts, got ${n}`);
  const card = await page.evaluate(() => {
    const c = document.querySelector('main [data-orbit-cell] > [data-orbit-card]');
    const t = document.querySelector('main [data-orbit-post] div[lang]');
    const cs = c && getComputedStyle(c);
    return cs && { radius: cs.borderTopLeftRadius, bg: cs.backgroundColor, font: getComputedStyle(t).fontSize, family: getComputedStyle(t).fontFamily };
  });
  assert(card && card.radius === '16px', `card radius ${card?.radius}`);
  assert(card.bg === 'rgb(23, 24, 28)', `card surface ${card.bg}`);
  assert(card.font === '14px', `post text size should follow Orbit setting (${card.font})`);
  assert(!/Chirp/.test(card.family), `post text should use Orbit's typeface (${card.family})`);
  assert(await page.locator('main [data-orbit-media]').count() > 0, 'media frames not detected');
  assert(await page.locator('main [data-orbit-quote]').count() > 0, 'quote post not detected');
  assert(await page.locator('main [data-orbit-social]').count() > 0, 'repost context not detected');
});

await test('promoted posts and premium upsells are hidden; views can be hidden', async () => {
  const promo = page.locator('main [data-orbit-promoted]');
  assert(await promo.count() > 0, 'promoted post not detected');
  assert(!(await promo.first().isVisible()), 'promoted post visible');
  assert(!(await page.locator('[data-orbit-rail-section="premium"]').first().isVisible()), 'premium upsell visible');
  assert(await page.locator('[data-orbit-rail-section="trends"]').first().isVisible(), 'trends should be visible by default');
  const views = () => page.locator('main [data-orbit-post] [data-engagement-action="generic"]').first();
  assert(await views().isVisible(), 'views hidden by default');
  await patchSettings({ x: { hideViews: true, hideTrends: true } });
  await page.waitForFunction(() => document.documentElement.classList.contains('orbit-x-hide-views'));
  assert(!(await views().isVisible()), 'views still visible');
  assert(!(await page.locator('[data-orbit-rail-section="trends"]').first().isVisible()), 'trends still visible');
  await patchSettings({ x: { hideViews: false, hideTrends: false } });
  await page.waitForFunction(() => !document.documentElement.classList.contains('orbit-x-hide-views'));
});

await test('native interactions still work through the skin: like, bookmark, repost', async () => {
  xlog.length = 0;
  const first = posts().filter({ hasNot: page.locator('[data-orbit-promoted]') }).first();
  const like = first.locator('[data-engagement-action="like"] button');
  await like.click();
  await page.waitForFunction(() => document.querySelector('main [data-orbit-post] [data-engagement-action="like"] button[aria-pressed="true"]'));
  await page.mouse.move(5, 500);
  await settle(300);
  const color = await like.evaluate((b) => getComputedStyle(b).color);
  assert(color === 'rgb(255, 92, 138)', `liked colour should be Orbit's (${color})`);
  await first.locator('[data-engagement-action="bookmark"] button').click();
  await first.locator('[data-engagement-action="retweet"] button').click();
  await page.locator('[role="menu"] [role="menuitem"]', { hasText: /^Repost$/ }).click();
  await page.waitForFunction(() => true);
  for (let i = 0; i < 20 && !['like', 'bookmark', 'repost'].every((t) => xlog.some((e) => e.type === t)); i++) await settle(100);
  const types = xlog.map((e) => e.type);
  for (const t of ['like', 'bookmark', 'repost']) assert(types.includes(t), `X did not receive ${t} (${types.join(',')})`);
});

await test('posting from the inline composer works', async () => {
  xlog.length = 0;
  const comp = page.locator('main [data-orbit-composer]');
  assert(await comp.count() === 1, 'composer not detected');
  await comp.locator('[role="textbox"]').click();
  await page.keyboard.type('Hello from Orbit');
  await comp.locator('button', { hasText: /^Post$/ }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('main article')].some((a) => a.textContent.includes('Hello from Orbit')));
  assert(xlog.some((e) => e.type === 'post' && /Hello from Orbit/.test(e.text)), 'post not sent to X');
});

await test('Home feed tabs are mirrored into Orbit’s top bar and drive X’s own tabs', async () => {
  const tabs = chrome('.x-tabs [role="tab"]');
  assert(await tabs.count() === 2, `expected 2 mirrored tabs, got ${await tabs.count()}`);
  assert(await page.evaluate(() => getComputedStyle(document.querySelector('[data-orbit-native-header="home"]')).display) === 'none', 'native home header still visible');
  const before = await posts().first().innerText();
  await chrome('.x-tabs [role="tab"]:has-text("Following")').click();
  await page.waitForFunction(() => document.querySelector('[role="tablist"] [role="tab"][aria-selected="true"]')?.textContent?.includes('Following'));
  await settle(400);
  assert(await chrome('.x-tabs [role="tab"][aria-selected="true"]').innerText() === 'Following', 'mirrored tab not updated');
  assert(await posts().first().innerText() !== before, 'timeline did not change');
  await chrome('.x-tabs [role="tab"]:has-text("For you")').click();
  await settle(300);
});

await test('Orbit navigation drives X’s router (no page reloads) across page types', async () => {
  let b0 = await boot();
  for (const [key, path, title] of [['explore', '/explore', 'Explore'], ['notifications', '/notifications', 'Notifications'], ['messages', '/i/chat', 'Messages'], ['bookmarks', '/i/bookmarks', 'Bookmarks'], ['lists', '/orbit_tester/lists', 'Lists'], ['communities', '/orbit_tester/communities', 'Communities'], ['profile', '/orbit_tester', 'Orbit Tester'], ['home', '/home', 'Home']]) {
    await chrome(`.x-sidebar [data-nav="${key}"]`).click({ timeout: 5000 }).catch(async (e) => { throw new Error(`clicking ${key}: ${e.message.split('\n').slice(0, 6).join(' | ')}`); });
    await page.waitForFunction((p) => location.pathname === p, path, { timeout: 5000 });
    await page.waitForFunction((t) => document.querySelector('#orbit-x-chrome').shadowRoot.querySelector('.x-topbar h1')?.textContent === t, title, { timeout: 5000 });
    assert(await chrome(`.x-sidebar [data-nav="${key}"].active`).count() === 1, `${key} not active`);
    // X renders no link for Lists in its nav, so Orbit falls back to a normal page load there; everything else is SPA.
    if (key === 'lists') { await waitPosts(0); b0 = await boot(); } else assert(await boot() === b0, `navigating to ${key} reloaded the page`);
    if (key === 'notifications') { await settle(300); await shot('x-03-notifications'); }
    if (key === 'messages') {
      await page.locator('main a[href^="/i/chat/"]').first().click();
      await page.waitForFunction(() => /^\/i\/chat\/./.test(location.pathname));
      await page.locator('main [role="textbox"][aria-label="Message"]').click();
      await page.keyboard.type('Sent via Orbit');
      await page.locator('main button[aria-label="Send"]').click();
      await page.getByText('Sent via Orbit').first().waitFor({ timeout: 3000 });
      await settle(200); await shot('x-04-messages');
    }
    if (key === 'profile') {
      await waitPosts(3);
      await settle(300); await shot('x-05-profile');
    }
  }
});

await test('Orbit search box searches X', async () => {
  const input = chrome('.x-topbar .tb-search input');
  await input.fill('orbit design');
  await input.press('Enter');
  await page.waitForFunction(() => location.pathname === '/search' && new URLSearchParams(location.search).get('q') === 'orbit design', null, { timeout: 5000 });
  assert(await chrome('.x-topbar h1').innerText() === '“orbit design”', 'search title not shown');
});

await test('post page: focal post, author thread, connected replies, thread reader', async () => {
  await chrome('.x-sidebar [data-nav="home"]').click();
  await waitPosts();
  const b0 = await boot();
  const link = posts().filter({ hasNot: page.locator('[data-orbit-promoted]') }).first().locator('a[href*="/status/"]:has(time)');
  const href = await link.getAttribute('href');
  await link.click();
  await page.waitForFunction((h) => location.pathname === h, href);
  await page.waitForSelector('main [data-orbit-focal]', { timeout: 6000 });
  assert(await boot() === b0, 'opening a post reloaded the page');
  assert(await page.locator('main [data-orbit-op]').count() >= 2, 'author thread not marked');
  assert(await page.locator('main [data-orbit-joined-next]').count() >= 1, 'thread connectors not detected');
  assert(await page.locator('main [data-orbit-threadline]').count() >= 1, 'thread line not restyled');
  const focalSize = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('[data-orbit-focal] div[lang]')).fontSize));
  assert(focalSize > 16, `focal post should read larger (${focalSize})`);
  await settle(300);
  await shot('x-06-thread');
  await chrome('.x-topbar button:has-text("Read thread")').click();
  await chrome('.x-reader').waitFor({ timeout: 3000 });
  const n = await chrome('.x-reader .xr-post').count();
  assert(n >= 2, `reader should show the author's thread (${n})`);
  await settle(300);
  await shot('x-07-reader');
  await page.keyboard.press('Escape');
  await chrome('.x-reader').waitFor({ state: 'detached', timeout: 3000 });
  await page.keyboard.press('Shift+R');
  await chrome('.x-reader').waitFor({ timeout: 3000 });
  await page.keyboard.press('Escape');
});

await test('photos open in Orbit’s media viewer (keyboard navigable); X’s viewer still available', async () => {
  await chrome('.x-sidebar [data-nav="home"]').click();
  await waitPosts();
  const multi = page.locator('main [data-orbit-post]').filter({ has: page.locator('a[href*="/photo/2"]') }).first();
  await multi.scrollIntoViewIfNeeded();
  await multi.locator('a[href*="/photo/1"]').first().click();
  await chrome('.x-lightbox').waitFor({ timeout: 3000 });
  assert(!/\/photo\//.test(new URL(page.url()).pathname), 'X’s own photo route opened');
  assert(await chrome('.x-lightbox .lb-top .n').innerText() === '1 / 2' || (await chrome('.x-lightbox .lb-top .n').innerText()).startsWith('1 /'), 'counter missing');
  const src = await chrome('.x-lightbox .lb-stage img').getAttribute('src');
  assert(/name=large/.test(src), `viewer should load the large rendition (${src})`);
  await page.keyboard.press('ArrowRight');
  assert((await chrome('.x-lightbox .lb-top .n').innerText()).startsWith('2 /'), 'arrow key did not advance');
  await settle(250);
  await shot('x-08-lightbox');
  await page.keyboard.press('Escape');
  await chrome('.x-lightbox').waitFor({ state: 'detached', timeout: 3000 });
});

await test('X modals (composer) sit above Orbit’s chrome and give it back on close', async () => {
  const reply = posts().filter({ hasNot: page.locator('[data-orbit-promoted]') }).first().locator('[data-engagement-action="reply"] a');
  await reply.click();
  await page.waitForSelector('[role="dialog"][aria-modal="true"]', { timeout: 4000 });
  await page.waitForFunction(() => document.documentElement.classList.contains('orbit-x-overlay'), null, { timeout: 3000 });
  const z = await page.evaluate(() => getComputedStyle(document.getElementById('orbit-x-chrome')).zIndex);
  assert(z === '-1', `Orbit chrome should step behind X's modal (z-index ${z})`);
  await settle(250);
  await shot('x-09-compose-modal');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.documentElement.classList.contains('orbit-x-overlay'), null, { timeout: 4000 });
});

await test('bookmarks: filter loaded bookmarks by text', async () => {
  await chrome('.x-sidebar [data-nav="bookmarks"]').click();
  await waitPosts(4);
  const total = await page.locator('main [data-orbit-cell]:visible').count();
  const filter = chrome('.x-topbar .x-filter input');
  const word = (await posts().first().locator('div[lang]').innerText()).split(/\s+/).find((w) => w.length > 5);
  await filter.fill('zzqxnotfound');
  await settle(200);
  assert(await page.locator('main [data-orbit-cell]:visible').count() === 0, 'nonsense filter should hide everything');
  await filter.fill(word);
  await settle(300);
  const shown = await page.locator('main [data-orbit-cell]:visible').count();
  assert(shown >= 1 && shown <= total, `filter should keep matches ${total} → ${shown}`);
  await filter.fill('');
});

await test('infinite scroll: new posts are decorated as they load', async () => {
  await chrome('.x-sidebar [data-nav="home"]').click();
  await waitPosts();
  const before = await posts().count();
  for (let i = 0; i < 4; i++) { await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await settle(400); }
  await page.waitForFunction((b) => document.querySelectorAll('main [data-orbit-post]').length > b, before, { timeout: 6000 });
  const undecorated = await page.evaluate(() => [...document.querySelectorAll('main article')].filter((a) => !a.hasAttribute('data-orbit-post')).length);
  assert(undecorated === 0, `${undecorated} posts left undecorated`);
  await page.evaluate(() => window.scrollTo(0, 0));
});

await test('view options: list style, compact media, density (X-only vs shared)', async () => {
  await chrome('.x-topbar button[aria-label="View options"]').click();
  await chrome('.x-view button:has-text("List")').click();
  await page.waitForFunction(() => document.documentElement.classList.contains('orbit-x-list'));
  await chrome('.x-view button:has-text("Compact")').click();
  await chrome('.x-view button:has-text("Tight")').click();
  await page.keyboard.press('Escape');
  await settle(500);
  await shot('x-10-list-compact');
  const s = await getSettings();
  assert(s.x.postStyle === 'list' && s.x.mediaSize === 'compact', `X settings not saved: ${JSON.stringify(s.x)}`);
  assert(s.density === 'tight', 'shared density not saved');
  assert(s.layout === 'comfortable', 'Reddit layout must not change when X layout changes');
  const h = await page.evaluate(() => Math.max(...[...document.querySelectorAll('main [data-orbit-media]')].slice(0, 6).map((m) => m.getBoundingClientRect().height)));
  assert(h <= 305, `compact media should be ≤ 300px tall (${h})`);
  await patchSettings({ density: 'regular', x: { postStyle: 'cards', mediaSize: 'balanced' } });
  await page.waitForFunction(() => document.documentElement.classList.contains('orbit-x-cards'));
});

await test('command palette (Ctrl+K) navigates and runs commands', async () => {
  await page.keyboard.press('Control+k');
  await chrome('.palette input').waitFor({ timeout: 3000 });
  await page.keyboard.type('bookmarks');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.pathname === '/i/bookmarks', null, { timeout: 4000 });
  await page.keyboard.press('Control+k');
  await page.keyboard.type('keyboard shortcuts');
  await page.keyboard.press('Enter');
  await chrome('.help').waitFor({ timeout: 3000 });
  await page.keyboard.press('Escape');
  await chrome('.help').waitFor({ state: 'detached', timeout: 3000 });
});

await test('compact sidebar (\\) and theme toggle are shared settings', async () => {
  await page.keyboard.press('\\');
  await page.waitForFunction(() => parseFloat(getComputedStyle(document.body).paddingLeft) === 64, null, { timeout: 3000 });
  assert(!(await chrome('.x-sidebar .orb-word').isVisible()), 'compact sidebar should hide the wordmark');
  await settle(300);
  await shot('x-11-compact-sidebar');
  await page.keyboard.press('\\');
  await page.waitForFunction(() => parseFloat(getComputedStyle(document.body).paddingLeft) === 244);
  await chrome('.x-topbar button[aria-label="Toggle theme"]').click();
  await page.waitForFunction(() => document.documentElement.dataset.orbitTheme === 'light');
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  assert(bg === 'rgb(241, 242, 245)', `light background ${bg}`);
  assert(await page.evaluate(() => document.documentElement.getAttribute('data-theme')) === 'light', 'X’s own theme attribute should follow Orbit');
  await settle(500);
  await shot('x-12-light');
  assert((await getSettings()).theme === 'light', 'theme not shared');
  await chrome('.x-topbar button[aria-label="Toggle theme"]').click();
  await page.waitForFunction(() => document.documentElement.dataset.orbitTheme === 'dark');
});

await test('platform switcher: menu, keyboard access, current platform marked', async () => {
  const trigger = chrome('.x-sidebar .orb-trigger');
  await trigger.click();
  const menu = chrome('.orb-menu');
  await menu.waitFor({ timeout: 2000 });
  assert(await chrome('.orb-menu [data-platform="x"][aria-checked="true"]').count() === 1, 'X not marked current');
  assert(await chrome('.orb-menu [data-platform="reddit"][aria-checked="false"]').count() === 1, 'Reddit option missing');
  await settle(250);
  await shot('x-02-switcher');
  await page.keyboard.press('Escape');
  await menu.waitFor({ state: 'detached', timeout: 2000 });
  assert(await page.evaluate(() => document.querySelector('#orbit-x-chrome').shadowRoot.activeElement?.classList.contains('orb-trigger')), 'focus not returned to the logo');
  await page.keyboard.press('Alt+o');
  await menu.waitFor({ timeout: 2000 });
  const focused = () => page.evaluate(() => document.querySelector('#orbit-x-chrome').shadowRoot.activeElement?.getAttribute('data-platform'));
  await page.waitForFunction(() => document.querySelector('#orbit-x-chrome').shadowRoot.activeElement?.getAttribute('data-platform') === 'x', null, { timeout: 2000 });
  await page.keyboard.press('ArrowUp');
  assert(await focused() === 'reddit', 'ArrowUp should move to Reddit');
  await page.keyboard.press('Escape');
});

await test('switching X → Reddit → X in the same tab resumes where you were', async () => {
  await chrome('.x-sidebar [data-nav="bookmarks"]').click();
  await page.waitForFunction(() => location.pathname === '/i/bookmarks');
  await settle(900); // let Orbit remember this spot
  await chrome('.x-sidebar .orb-trigger').click();
  await chrome('.orb-menu [data-platform="reddit"]').click();
  await page.waitForURL(/reddit\.com/, { timeout: 8000 });
  await page.locator('#orbit-app [data-nav="post"]').first().waitFor({ timeout: 15000 });
  const rTrigger = page.locator('#orbit-app .orb-trigger');
  await rTrigger.click();
  const xItem = page.locator('#orbit-app .orb-menu [data-platform="x"]');
  await xItem.waitFor({ timeout: 2000 });
  assert(await page.locator('#orbit-app .orb-menu [data-platform="reddit"][aria-checked="true"]').count() === 1, 'Reddit not marked current on Reddit');
  const hint = await xItem.innerText();
  assert(/Resume/.test(hint) && /Bookmarks/.test(hint), `X option should offer to resume Bookmarks (${hint.replace(/\n/g, ' ')})`);
  await settle(200);
  await page.screenshot({ path: join(OUT, 'x-13-reddit-switcher.png') });
  await xItem.click();
  await page.waitForURL(/x\.com\/i\/bookmarks/, { timeout: 8000 });
  await waitPosts(3);
  assert(await htmlHas('orbit-x-chrome'), 'Orbit chrome missing after switching back');
});

await test('settings stay separate per platform (Reddit layout vs X post style)', async () => {
  await patchSettings({ layout: 'gallery' });
  await settle(300);
  assert(await htmlHas('orbit-x-cards'), 'Reddit layout change affected X');
  await patchSettings({ layout: 'comfortable', x: { postStyle: 'list' } });
  await page.waitForFunction(() => document.documentElement.classList.contains('orbit-x-list'));
  const s = await getSettings();
  assert(s.layout === 'comfortable', 'X post style changed Reddit layout');
  await patchSettings({ x: { postStyle: 'cards' } });
});

await test('classic X toggle and back; turning Orbit off for X leaves X untouched', async () => {
  await page.evaluate(() => window.dispatchEvent(new Event('orbit:classic')));
  await page.waitForFunction(() => !document.documentElement.classList.contains('orbit-x'));
  assert(await page.locator('#orbit-x-chrome').count() === 0, 'chrome still mounted in classic mode');
  const navDisplay = await page.evaluate(() => { const n = document.querySelector('nav[aria-label="Primary"]'); return n && getComputedStyle(n).display; });
  assert(navDisplay !== 'none', 'native nav should be back in classic mode');
  await page.locator('#orbit-launcher button').waitFor({ timeout: 3000 });
  await page.locator('#orbit-launcher button').click();
  await page.waitForFunction(() => document.documentElement.classList.contains('orbit-x-chrome'), null, { timeout: 5000 });
  await patchSettings({ platforms: { x: false } });
  await page.waitForFunction(() => !document.documentElement.classList.contains('orbit-x'), null, { timeout: 4000 });
  assert(await page.locator('#orbit-launcher').count() === 0, 'launcher shown although Orbit is off for X');
  await patchSettings({ platforms: { x: true } });
  await page.waitForFunction(() => document.documentElement.classList.contains('orbit-x-chrome'), null, { timeout: 5000 });
});

await test('signed-out X keeps its own navigation (skin only, no Orbit chrome)', async () => {
  await page.goto(`${X}/NASA?loggedout=1`);
  await page.waitForFunction(() => document.querySelectorAll('main [data-orbit-post]').length > 0, null, { timeout: 8000 });
  await settle(600);
  assert(await htmlHas('orbit-x'), 'skin should still apply');
  assert(!(await htmlHas('orbit-x-chrome')), 'Orbit chrome should not take over a signed-out page');
  assert(await chrome('.x-sidebar').count() === 0, 'sidebar rendered while signed out');
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(`${X}/home`);
  await waitPosts();
  await page.waitForFunction(() => document.documentElement.classList.contains('orbit-x-chrome'), null, { timeout: 8000 });
});

await test('log-in flows are never touched', async () => {
  await page.route('https://x.com/i/flow/login', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html data-theme="light"><body><main><h1>Sign in to X</h1><input name="text"></main></body></html>' }));
  await page.goto(`${X}/i/flow/login`);
  await settle(800);
  assert(!(await htmlHas('orbit-x')), 'Orbit must not style log-in pages');
  assert(await page.locator('#orbit-x-chrome').count() === 0, 'chrome mounted on a log-in page');
  await page.goto(`${X}/home`);
  await waitPosts();
});

await test('narrow (mobile-width) X: X’s bottom bar navigates, Orbit keeps the top bar', async () => {
  await page.setViewportSize({ width: 600, height: 900 });
  await page.waitForFunction(() => document.documentElement.classList.contains('orbit-x-narrow'), null, { timeout: 3000 });
  assert(await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingLeft)) === 0, 'no sidebar gutter on narrow screens');
  assert(!(await chrome('.x-sidebar').isVisible()), 'sidebar should hide on narrow screens');
  assert(await chrome('.x-topbar').isVisible(), 'top bar should stay');
  await settle(300);
  await shot('x-14-narrow');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForFunction(() => !document.documentElement.classList.contains('orbit-x-narrow'));
});

await test('performance: no long tasks while scrolling and loading more posts', async () => {
  await page.goto(`${X}/home`);
  await waitPosts();
  await settle(500);
  const longest = await page.evaluate(async () => {
    let max = 0;
    const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) max = Math.max(max, e.duration); });
    po.observe({ type: 'longtask', buffered: false });
    for (let i = 0; i < 12; i++) { window.scrollBy(0, 700); await new Promise((r) => setTimeout(r, 120)); }
    await new Promise((r) => setTimeout(r, 400));
    po.disconnect();
    return max;
  });
  console.log(`      longest task while scrolling + loading: ${Math.round(longest)}ms · ${await posts().count()} posts decorated`);
  assert(longest < 120, `long task ${longest}ms`);
});

await test('no unexpected console errors', async () => {
  assert(errors.length === 0, `errors:\n${errors.join('\n')}`);
});

await ctx.close();
rmSync(profile, { recursive: true, force: true });
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? ` — ${failed.length} failed` : ''}\n`);
process.exit(failed.length ? 1 : 0);
