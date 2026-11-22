// End-to-end tests for Orbit on YouTube, three-way platform switching and shared/separate settings.
// Loads the built extension (dist/) into Chromium and drives it against mock youtube.com, x.com and reddit.com.
// Run with `npm test` or `node tests/e2e-youtube.mjs` after `npm run build`.
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installMockYouTube } from './mock-youtube.mjs';
import { installMockX } from './mock-x.mjs';
import { installMock } from './mock-reddit.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXT = join(root, 'dist');
const OUT = join(root, 'test-results');
const YT = 'https://www.youtube.com';
mkdirSync(OUT, { recursive: true });

const results = [];
const errors = [];
const ylog = [];
let ctx, page, profile;

async function launch() {
  profile = mkdtempSync(join(tmpdir(), 'orbit-yt-e2e-'));
  ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--autoplay-policy=no-user-gesture-required'],
  });
  await installMock(ctx, []);
  await installMockX(ctx, []);
  await installMockYouTube(ctx, ylog);
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
    await page.screenshot({ path: join(OUT, `FAIL-yt-${name.replace(/\W+/g, '_')}.png`) }).catch(() => {});
  }
}
const assert = (c, msg) => { if (!c) throw new Error(msg); };
const shot = (n) => page.screenshot({ path: join(OUT, `${n}.png`) });
const settle = (ms = 350) => page.waitForTimeout(ms);
const chrome = (sel) => page.locator(`#orbit-yt-chrome ${sel}`);
const htmlHas = (c) => page.evaluate((cls) => document.documentElement.classList.contains(cls), c);
const boot = () => page.evaluate(() => window.__mockYTBoot);
const sw = () => ctx.serviceWorkers()[0];
const getSettings = () => sw().evaluate(async () => (await chrome.storage.sync.get('settings')).settings);
const patchSettings = (patch) => sw().evaluate(async (p) => {
  const cur = (await chrome.storage.sync.get('settings')).settings ?? {};
  const next = { ...cur, ...p, youtube: { ...(cur.youtube ?? {}), ...(p.youtube ?? {}) }, platforms: { ...(cur.platforms ?? { reddit: true, x: true, youtube: true }), ...(p.platforms ?? {}) } };
  await chrome.storage.sync.set({ settings: next });
}, patch);
const active = (sel) => page.locator(`ytd-page-manager > :not([hidden]) ${sel}`);
const cards = () => active('ytd-rich-item-renderer');
const video = () => page.evaluate(() => { const v = document.querySelector('#movie_player video, ytd-miniplayer video'); return v && { paused: v.paused, t: v.currentTime }; });
const waitPath = (p) => page.waitForFunction((x) => location.pathname + location.search === x || location.pathname === x, p, { timeout: 6000 });
const title = () => chrome('.shell-topbar h1').innerText();

await launch();
console.log('\nOrbit E2E — YouTube, three-way switching, shared settings\n');

await test('activates on youtube.com: Orbit sidebar and top bar replace the guide and masthead', async () => {
  await page.goto(`${YT}/`);
  await cards().first().waitFor({ timeout: 15000 });
  await page.waitForFunction(() => document.documentElement.classList.contains('orbit-yt-chrome'), null, { timeout: 8000 });
  await chrome('.shell-sidebar').waitFor({ timeout: 5000 });
  const guide = await page.evaluate(() => getComputedStyle(document.querySelector('tp-yt-app-drawer#guide')).display);
  assert(guide === 'none', `YouTube's guide should be hidden (${guide})`);
  const mast = await page.evaluate(() => getComputedStyle(document.querySelector('#masthead-container')).opacity);
  assert(mast === '0', 'masthead should be visually replaced');
  for (const label of ['Home', 'Shorts', 'Subscriptions', 'Trending', 'Library', 'History', 'Playlists', 'Your videos', 'Watch later', 'Liked videos', 'Settings']) {
    assert(await chrome(`.shell-sidebar .sb-item:has-text("${label}")`).count() > 0, `sidebar missing ${label}`);
  }
  assert(await chrome('.shell-sidebar .orb-trigger').count() === 1, 'Orbit logo / switcher missing');
  assert(await chrome('.shell-sidebar [data-section="subscriptions"] .sb-item').count() >= 5, 'subscriptions list not mirrored from YouTube');
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  assert(bg === 'rgb(18, 19, 22)', `page background should be Orbit's (${bg})`);
  const ytVar = await page.evaluate(() => getComputedStyle(document.querySelector('ytd-app')).getPropertyValue('--yt-spec-base-background').trim());
  assert(/var\(--o-bg\)|rgb\(18, 19, 22\)|#121316/.test(ytVar), `YouTube tokens not re-pointed (${ytVar})`);
  const pad = await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingLeft));
  assert(pad === 244, `content should clear the sidebar (${pad})`);
  await settle(600);
  await shot('yt-01-home');
});

