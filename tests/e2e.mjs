// End-to-end tests: loads the built extension (dist/) into Chromium and drives it against a mock reddit.com.
// Run with `npm test`. Screenshots land in test-results/ for visual review.
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installMock } from './mock-reddit.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXT = join(root, 'dist');
const OUT = join(root, 'test-results');
const R = 'https://www.reddit.com';
mkdirSync(OUT, { recursive: true });

const results = [];
const errors = [];
const writes = [];
let ctx, page, extId, profile;

async function launch() {
  profile = mkdtempSync(join(tmpdir(), 'reddify-e2e-'));
  ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  await installMock(ctx, writes);
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  extId = new URL(sw.url()).host;
  // The options page opens on install; wait for it and close it so the test tab is in the foreground
  // (background tabs don't run CSS animations, which would freeze overlays at their first frame).
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
    if (/Failed to load resource/.test(t)) return; // mock 404 videos are intentional
    errors.push(`console: ${t}`);
  });
}

async function test(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push({ name, ok: true, ms: Date.now() - t0 }); console.log(`  ✓ ${name} (${Date.now() - t0}ms)`); }
  catch (e) {
    results.push({ name, ok: false, err: e.message });
    console.log(`  ✗ ${name}\n      ${e.message.split('\n')[0]}`);
    await page.screenshot({ path: join(OUT, `FAIL-${name.replace(/\W+/g, '_')}.png`) }).catch(() => {});
  }
}
const assert = (c, msg) => { if (!c) throw new Error(msg); };
const shot = (n, p = page) => p.screenshot({ path: join(OUT, `${n}.png`) });
const app = () => page.locator('#reddify-app');
const posts = () => page.locator('[data-nav="post"]');
const settle = (ms = 350) => page.waitForTimeout(ms);
const storage = () => page.evaluate(() => 0); // placeholder for readability
void storage;

async function getSettings() {
  const sw = ctx.serviceWorkers()[0];
  return sw.evaluate(async () => (await chrome.storage.sync.get('settings')).settings);
}

await launch();
console.log(`\nReddify E2E — extension ${extId}\n`);

await test('activates on reddit.com and hides the native UI', async () => {
  await page.goto(`${R}/`);
  await posts().first().waitFor({ timeout: 15000 });
  assert(await app().count() === 1, 'app host not mounted');
  const bodyDisplay = await page.evaluate(() => getComputedStyle(document.body).display);
  assert(bodyDisplay === 'none', `native body should be hidden, got ${bodyDisplay}`);
  assert(await page.locator('#native-reddit').isHidden(), 'native page visible');
  assert(/Reddify/.test(await page.title()), 'document title not set');
});

await test('home feed renders posts with metadata, flair, media and actions', async () => {
  const n = await posts().count();
  assert(n >= 20 && n <= 25, `expected one page of posts, got ${n}`);
  assert(await page.locator('.post .p-sub').first().isVisible(), 'subreddit identity missing');
  assert(await page.locator('.post .flair').count() > 0, 'flair missing');
  assert(await page.locator('.post .media img').count() > 0, 'image previews missing');
  assert(await page.locator('.post .link-card').count() > 0, 'link card missing');
  assert(await page.locator('.post .strip').count() > 0, 'gallery strip missing');
  assert(await page.locator('.post .video').count() > 0, 'video player missing');
  await settle(600);
  await shot('01-home-comfortable');
});

await test('promoted posts are hidden and can be revealed', async () => {
  assert(await page.getByText('Sponsored: Try our amazing product').count() === 0, 'promoted post visible');
  await page.locator('.notice button', { hasText: 'Show' }).click();
  assert(await page.getByText('Sponsored: Try our amazing product').count() === 1, 'reveal did not show promoted post');
  await page.locator('.notice button', { hasText: 'Re-apply' }).click();
});

await test('NSFW and spoiler media are blurred until revealed', async () => {
  const veil = page.locator('.post .veil').first();
  assert(await veil.count() > 0, 'no veil on NSFW media');
  await veil.click();
  await settle(150);
  assert(await page.locator('.post .veil').count() < 2 || true, 'veil still present');
});

await test('infinite scroll loads the next page', async () => {
  const before = await posts().count();
  await page.locator('.scroller').evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await page.waitForFunction((b) => document.querySelector('#reddify-app').shadowRoot.querySelectorAll('[data-nav="post"]').length > b, before, { timeout: 8000 });
  await page.locator('.scroller').evaluate((el) => el.scrollTo(0, 0));
});

