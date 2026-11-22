import { loadSettings, onSettingsChanged, platformEnabled, resolveTheme } from '@core/settings';
import type { Settings } from '@core/settings';
import type { Msg, TabState } from '@core/messages';
import { trackSpot } from '@core/platforms';
import { hideLauncher, showLauncher } from '@core/launcher';
import { NativeThemeSync } from '@core/pageSheet';
import { openSwitcher } from '@core/Switcher';
import { parseXRoute } from './routes';
import { applyTheme, clearTheme, ensureAdopted, remapLegacy } from './theme';
import { applyFilter, decorate, decorateChrome, decorateRail, dockStickies, postImages } from './decorate';
import { findMain, messagesPath, nativeOverlayOpen, readAccount, readBadges, readHomeTabs, sessionState } from './dom';
import type { Session } from './dom';
import { getX, setX } from './store';
import { mountChrome, unmountChrome } from './mount';
import { openReader, toggleSidebar } from './actions';

/*
 * Orbit for X. X keeps running its own app — Orbit re-themes it, replaces its navigation with Orbit's,
 * marks its posts for the Orbit skin and adds a few tools (media viewer, thread reader, bookmark filter).
 * Activation rules: never on log-in/sign-up/OAuth pages; Orbit's sidebar & top bar only once X shows a
 * signed-in session; a per-tab "classic" switch (Alt+Shift+O) shows the untouched site.
 * Orbit never reads or changes cookies, tokens or X's own requests.
 */

const html = document.documentElement;
const CLASSIC = 'orbit-x-classic';
const SESSION_HINT = 'orbitXSession';
let settings: Settings | null = null;
let active = false;
let failed = false;

const isHtml = () => document.contentType === 'text/html';
const isClassic = () => { try { return sessionStorage.getItem(CLASSIC) === '1'; } catch { return false; } };
const setClassic = (on: boolean) => { try { if (on) sessionStorage.setItem(CLASSIC, '1'); else sessionStorage.removeItem(CLASSIC); } catch { /* storage blocked */ } };
const route = () => parseXRoute(location.pathname, location.search);
const wanted = () => isHtml() && !failed && (settings ? platformEnabled(settings, 'x') : true) && !isClassic() && route().kind !== 'auth';

/* ---------- html classes driven by settings ---------- */

function flag(name: string, on: boolean) { html.classList.toggle(name, on); }

function applySettingsClasses(s: Settings) {
  const x = s.x;
  flag('orbit-x-cards', x.postStyle === 'cards');
  flag('orbit-x-list', x.postStyle === 'list');
  flag('orbit-x-hide-promoted', x.hidePromoted);
  flag('orbit-x-hide-views', x.hideViews);
  flag('orbit-x-hide-rail', x.hideRail);
  flag('orbit-x-hide-trends', x.hideTrends);
  flag('orbit-x-hide-wtf', x.hideWhoToFollow);
  flag('orbit-x-hide-premium', x.hidePremium);
  flag('orbit-x-hide-composer', x.hideComposer);
  flag('orbit-x-thread-focus', x.threadFocus);
  flag('orbit-x-sb-compact', s.sidebarMode === 'compact');
}

/* X's current client styles dark/light variants off <html data-theme>; keep it in step with Orbit's theme. */
const nativeTheme = new NativeThemeSync('data-theme', (t) => t);
function syncNativeTheme(on: boolean) {
  if (!on) nativeTheme.restore();
  else if (settings) nativeTheme.apply(resolveTheme(settings.theme), true);
}

/* ---------- activation ---------- */

function activate() {
  if (!settings) return;
  active = true;
  html.classList.add('orbit-x');
  applyTheme(settings);
  applySettingsClasses(settings);
  syncNativeTheme(true);
  hideLauncher();
  if (document.body) mountChrome(); else document.addEventListener('DOMContentLoaded', () => { if (active) { mountChrome(); schedule(); } }, { once: true });
  schedule(true);
}