await test('home grid: Orbit sizes columns, cards keep thumbnails, durations, avatars and metadata', async () => {
  const n = await cards().count();
  assert(n >= 20, `expected a page of videos, got ${n}`);
  const g = await page.evaluate(() => {
    const grid = document.querySelector('ytd-page-manager > :not([hidden]) ytd-rich-grid-renderer');
    const cs = getComputedStyle(grid);
    const thumb = grid.querySelector('yt-thumbnail-view-model');
    return { per: cs.getPropertyValue('--ytd-rich-grid-items-per-row').trim(), cols: getComputedStyle(document.documentElement).getPropertyValue('--o-yt-cols').trim(), radius: getComputedStyle(thumb).borderTopLeftRadius };
  });
  assert(Number(g.cols) >= 3 && Number(g.cols) <= 5, `unexpected column count ${g.cols}`);
  assert(g.radius === '14px', `thumbnail radius ${g.radius}`);
  const first = cards().first();
  for (const sel of ['img', '.badge-shape-wiz__text', '.yt-lockup-metadata-view-model__avatar img', '.yt-lockup-metadata-view-model__title', '.yt-content-metadata-view-model__metadata-text', 'button[aria-label="More actions"]']) {
    assert(await first.locator(sel).count() > 0, `card missing ${sel}`);
  }
  assert(await active('ytd-ad-slot-renderer').first().isVisible(), 'Orbit must never hide ads');
});

await test('category chips are mirrored into the top bar and drive YouTube’s filter', async () => {
  const chips = chrome('.yt-subbar .yt-chip');
  assert(await chips.count() >= 8, `expected mirrored chips, got ${await chips.count()}`);
  assert(await htmlHas('orbit-yt-subbar'), 'sub-bar class missing');
  const before = await cards().first().innerText();
  await chrome('.yt-subbar .yt-chip:has-text("Music")').click();
  await page.waitForFunction(() => [...document.querySelectorAll('yt-chip-cloud-chip-renderer[selected]')].some((c) => /Music/.test(c.textContent)), null, { timeout: 4000 });
  await settle(400);
  assert(await chrome('.yt-subbar .yt-chip.on').innerText() === 'Music', 'mirrored chip state not updated');
  assert(await cards().first().innerText() !== before, 'grid did not change with the chip');
  await chrome('.yt-subbar .yt-chip:has-text("All")').first().click();
  await settle(300);
});