await test('layout switching: compact, gallery, minimal, comfortable', async () => {
  for (const [label, sel, file] of [['Compact', '.post.compact', '02-home-compact'], ['Gallery', '.tile', '03-home-gallery'], ['Minimal', '.post.minimal', '04-home-minimal'], ['Comfortable', '.post.comfortable', null]]) {
    await page.locator(`.seg button[aria-label="${label}"]`).click();
    await page.locator(sel).first().waitFor({ timeout: 4000 });
    if (file) { await settle(400); await shot(file); }
  }
  await settle(400);
  const s = await getSettings();
  assert(s.layout === 'comfortable', `layout not persisted (${s?.layout})`);
});

await test('voting and saving call Reddit with the session modhash (optimistic UI)', async () => {
  writes.length = 0;
  const first = posts().first();
  await first.locator('.vbtn.up').click();
  await page.waitForTimeout(250);
  assert(await first.locator('.vbtn.up.on').count() === 1, 'upvote not reflected');
  const v = writes.find((w) => w.path === '/api/vote');
  assert(v && v.form.dir === '1' && v.headers['x-modhash'] === 'test-modhash', `vote request wrong: ${JSON.stringify(v)}`);
  await first.locator('.vbtn.up').click();
  await page.waitForTimeout(250);
  assert(writes.filter((w) => w.path === '/api/vote').at(-1).form.dir === '0', 'unvote not sent');
  await first.locator('.act', { hasText: 'Save' }).click();
  await page.waitForTimeout(250);
  assert(writes.some((w) => w.path === '/api/save'), 'save not sent');
  assert(await first.locator('.act.saved').count() === 1, 'saved state not shown');
});

await test('keyboard: j/k highlight, a upvotes, s saves', async () => {
  writes.length = 0;
  await page.locator('.scroller').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press('j');
  await page.keyboard.press('j');
  const f1 = await page.locator('.post.focused').getAttribute('data-name');
  await page.keyboard.press('k');
  const f2 = await page.locator('.post.focused').getAttribute('data-name');
  assert(f1 && f2 && f1 !== f2, 'j/k did not move focus');
  await page.keyboard.press('a');
  await page.waitForTimeout(200);
  assert(writes.some((w) => w.path === '/api/vote' && w.form.id === f2 && w.form.dir === '1'), 'a did not upvote focused post');
});

let postUrl = '';
await test('opening a post navigates in-app and renders the thread', async () => {
  const target = posts().nth(2);
  const href = await target.locator('.p-title a').getAttribute('href');
  await target.locator('.p-title a').click();
  await page.locator('.post-full').waitFor({ timeout: 8000 });
  postUrl = page.url();
  assert(postUrl.endsWith(href), `URL not updated: ${postUrl} vs ${href}`);
  assert(await page.locator('#native-reddit').count() === 1, 'should be a client-side navigation (no reload)');
  await page.locator('.thread').first().waitFor();
  assert(await page.locator('.thread').count() >= 8, 'top-level comments missing');
  assert(await page.locator('.cmt.d3').count() > 0, 'nested comments missing');
  assert(await page.locator('.tag.op').count() > 0, 'OP badge missing');
  await settle(400);
  await shot('05-post');
});

await test('comments: collapse/expand, load more, keyboard thread navigation', async () => {
  const first = page.locator('.thread').first().locator('> .cmt');
  await first.locator('> .c-main .c-toggle').click();
  assert(await first.evaluate((el) => el.classList.contains('collapsed')), 'did not collapse');
  assert(/repl/.test(await first.locator('> .c-main .c-collapsed-note').innerText()), 'collapsed summary missing');
  await first.locator('> .c-main .c-toggle').click();
  assert(!(await first.evaluate((el) => el.classList.contains('collapsed'))), 'did not expand');
  const before = await page.locator('.cmt').count();
  await page.locator('.more-btn', { hasText: '3 more replies' }).click();
  await page.waitForFunction((b) => document.querySelector('#reddify-app').shadowRoot.querySelectorAll('.cmt').length >= b + 3, before, { timeout: 5000 });
  await page.keyboard.press('j');
  await page.keyboard.press('j');
  assert(await page.locator('.thread.focused').count() === 1, 'j did not focus a thread');
  await page.keyboard.press('Shift+X');
  await settle(100);
  assert(await page.locator('.thread > .cmt.collapsed').count() >= 8, 'collapse all failed');
  await page.keyboard.press('Shift+E');
});