function deactivate() {
  active = false;
  for (const c of Array.from(html.classList)) if (c.startsWith('orbit-x')) html.classList.remove(c);
  html.removeAttribute('data-orbit-route');
  clearTheme();
  syncNativeTheme(false);
  unmountChrome();
}

function reconcile() {
  if (wanted() && settings) { if (!active) activate(); else { applyTheme(settings); applySettingsClasses(settings); syncNativeTheme(true); } }
  else if (active || !settings) deactivate();
  if (settings && platformEnabled(settings, 'x') && isHtml() && isClassic()) showLauncher('Back to Orbit', () => { setClassic(false); reconcile(); });
  else if (!active) hideLauncher();
}

function toggleClassic() {
  const goClassic = !isClassic();
  setClassic(goClassic);
  reconcile();
}

/* ---------- the incremental update loop ---------- */

let queued = false;
let lastHref = '';
let lastDock = 0;
let defaultFeedDone = false;

function schedule(now = false) {
  if (queued || !active) return;
  queued = true;
  const run = () => { queued = false; if (active) tick(); };
  if (now) queueMicrotask(run); else requestAnimationFrame(run);
}

function setSession(s: Session) {
  if (s === 'unknown' || getX().session === s) return;
  setX({ session: s });
  try { void chrome.storage.local.set({ [SESSION_HINT]: s }); } catch { /* best effort */ }
}

function tick() {
  if (!settings) return;
  const r = route();
  if (r.kind === 'auth') { reconcile(); return; }
  const hrefChanged = location.href !== lastHref;
  if (hrefChanged) {
    lastHref = location.href;
    html.setAttribute('data-orbit-route', r.kind);
    setX({ route: r, filter: getX().route.kind === r.kind ? getX().filter : '' });
    if (settings.rememberState) trackSpot('x', () => document.title);
    lastDock = 0;
  }
  setSession(sessionState());
  const signedIn = getX().session === 'in';
  flag('orbit-x-chrome', signedIn);
  const narrow = window.innerWidth < 700;
  flag('orbit-x-narrow', narrow);
  if (getX().narrow !== narrow) setX({ narrow });

  try {
    if (signedIn) {
      const main = findMain();
      const tabs = r.kind === 'home' && main ? readHomeTabs(main) : [];
      const pt = decorateChrome(r, tabs.length >= 2);
      const p0 = getX().pageTitle;
      if (pt?.[0] !== p0?.[0] || pt?.[1] !== p0?.[1]) setX({ pageTitle: pt });
      const prev = getX().tabs;
      if (tabs.length !== prev.length || tabs.some((t, i) => t.label !== prev[i]?.label || t.selected !== prev[i]?.selected || t.el !== prev[i]?.el)) setX({ tabs });
      if (r.kind === 'home' && tabs.length >= 2 && !defaultFeedDone) {
        defaultFeedDone = true;
        const want = settings.x.defaultFeed === 'following' ? /^following$/i : settings.x.defaultFeed === 'foryou' ? /^for you$/i : null;
        const t = want && tabs.find((x) => want.test(x.label));
        if (t && !t.selected) t.el.click();
      }
      const account = readAccount();
      const a0 = getX().account;
      if (account && (!a0 || a0.handle !== account.handle || a0.avatar !== account.avatar || a0.name !== account.name)) setX({ account });
      const badges = readBadges();
      const b0 = getX().badges;
      if (badges.notifications !== b0.notifications || badges.messages !== b0.messages) setX({ badges });
      setX({ messagesPath: messagesPath() });
    }
    decorate({ route: r, promotedHidden: settings.x.hidePromoted });
    decorateRail();
    if (signedIn && Date.now() - lastDock > 1200) { lastDock = Date.now(); dockStickies(); }
    if (r.kind === 'bookmarks') setX({ filterCount: applyFilter(getX().filter) });
    remapLegacy();
    ensureAdopted();
    const overlay = nativeOverlayOpen();
    flag('orbit-x-overlay', overlay);
    if (getX().overlay !== overlay) setX({ overlay });
  } catch (e) {
    console.warn('[Orbit] X update skipped:', e);
  }
}