await test('grid layouts switch instantly: compact, editorial, comfortable (YouTube-only setting)', async () => {
  const b0 = await boot();
  const colsOf = () => page.evaluate(() => Number(getComputedStyle(document.documentElement).getPropertyValue('--o-yt-cols')));
  const comfy = await colsOf();
  await chrome('.shell-topbar button[aria-label="View options"]').click();
  await chrome('.yt-view button:has-text("Compact")').first().click();
  await page.waitForFunction(() => document.documentElement.classList.contains('orbit-yt-grid-compact'));
  await settle(300);
  assert(await colsOf() > comfy, 'compact should fit more videos per row');
  await shot('yt-02-compact');
  await chrome('.yt-view button:has-text("Editorial")').click();
  await page.waitForFunction(() => document.documentElement.classList.contains('orbit-yt-grid-editorial'));
  await settle(400);
  const w = await page.evaluate(() => { const items = [...document.querySelectorAll('ytd-page-manager > :not([hidden]) ytd-rich-grid-renderer > #contents > ytd-rich-item-renderer')].filter((i) => i.querySelector('yt-lockup-view-model')); return [items[0].getBoundingClientRect().width, items[1].getBoundingClientRect().width]; });
  assert(w[0] > w[1] * 1.6, `editorial lead video should be featured (${w.join(' vs ')})`);
  await page.keyboard.press('Escape');
  await shot('yt-03-editorial');
  const s = await getSettings();
  assert(s.youtube.grid === 'editorial', 'grid layout not saved');
  assert(s.layout === 'comfortable' && s.x.postStyle === 'cards', 'YouTube grid must not change Reddit or X layouts');
  assert(await boot() === b0, 'switching layouts reloaded the page');
  await patchSettings({ youtube: { grid: 'comfortable' } });
  await page.waitForFunction(() => document.documentElement.classList.contains('orbit-yt-grid-comfortable'));
});

await test('infinite scroll keeps working', async () => {
  const before = await cards().count();
  for (let i = 0; i < 5; i++) { await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await settle(350); }
  await page.waitForFunction((b) => document.querySelectorAll('ytd-page-manager > :not([hidden]) ytd-rich-item-renderer').length > b, before, { timeout: 6000 });
  await page.evaluate(() => window.scrollTo(0, 0));
});

await test('watch page: real player plays; Orbit layout, metadata and actions stay native', async () => {
  const b0 = await boot();
  const link = cards().filter({ has: page.locator('a[href^="/watch"]') }).first().locator('a.yt-lockup-view-model__content-image');
  await link.click();
  await page.waitForFunction(() => location.pathname === '/watch', null, { timeout: 6000 });
  await page.waitForSelector('ytd-watch-flexy:not([hidden]) #movie_player video', { timeout: 6000 });
  assert(await boot() === b0, 'opening a video reloaded the page');
  await page.waitForFunction(() => { const v = document.querySelector('#movie_player video'); return v && !v.paused && v.currentTime > 0.3; }, null, { timeout: 8000 });
  assert(await title() === 'Watching', 'top bar title');
  const radius = await page.evaluate(() => getComputedStyle(document.querySelector('ytd-watch-flexy:not([hidden]) #ytd-player')).borderTopLeftRadius);
  assert(radius === '18px', `player frame radius ${radius}`);
  const maxW = await page.evaluate(() => getComputedStyle(document.querySelector('ytd-watch-flexy:not([hidden])')).getPropertyValue('--ytd-watch-flexy-max-player-width').trim());
  assert(maxW === '1720px', `wide watch width not applied (${maxW})`);
  ylog.length = 0;
  await active('ytd-watch-metadata like-button-view-model button').click();
  await active('ytd-watch-metadata #subscribe-button button').click();
  await active('ytd-watch-metadata button[aria-label="Save to playlist"]').click().catch(() => {});
  for (let i = 0; i < 20 && !['like', 'subscribe'].every((t) => ylog.some((e) => e.type === t)); i++) await settle(100);
  for (const t of ['like', 'subscribe']) assert(ylog.some((e) => e.type === t), `YouTube did not receive ${t}`);
  await page.keyboard.press('Escape');
  await active('ytd-text-inline-expander #expand').click();
  await page.waitForFunction(() => document.querySelector('ytd-watch-flexy:not([hidden]) ytd-text-inline-expander')?.hasAttribute('is-expanded'));
  await settle(400);
  await shot('yt-04-watch');
});