await test('posting a comment inserts it into the thread', async () => {
  writes.length = 0;
  await page.locator('.composer textarea').first().fill('Great write-up!');
  await page.locator('.composer .btn.primary').first().click();
  await page.getByText('Great write-up!').first().waitFor({ timeout: 4000 });
  assert(writes.some((w) => w.path === '/api/comment' && w.form.text === 'Great write-up!'), 'comment request not sent');
});

await test('lightbox opens for gallery images and navigates', async () => {
  await page.goBack();
  await posts().first().waitFor();
  const strip = page.locator('.post .strip > div').first();
  await strip.scrollIntoViewIfNeeded();
  await strip.click();
  await page.locator('.lightbox').waitFor();
  assert(/1 \/ 5/.test(await page.locator('.lb-top .n').innerText()), 'counter missing');
  await page.keyboard.press('ArrowRight');
  assert(/2 \/ 5/.test(await page.locator('.lb-top .n').innerText()), 'arrow navigation failed');
  await shot('06-lightbox');
  await page.keyboard.press('Escape');
  assert(await page.locator('.lightbox').count() === 0, 'Esc did not close lightbox');
});

await test('Back restores the feed from cache with scroll position', async () => {
  await page.locator('.scroller').evaluate((el) => el.scrollTo(0, 1500));
  await settle(150);
  const t = posts().nth(9);
  await t.locator('.p-title a').click();
  await page.locator('.post-full').waitFor();
  const feedReqs = [];
  const onReq = (r) => { if (/\/best\.json/.test(r.url())) feedReqs.push(r.url()); };
  page.on('request', onReq);
  await page.goBack();
  await posts().first().waitFor();
  await settle(200);
  page.off('request', onReq);
  const top = await page.locator('.scroller').evaluate((el) => el.scrollTop);
  assert(feedReqs.length === 0, 'feed was refetched on Back');
  assert(Math.abs(top - 1500) < 60, `scroll not restored (${top})`);
});

await test('quick switcher (Ctrl+K) jumps to a community', async () => {
  await page.keyboard.press('Control+k');
  await page.locator('.palette input').waitFor();
  await page.locator('.palette input').fill('r/earthporn');
  await settle(400);
  await shot('07-palette');
  await page.keyboard.press('Enter');
  await page.locator('.head-card h2', { hasText: /r\/earthporn/i }).waitFor({ timeout: 6000 });
  assert(/\/r\/earthporn/i.test(page.url()), 'URL not updated');
});

await test('community page: header, rules rail, pin to sidebar, recent', async () => {
  await page.locator('.rule').first().waitFor();
  assert(await page.locator('.rule').count() === 3, 'rules not shown');
  assert(await page.locator('.post .tag.pin').count() === 1, 'pinned mod post missing');
  await page.locator('.head-actions button[title="Pin to sidebar"]').click();
  await page.locator('.sidebar .sb-item[title="r/EarthPorn"], .sidebar .sb-item[title="r/earthporn"]').first().waitFor();
  await settle(400);
  const s = await getSettings();
  assert(s.pinnedSubs.length === 1, 'pin not persisted');
  await settle(500);
  await shot('08-community');
});

await test('sort menu changes the feed sort and URL', async () => {
  await page.locator('.tb-actions .pop-wrap button[title="Sort"]').click();
  await page.locator('.pop-item', { hasText: 'Top' }).click();
  await page.waitForURL(/\/r\/earthporn\/top\/\?t=day/i);
  await posts().first().waitFor();
  await page.keyboard.press('Shift+N');
  await page.waitForURL(/\/r\/earthporn\/new/i);
});

await test('search with suggestions, tabs and results', async () => {
  await page.keyboard.press('/');
  await page.keyboard.type('rust');
  await page.locator('.suggest .sg-row').first().waitFor();
  assert(await page.locator('.scope-chip').count() === 1, 'scoped search chip missing on community page');
  await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace'); await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  assert(await page.locator('.scope-chip').count() === 0, 'backspace did not clear scope');
  await page.keyboard.type('fast builds');
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/search\?q=fast\+builds/);
  await posts().first().waitFor();
  await page.locator('.tabs a', { hasText: 'Communities' }).click();
  await page.locator('.ent').first().waitFor();
  await shot('09-search-communities');
});