/* ---------- interactions ---------- */

function isTyping(e: Event): boolean {
  const t = e.composedPath()[0] as HTMLElement | undefined;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

function onKey(e: KeyboardEvent) {
  if (!active || getX().session !== 'in') return;
  const s = getX();
  const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') { stop(); setX({ palette: !s.palette, help: false }); return; }
  if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyO') { stop(); openSwitcher(); return; }
  if (e.key === 'Escape' && (s.palette || s.help)) { stop(); setX({ palette: false, help: false }); return; }
  if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey || s.palette || s.reader || s.lightbox || !settings?.keyboard) return;
  if (e.key === '\\') { stop(); toggleSidebar(); }
  else if (e.key === 'R' && e.shiftKey && s.route.kind === 'status') { stop(); openReader(); }
  else if (e.key === '/') { stop(); window.dispatchEvent(new Event('orbit:search')); }
}

/** Opens X photos in Orbit's viewer instead of X's modal (shift-click keeps X's own viewer). */
function onClick(e: MouseEvent) {
  if (!active || !settings?.x.lightbox || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element | null)?.closest?.('a[href*="/photo/"]') as HTMLAnchorElement | null;
  if (!a || !a.closest('article') || !findMain()?.contains(a)) return;
  const { images, post } = postImages(a);
  if (!images.length) return;
  const n = Number(/\/photo\/(\d+)/.exec(a.getAttribute('href') ?? '')?.[1] ?? '1');
  e.preventDefault();
  e.stopImmediatePropagation();
  setX({ lightbox: { images, index: Math.min(images.length - 1, Math.max(0, n - 1)), post } });
}

/* ---------- boot ---------- */

function boot() {
  if (!isHtml()) return;
  // Paint Orbit's background immediately (before X renders) unless this tab is in classic mode.
  if (!isClassic() && route().kind !== 'auth') html.classList.add('orbit-x');

  void Promise.all([loadSettings(), chrome.storage.local.get(SESSION_HINT).catch(() => ({}))]).then(([s, hint]) => {
    settings = s;
    setX({ settings: s, route: route() });
    const h = (hint as Record<string, string>)[SESSION_HINT];
    if (h === 'in' || h === 'out') setX({ session: h });
    if (h === 'in' && wanted()) html.classList.add('orbit-x-chrome');
    reconcile();
    onSettingsChanged((next) => { settings = next; setX({ settings: next }); reconcile(); schedule(); });
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (settings?.theme === 'system') reconcile(); });
  });

  new MutationObserver(() => schedule()).observe(document, { childList: true, subtree: true });
  window.addEventListener('popstate', () => schedule());
  window.addEventListener('resize', () => schedule(), { passive: true });
  (window as unknown as { navigation?: EventTarget }).navigation?.addEventListener?.('navigatesuccess', () => schedule());
  // Safety net for URL changes that produce no DOM mutation.
  window.setInterval(() => { if (location.href !== lastHref) { if (route().kind === 'auth' || !active) reconcile(); schedule(); } }, 800);

  window.addEventListener('keydown', onKey, true);
  window.addEventListener('click', onClick, true);
  window.addEventListener('orbit:classic', toggleClassic);
  window.addEventListener('error', (e) => { if (String(e.filename).includes('chrome-extension://') && /orbit/i.test(String(e.message))) failSafe(String(e.message)); });

  chrome.runtime.onMessage.addListener((msg: Msg, _sender, reply) => {
    if (msg.type === 'toggle-classic') { toggleClassic(); reply(true); }
    else if (msg.type === 'get-state') reply({ active, supported: route().kind !== 'auth', classic: isClassic(), platform: 'x' } satisfies TabState);
    return false;
  });
}

function failSafe(reason: string) {
  console.error(`[Orbit] ${reason} — leaving X untouched on this tab. Please report this.`);
  failed = true;
  deactivate();
}

boot();