await test('player controls still work (pause, speed, theater keeps playback)', async () => {
  const v0 = await page.evaluate(() => { window.__orbitVideo = document.querySelector('#movie_player video'); return true; });
  void v0;
  await page.locator('#movie_player .ytp-play-button').click();
  await page.waitForFunction(() => document.querySelector('#movie_player video').paused);
  await page.locator('#movie_player .ytp-play-button').click();
  await page.waitForFunction(() => !document.querySelector('#movie_player video').paused);
  await chrome('.shell-topbar button[aria-label="Theater mode"]').click();
  await page.waitForFunction(() => document.querySelector('ytd-watch-flexy:not([hidden])').hasAttribute('theater'), null, { timeout: 4000 });
  const same = await page.evaluate(() => document.querySelector('#movie_player video') === window.__orbitVideo && !window.__orbitVideo.paused);
  assert(same, 'theater mode must keep the same, still-playing video element');
  await settle(400);
  await shot('yt-05-theater');
  await page.keyboard.press('t');
  await page.waitForFunction(() => !document.querySelector('ytd-watch-flexy:not([hidden])').hasAttribute('theater'), null, { timeout: 4000 });
});

await test('recommendation layouts: sidebar, grid below the player, compact list', async () => {
  const recs = () => page.evaluate(() => { const s = document.querySelector('ytd-watch-flexy:not([hidden]) #secondary'); const p = document.querySelector('ytd-watch-flexy:not([hidden]) #primary'); const a = s.getBoundingClientRect(); const b = p.getBoundingClientRect(); return { below: a.top >= b.bottom - 4, side: a.left >= b.right - 4 }; });
  assert((await recs()).side, 'Up next should start beside the player');
  await patchSettings({ youtube: { recommendations: 'grid' } });
  await page.waitForFunction(() => document.documentElement.classList.contains('orbit-yt-recs-grid'));
  await settle(400);
  assert((await recs()).below, 'grid layout should move Up next below the player');
  const cols = await page.evaluate(() => getComputedStyle(document.querySelector('ytd-watch-flexy:not([hidden]) ytd-watch-next-secondary-results-renderer #items')).gridTemplateColumns.split(' ').length);
  assert(cols >= 3, `Up next grid should have several columns (${cols})`);
  await page.evaluate(() => document.querySelector('ytd-watch-flexy:not([hidden]) #secondary').scrollIntoView());
  await settle(300);
  await shot('yt-06-recs-grid');
  await patchSettings({ youtube: { recommendations: 'list' } });
  await page.waitForFunction(() => document.documentElement.classList.contains('orbit-yt-recs-list'));
  await settle(300);
  const thumbW = await page.evaluate(() => document.querySelector('ytd-watch-flexy:not([hidden]) ytd-watch-next-secondary-results-renderer .yt-lockup-view-model__content-image').getBoundingClientRect().width);
  assert(thumbW <= 134, `compact list thumbnails should be small (${thumbW})`);
  await patchSettings({ youtube: { recommendations: 'sidebar' } });
  await page.evaluate(() => window.scrollTo(0, 0));
});