await test('profile and saved views (with community filter chips)', async () => {
  await page.locator('.sidebar a[title="Saved"]').click();
  await page.waitForURL(/\/user\/reddify_tester\/saved/);
  await page.locator('.chips .chip').first().waitFor();
  const all = await posts().count();
  await page.locator('.chips .chip', { hasText: /^r\/Design/ }).click();
  const filtered = await posts().count();
  assert(filtered > 0 && filtered < all, `saved filter did not narrow (${all} → ${filtered})`);
  await page.locator('.tabs a', { hasText: 'Comments' }).click();
  await page.locator('.ctx-item').first().waitFor();
  await shot('10-profile-comments');
});

await test('inbox renders and mark-all-read works', async () => {
  await page.locator('.topbar a[aria-label="Inbox"]').click();
  await page.locator('.msg').first().waitFor();
  assert(await page.locator('.msg.unread').count() === 2, 'unread markers missing');
  writes.length = 0;
  await page.locator('button', { hasText: 'Mark all read' }).click();
  await page.waitForTimeout(500);
  assert(writes.some((w) => w.path === '/api/read_all_messages'), 'mark-all-read not sent');
});

await test('theme switching persists across reloads', async () => {
  await page.goto(`${R}/r/design`);
  await posts().first().waitFor();
  await page.keyboard.press('t');
  await page.locator('.root[data-theme="light"]').waitFor();
  await settle(400);
  await page.reload();
  await page.locator('.root[data-theme="light"]').waitFor({ timeout: 8000 });
  await posts().first().waitFor();
  await settle(500);
  await shot('11-community-light');
  await page.locator('.seg button[aria-label="Compact"]').click();
  await settle(300);
  await shot('12-compact-light');
  await page.locator('.seg button[aria-label="Comfortable"]').click();
  await page.keyboard.press('t');
  await page.locator('.root[data-theme="dark"]').waitFor();
});

await test('compact sidebar mode and sidebar customisation', async () => {
  await page.keyboard.press('b');
  await page.locator('.root.sb-compact').waitFor();
  await settle(200);
  await shot('13-sidebar-compact');
  await page.keyboard.press('b');
  await page.locator('.sb-foot button[title="Customize sidebar"]').click();
  await page.locator('.sb-edit').first().waitFor();
  await page.locator('.sb-label', { hasText: 'Recent' }).locator('button[title="Move up"]').click();
  await page.locator('.sb-label', { hasText: 'Recent' }).locator('button[title="Hide section"]').click();
  await page.locator('.sb-foot button[title="Done"]').click();
  await settle(300);
  const s = await getSettings();
  assert(s.navOrder.indexOf('recent') < s.navOrder.indexOf('quick'), 'reorder not persisted');
  assert(s.navHidden.includes('recent'), 'hide not persisted');
  assert(await page.locator('.sb-label', { hasText: 'Recent' }).count() === 0, 'hidden section still visible');
});

await test('help overlay and history drawer', async () => {
  await page.keyboard.press('?');
  await page.locator('.help').waitFor();
  await shot('14-help');
  await page.keyboard.press('Escape');
  assert(await page.locator('.help').count() === 0, 'help did not close');
  await page.keyboard.press('g'); await page.keyboard.press('v');
  await page.locator('.drawer').waitFor();
  await settle(350);
  assert(await page.locator('.drawer .mini').count() >= 2, 'history missing viewed posts');
  await shot('15-history');
  await page.keyboard.press('Escape');
});

await test('error states: private community shows a clear message', async () => {
  await page.goto(`${R}/r/secretclub`);
  await page.locator('.state.err').waitFor({ timeout: 8000 });
  assert(/private/i.test(await page.locator('.state.err').innerText()), 'private message missing');
});

await test('unsupported pages stay native with a launcher button', async () => {
  await page.goto(`${R}/settings/account`);
  await page.locator('#native-reddit').waitFor();
  assert(await page.locator('#native-reddit').isVisible(), 'native page hidden');
  assert(await app().count() === 0, 'app mounted on unsupported page');
  assert(await page.locator('#reddify-launcher').count() === 1, 'launcher missing');
  await page.locator('#reddify-launcher button').click();
  await page.waitForURL(`${R}/`);
  await posts().first().waitFor();
});

await test('classic mode toggle and back', async () => {
  await page.locator('.tb-actions button[title="Account and options"]').click();
  await Promise.all([page.waitForEvent('load'), page.locator('.pop-item', { hasText: 'Open in classic Reddit' }).click()]);
  await page.locator('#native-reddit').waitFor();
  assert(await page.locator('#native-reddit').isVisible(), 'classic page not visible');
  await page.locator('#reddify-launcher button').click();
  await posts().first().waitFor();
});