await test('comments: threaded cards, replies, sorting and posting all work', async () => {
  await page.evaluate(() => document.querySelector('ytd-watch-flexy:not([hidden]) ytd-comments#comments').scrollIntoView());
  await page.waitForSelector('ytd-watch-flexy:not([hidden]) ytd-comment-thread-renderer', { timeout: 8000 });
  const card = await page.evaluate(() => { const t = document.querySelector('ytd-watch-flexy:not([hidden]) ytd-comment-thread-renderer'); const cs = getComputedStyle(t); return { r: cs.borderTopLeftRadius, bg: cs.backgroundColor }; });
  assert(card.r === '16px' && card.bg === 'rgb(23, 24, 28)', `threaded comment card style ${JSON.stringify(card)}`);
  const more = active('ytd-comment-replies-renderer #more-replies button').first();
  await more.click();
  await page.waitForFunction(() => document.querySelectorAll('ytd-watch-flexy:not([hidden]) #expanded-threads ytd-comment-view-model').length > 0, null, { timeout: 4000 });
  const line = await page.evaluate(() => getComputedStyle(document.querySelector('ytd-watch-flexy:not([hidden]) ytd-comment-thread-renderer #replies')).borderLeftWidth);
  assert(line === '2px', `replies guide line ${line}`);
  ylog.length = 0;
  await active('ytd-comment-simplebox-renderer #placeholder-area').click();
  await active('#contenteditable-root').click();
  await page.keyboard.type('Watching through Orbit');
  await active('#submit-button button').click();
  await page.waitForFunction(() => [...document.querySelectorAll('ytd-watch-flexy:not([hidden]) ytd-comment-thread-renderer')].some((t) => t.textContent.includes('Watching through Orbit')), null, { timeout: 4000 });
  assert(ylog.some((e) => e.type === 'comment'), 'comment not sent to YouTube');
  await settle(300);
  await shot('yt-07-comments');
  await patchSettings({ youtube: { comments: 'compact' } });
  await page.waitForFunction(() => document.documentElement.classList.contains('orbit-yt-comments-compact'));
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('ytd-watch-flexy:not([hidden]) ytd-comment-thread-renderer')).backgroundColor);
  assert(bg === 'rgba(0, 0, 0, 0)', `compact comments should not be cards (${bg})`);
  await patchSettings({ youtube: { comments: 'threaded' } });
});

await test('playback survives in-app navigation (miniplayer) and Orbit never reloads the page', async () => {
  const b0 = await boot();
  await chrome('.shell-sidebar [data-nav="subscriptions"]').click();
  await waitPath('/feed/subscriptions');
  await settle(800);
  const v = await page.evaluate(() => { const el = document.querySelector('video'); return { same: [...document.querySelectorAll('video')].includes(window.__orbitVideo), playing: window.__orbitVideo && !window.__orbitVideo.paused }; });
  assert(v.same && v.playing, `video should keep playing across navigation ${JSON.stringify(v)}`);
  assert(await boot() === b0, 'navigation reloaded the page');
  assert(await title() === 'Subscriptions', 'top bar title on Subscriptions');
  await page.locator('ytd-miniplayer button[aria-label*="Close" i], ytd-miniplayer .ytp-miniplayer-close-button').first().click().catch(() => {});
});

await test('Orbit navigation covers every page type without reloads', async () => {
  const b0 = await boot();
  for (const [key, path, t] of [['history', '/feed/history', 'History'], ['playlists', '/feed/playlists', 'Playlists'], ['watchlater', '/playlist?list=WL', 'Watch later'], ['liked', '/playlist?list=LL', 'Liked videos'], ['library', '/feed/you', 'You'], ['trending', '/feed/trending', 'Trending'], ['home', '/', 'Home']]) {
    await chrome(`.shell-sidebar [data-nav="${key}"]`).click();
    await waitPath(path);
    await page.waitForFunction((x) => document.querySelector('#orbit-yt-chrome').shadowRoot.querySelector('.shell-topbar h1')?.textContent === x, t, { timeout: 5000 });
    assert(await chrome(`.shell-sidebar [data-nav="${key}"].active`).count() === 1, `${key} not active`);
    if (key === 'history') { await settle(400); await shot('yt-10-history'); }
    if (key === 'watchlater') { await settle(400); await shot('yt-11-playlist'); }
  }
  assert(await boot() === b0, 'navigation reloaded the page');
});

await test('channel page via a subscription in the sidebar', async () => {
  const ch = chrome('.shell-sidebar [data-section="subscriptions"] .sb-item').first();
  const href = await ch.getAttribute('href');
  await ch.click();
  await page.waitForFunction((h) => location.pathname === h, href, { timeout: 5000 });
  await active('yt-page-header-renderer, #page-header').first().waitFor({ timeout: 5000 });
  assert(await active('yt-tab-shape').count() >= 3, 'channel tabs missing');
  await settle(500);
  await shot('yt-12-channel');
});

await test('search: Orbit search box with suggestions, recent searches, filters and results', async () => {
  const input = chrome('.shell-topbar .tb-search input');
  await input.click();
  await input.fill('orbit des');
  await chrome('.yt-suggest .sg-row').first().waitFor({ timeout: 4000 });
  assert(await chrome('.yt-suggest .sg-row').count() >= 2, 'no search suggestions');
  await input.fill('orbit design');
  await input.press('Enter');
  await page.waitForFunction(() => location.pathname === '/results' && new URLSearchParams(location.search).get('search_query') === 'orbit design', null, { timeout: 6000 });
  await active('ytd-search yt-lockup-view-model, ytd-search ytd-video-renderer').first().waitFor({ timeout: 6000 });
  assert(await title() === '“orbit design”', 'search title');
  assert(await active('ytd-search-header-renderer yt-chip-cloud-chip-renderer').count() >= 3, 'search filter chips missing');
  const desc = await active('ytd-search .yt-content-metadata-view-model__metadata-row:nth-child(3)').first().isVisible();
  assert(desc, 'description previews should show in results');
  await settle(400);
  await shot('yt-08-search');
  await page.locator('body').click({ position: { x: 900, y: 600 } }).catch(() => {});
  await input.fill('');
  await input.click();
  await chrome('.yt-suggest-head').waitFor({ timeout: 3000 });
  assert(await chrome('.yt-suggest .sg-row:has-text("orbit design")').count() === 1, 'recent search not remembered');
  await page.keyboard.press('Escape');
});

await test('Shorts: vertical player, native scrolling and actions, comments panel', async () => {
  await chrome('.shell-sidebar [data-nav="shorts"]').click();
  await page.waitForFunction(() => location.pathname.startsWith('/shorts/'), null, { timeout: 6000 });
  await page.waitForSelector('ytd-reel-video-renderer[is-active]', { timeout: 6000 });
  const first = page.url();
  assert(await htmlHas('orbit-yt-shorts-focused'), 'focused Shorts style missing');
  const r = await page.evaluate(() => getComputedStyle(document.querySelector('ytd-reel-video-renderer[is-active] #player-container')).borderTopLeftRadius);
  assert(r === '22px', `shorts player radius ${r}`);
  await settle(400);
  await shot('yt-09-shorts');
  await page.locator('#navigation-button-down button').click();
  await page.waitForFunction((u) => location.href !== u, first, { timeout: 5000 });
  ylog.length = 0;
  await page.locator('ytd-reel-video-renderer[is-active] #actions like-button-view-model button').first().click();
  for (let i = 0; i < 20 && !ylog.some((e) => /like/.test(e.type)); i++) await settle(100);
  assert(ylog.some((e) => /like/.test(e.type)), 'short like not sent');
  await page.locator('ytd-reel-video-renderer[is-active] #actions button[aria-label="Comments"]').first().click();
  await page.waitForSelector('ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-comments-section"]', { timeout: 4000 });
  await page.keyboard.press('ArrowDown');
});

await test('sidebar customisation: pin, hide, collapse and reorder sections (saved per platform)', async () => {
  await chrome('.shell-sidebar [data-nav="home"]').click();
  await waitPath('/');
  const hist = chrome('.shell-sidebar [data-section="you"] [data-nav="history"]');
  await hist.hover();
  await hist.locator('.sb-pin').click();
  await chrome('.shell-sidebar [data-section="pinned"] [data-nav="history"]').waitFor({ timeout: 3000 });
  await chrome('.shell-sidebar .yt-sec-toggle[data-section="you"]').click();
  await page.waitForFunction(() => !document.querySelector('#orbit-yt-chrome').shadowRoot.querySelector('[data-section="you"] [data-nav="playlists"]'));
  await chrome('.shell-sidebar .yt-sec-toggle[data-section="you"]').click();
  await chrome('.shell-sidebar button[aria-label="Customize sidebar"]').click();
  await chrome('.shell-sidebar [data-nav="liked"] .sb-pin').click();
  await chrome('.shell-sidebar button[aria-label="Move You up"]').click();
  await chrome('.shell-sidebar button[aria-label="Done customizing"]').click();
  assert(await chrome('.shell-sidebar [data-nav="liked"]').count() === 0, 'hidden item still shown');
  await settle(400);
  await shot('yt-13-sidebar-custom');
  const s = await getSettings();
  assert(s.youtube.navPinned.includes('history') && s.youtube.navHidden.includes('liked'), `nav customisation not saved ${JSON.stringify(s.youtube)}`);
  assert(s.youtube.navOrder.indexOf('you') < s.youtube.navOrder.indexOf('main'), 'section order not saved');
  await patchSettings({ youtube: { navPinned: [], navHidden: [], navOrder: ['pinned', 'main', 'you', 'subscriptions', 'explore', 'more'], navCollapsed: ['explore'] } });
});