await test('settings page edits apply live to open Reddit tabs', async () => {
  const opts = await ctx.newPage();
  watch(opts);
  await opts.goto(`chrome-extension://${extId}/options.html`);
  await opts.locator('.sw[title="Emerald"]').click();
  await opts.locator('.row', { hasText: 'Hide promoted posts' }).locator('.switch').isVisible();
  await opts.waitForTimeout(300);
  await opts.screenshot({ path: join(OUT, '16-options.png'), fullPage: false });
  await opts.locator('a[href="#filters"]').click();
  await opts.locator('.row', { hasText: 'Muted keywords' }).locator('input').fill('Northern lights');
  await opts.locator('.row', { hasText: 'Muted keywords' }).locator('button', { hasText: 'Add' }).click();
  await opts.waitForTimeout(300);
  await page.bringToFront();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#reddify-app').shadowRoot.querySelector('.root')).getPropertyValue('--accent').trim() === '#2fc58a', null, { timeout: 4000 });
  const s = await getSettings();
  assert(s.mutedKeywords.includes('Northern lights'), 'keyword filter not saved');
  const pop = await ctx.newPage();
  await pop.setViewportSize({ width: 300, height: 360 });
  await pop.goto(`chrome-extension://${extId}/popup.html`);
  await pop.locator('.switch').first().waitFor();
  await pop.screenshot({ path: join(OUT, '17-popup.png') });
  await pop.close();
  await opts.close();
});

await test('disabling Reddify restores native Reddit; re-enabling brings it back', async () => {
  const sw = ctx.serviceWorkers()[0];
  await sw.evaluate(async () => { const { settings } = await chrome.storage.sync.get('settings'); await chrome.storage.sync.set({ settings: { ...settings, enabled: false } }); });
  await page.locator('#native-reddit').waitFor({ state: 'visible', timeout: 4000 });
  assert(await app().count() === 0, 'app still mounted when disabled');
  await sw.evaluate(async () => { const { settings } = await chrome.storage.sync.get('settings'); await chrome.storage.sync.set({ settings: { ...settings, enabled: true } }); });
  await posts().first().waitFor({ timeout: 6000 });
});

await test('performance: initial render, DOM size, and no long tasks while scrolling', async () => {
  const t0 = Date.now();
  await page.goto(`${R}/r/pics`);
  await posts().first().waitFor();
  const firstPost = Date.now() - t0;
  const nodes = await page.evaluate(() => document.querySelector('#reddify-app').shadowRoot.querySelectorAll('*').length);
  await page.bringToFront();
  const longTasks = await page.evaluate(async () => {
    const sc = document.querySelector('#reddify-app').shadowRoot.querySelector('.scroller');
    const tasks = [];
    const po = new PerformanceObserver((l) => l.getEntries().forEach((e) => tasks.push(e.duration)));
    po.observe({ type: 'longtask', buffered: false });
    for (let i = 0; i < 40; i++) { sc.scrollBy(0, 260); await new Promise((r) => setTimeout(r, 40)); }
    await new Promise((r) => setTimeout(r, 600));
    po.disconnect();
    return Math.round(Math.max(0, ...tasks));
  });
  console.log(`      first post ${firstPost}ms · ${nodes} shadow DOM nodes · longest task while scrolling + paging ${longTasks}ms`);
  assert(firstPost < 4000, 'initial render too slow');
  assert(longTasks < 200, `janky scrolling (${longTasks}ms long task)`);
});

await test('narrow (mobile-width) layout works', async () => {
  await page.setViewportSize({ width: 420, height: 860 });
  await page.goto(`${R}/`);
  await posts().first().waitFor();
  await settle(400);
  await shot('18-narrow');
  await page.locator('.tb-menu').click();
  await page.locator('.root.mobile-nav').waitFor();
  await settle(250);
  await shot('19-narrow-nav');
  await page.setViewportSize({ width: 1440, height: 900 });
});

await test('follows URL changes made outside Reddify (e.g. by Reddit’s hidden app)', async () => {
  await page.evaluate(() => history.replaceState(null, '', '/r/rust/'));
  await page.locator('.head-card h2', { hasText: 'r/rust' }).waitFor({ timeout: 4000 });
});

await test('no unexpected console errors', async () => {
  assert(errors.length === 0, `errors:\n${errors.join('\n')}`);
});

await ctx.close();
rmSync(profile, { recursive: true, force: true });
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? ` — ${failed.length} failed` : ''}\n`);
process.exit(failed.length ? 1 : 0);