await test('compact sidebar (\\), theme toggle and narrow-window drawer', async () => {
  await page.keyboard.press('\\');
  await page.waitForFunction(() => parseFloat(getComputedStyle(document.body).paddingLeft) === 64, null, { timeout: 3000 });
  await page.keyboard.press('\\');
  await page.waitForFunction(() => parseFloat(getComputedStyle(document.body).paddingLeft) === 244);
  await chrome('.shell-topbar button[aria-label="Toggle theme"]').click();
  await page.waitForFunction(() => document.documentElement.dataset.orbitTheme === 'light');
  assert(!(await page.evaluate(() => document.documentElement.hasAttribute('dark'))), 'YouTube’s own dark attribute should follow Orbit');
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  assert(bg === 'rgb(241, 242, 245)', `light background ${bg}`);
  await settle(500);
  await shot('yt-14-light');
  await chrome('.shell-topbar button[aria-label="Toggle theme"]').click();
  await page.waitForFunction(() => document.documentElement.dataset.orbitTheme === 'dark');
  await page.setViewportSize({ width: 760, height: 900 });
  await page.waitForFunction(() => document.documentElement.classList.contains('orbit-yt-narrow'));
  assert(await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingLeft)) === 0, 'no sidebar gutter when narrow');
  await chrome('.shell-topbar button[aria-label="Menu"]').click();
  await page.waitForFunction(() => document.querySelector('#orbit-yt-chrome').shadowRoot.querySelector('.shell-root.drawer-open'));
  await settle(300);
  await shot('yt-15-narrow-drawer');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 900 });
});

await test('YouTube menus (account) sit above Orbit and work', async () => {
  await chrome('.shell-topbar button[aria-label="Account"]').click();
  await page.waitForFunction(() => document.documentElement.classList.contains('orbit-yt-overlay'), null, { timeout: 4000 });
  assert(await page.getByText('Switch account').first().isVisible(), 'native account menu not visible');
  await settle(250);
  await shot('yt-16-account-menu');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.documentElement.classList.contains('orbit-yt-overlay'), null, { timeout: 4000 });
});

await test('command palette (Ctrl+K) and the three-platform switcher', async () => {
  await page.keyboard.press('Control+k');
  await chrome('.palette input').waitFor({ timeout: 3000 });
  await page.keyboard.type('liked');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.search === '?list=LL', null, { timeout: 4000 });
  await chrome('.shell-sidebar .orb-trigger').click();
  for (const id of ['reddit', 'x', 'youtube']) assert(await chrome(`.orb-menu [data-platform="${id}"]`).count() === 1, `switcher missing ${id}`);
  assert(await chrome('.orb-menu [data-platform="youtube"][aria-checked="true"]').count() === 1, 'YouTube not marked current');
  const sub = await chrome('.orb-menu [data-platform="youtube"] small').innerText();
  assert(sub === 'Videos & creators', `platform subtitle (${sub})`);
  await settle(250);
  await shot('yt-17-switcher');
  await page.keyboard.press('Escape');
});

await test('switching YouTube → X → Reddit → YouTube in one tab resumes each platform', async () => {
  await settle(900);
  await chrome('.shell-sidebar .orb-trigger').click();
  await chrome('.orb-menu [data-platform="x"]').click();
  await page.waitForURL(/x\.com/, { timeout: 8000 });
  await page.waitForFunction(() => document.documentElement.classList.contains('orbit-x-chrome'), null, { timeout: 10000 });
  await page.locator('#orbit-x-chrome .orb-trigger').click();
  assert(await page.locator('#orbit-x-chrome .orb-menu [data-platform="youtube"]').count() === 1, 'X switcher lacks YouTube');
  await page.locator('#orbit-x-chrome .orb-menu [data-platform="reddit"]').click();
  await page.waitForURL(/reddit\.com/, { timeout: 8000 });
  await page.locator('#orbit-app [data-nav="post"]').first().waitFor({ timeout: 15000 });
  await page.locator('#orbit-app .orb-trigger').click();
  const yt = page.locator('#orbit-app .orb-menu [data-platform="youtube"]');
  await page.waitForFunction(() => /Resume/.test(document.querySelector('#orbit-app').shadowRoot.querySelector('.orb-menu [data-platform="youtube"]')?.textContent ?? ''), null, { timeout: 3000 });
  assert(/Liked videos/.test(await yt.innerText()), `YouTube option should resume Liked videos (${(await yt.innerText()).replace(/\n/g, ' ')})`);
  await page.screenshot({ path: join(OUT, 'yt-18-reddit-switcher.png') });
  await yt.click();
  await page.waitForURL(/youtube\.com\/playlist\?list=LL/, { timeout: 8000 });
  await page.waitForFunction(() => document.documentElement.classList.contains('orbit-yt-chrome'), null, { timeout: 10000 });
});

await test('classic YouTube toggle and per-platform disable leave YouTube untouched', async () => {
  await page.evaluate(() => window.dispatchEvent(new Event('orbit:classic')));
  await page.waitForFunction(() => !document.documentElement.classList.contains('orbit-yt'));
  assert(await page.locator('#orbit-yt-chrome').count() === 0, 'chrome still mounted in classic mode');
  assert(await page.evaluate(() => getComputedStyle(document.querySelector('#masthead-container')).opacity) === '1', 'masthead should be back');
  await page.locator('#orbit-launcher button').click();
  await page.waitForFunction(() => document.documentElement.classList.contains('orbit-yt-chrome'), null, { timeout: 5000 });
  await patchSettings({ platforms: { youtube: false } });
  await page.waitForFunction(() => !document.documentElement.classList.contains('orbit-yt'), null, { timeout: 4000 });
  await patchSettings({ platforms: { youtube: true } });
  await page.waitForFunction(() => document.documentElement.classList.contains('orbit-yt-chrome'), null, { timeout: 5000 });
});

await test('signed-out YouTube: Orbit chrome with a sign-in path; m.youtube.com gets the theme only', async () => {
  await page.goto(`${YT}/?loggedout=1`);
  await page.waitForFunction(() => document.documentElement.classList.contains('orbit-yt-chrome'), null, { timeout: 8000 });
  await chrome('.shell-topbar a:has-text("Sign in")').waitFor({ timeout: 5000 });
  assert(await chrome('.yt-signin-card').count() === 1, 'sidebar sign-in card missing');
  await page.goto(`${YT}/?loggedout=0`);
  await cards().first().waitFor({ timeout: 10000 });
  await page.goto('https://m.youtube.com/');
  await page.waitForTimeout(1200);
  assert(await htmlHas('orbit-yt') && await htmlHas('orbit-yt-mobile'), 'mobile skin missing');
  assert(await page.locator('#orbit-yt-chrome').count() === 0, 'no desktop chrome on m.youtube.com');
  await page.goto(`${YT}/`);
  await cards().first().waitFor({ timeout: 10000 });
});

await test('performance: player churn is ignored, no long tasks while scrolling the grid', async () => {
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
  console.log(`      longest task while scrolling + loading: ${Math.round(longest)}ms · ${await cards().count()} cards`);
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
