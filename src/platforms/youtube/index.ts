import { loadSettings, onSettingsChanged, platformEnabled, resolveTheme } from '@core/settings';
import type { Settings } from '@core/settings';
import type { Msg, TabState } from '@core/messages';
import { trackSpot } from '@core/platforms';
import { hideLauncher, showLauncher } from '@core/launcher';
import { openSwitcher } from '@core/Switcher';
import { NativeThemeSync } from '@core/pageSheet';
import { parseYTRoute } from './routes';
import { applyTheme, clearTheme, columnsFor, ensureAdopted } from './theme';
import { $, activeGrid, isFullscreen, nativeOverlayOpen, notificationCount, readAccount, readChips, readGuide, sessionState } from './dom';
import type { Session } from './dom';
import { getYT, loadRecent, setYT } from './store';
import { mountChrome, unmountChrome } from './mount';
import { toggleSidebar } from './actions';

/*
 * Orbit for YouTube. YouTube's own app keeps running — the player, likes, subscriptions, comments, playlists,
 * history, search, Premium and ads all stay YouTube's. Orbit re-themes it through YouTube's design tokens,
 * replaces the guide and masthead with Orbit's sidebar and top bar (the masthead stays in place, invisible, so
 * its menus still work), and restyles feeds, the watch page, comments, Shorts and search via youtube.css.
 * On m.youtube.com Orbit applies the skin only.
 */

const html = document.documentElement;
const CLASSIC = 'orbit-yt-classic';
const mobile = /^m\./i.test(location.hostname);
let settings: Settings | null = null;
let active = false;
let cols = 4;

const isHtml = () => document.contentType === 'text/html';
const isClassic = () => { try { return sessionStorage.getItem(CLASSIC) === '1'; } catch { return false; } };
const setClassic = (on: boolean) => { try { if (on) sessionStorage.setItem(CLASSIC, '1'); else sessionStorage.removeItem(CLASSIC); } catch { /* storage blocked */ } };
const route = () => parseYTRoute(location.pathname, location.search);
const wanted = () => isHtml() && (settings ? platformEnabled(settings, 'youtube') : true) && !isClassic();
const flag = (name: string, on: boolean) => html.classList.toggle(name, on);

/* YouTube's own dark mode is the `dark` attribute on <html>; keep it in step with Orbit's theme. */
const nativeTheme = new NativeThemeSync('dark', (t) => (t === 'dark' ? '' : null));

function applySettingsClasses(s: Settings) {
  const y = s.youtube;
  for (const g of ['comfortable', 'compact', 'editorial']) flag(`orbit-yt-grid-${g}`, y.grid === g);
  for (const r of ['sidebar', 'grid', 'list']) flag(`orbit-yt-recs-${r}`, y.recommendations === r);
  for (const w of ['standard', 'wide', 'immersive']) flag(`orbit-yt-watch-${w}`, y.watchWidth === w);
  for (const c of ['threaded', 'compact']) flag(`orbit-yt-comments-${c}`, y.comments === c);
  for (const v of ['focused', 'classic']) flag(`orbit-yt-shorts-${v}`, y.shorts === v);
  flag('orbit-yt-descriptions', y.descriptions);
  flag('orbit-yt-hide-shorts-shelves', y.hideShortsShelves);
  flag('orbit-yt-hide-news-shelves', y.hideNewsShelves);
  flag('orbit-yt-collapse-comments', y.collapseComments);
  flag('orbit-yt-sb-compact', s.sidebarMode === 'compact');
}

function retheme() {
  if (!settings) return;
  applyTheme(settings, { cols });
  applySettingsClasses(settings);
  nativeTheme.apply(resolveTheme(settings.theme), false);
}

/* ---------- activation ---------- */

function activate() {
  if (!settings) return;
  active = true;
  flag('orbit-yt', true);
  flag('orbit-yt-mobile', mobile);
  retheme();
  hideLauncher();
  if (!mobile) whenApp(() => { if (active) { mountChrome(); flag('orbit-yt-chrome', true); watchGrid(); schedule(); } });
  schedule();
}

function deactivate() {
  active = false;
  for (const c of Array.from(html.classList)) if (c.startsWith('orbit-yt')) html.classList.remove(c);
  html.removeAttribute('data-orbit-route');
  clearTheme();
  nativeTheme.restore();
  unmountChrome();
  gridObserver?.disconnect();
}

function reconcile() {
  if (wanted() && settings) { if (!active) activate(); else retheme(); }
  else if (active || !settings) deactivate();
  if (settings && platformEnabled(settings, 'youtube') && isHtml() && isClassic()) showLauncher('Back to Orbit', () => { setClassic(false); reconcile(); });
  else if (!active) hideLauncher();
}

function toggleClassic() { setClassic(!isClassic()); reconcile(); }

/** Runs `fn` once YouTube's app element exists. */
function whenApp(fn: () => void) {
  if ($('ytd-app')) { fn(); return; }
  const mo = new MutationObserver(() => { if ($('ytd-app')) { mo.disconnect(); fn(); } });
  mo.observe(document.documentElement, { childList: true, subtree: true });
}

/* ---------- grid sizing ---------- */

let gridObserver: ResizeObserver | null = null;
let observedGrid: Element | null = null;
function watchGrid() {
  const g = activeGrid();
  if (g === observedGrid) return;
  observedGrid = g;
  gridObserver?.disconnect();
  if (!g) return;
  gridObserver = new ResizeObserver(([e]) => sizeGrid(e.contentRect.width));
  gridObserver.observe(g);
}
function sizeGrid(width: number) {
  if (!settings || width <= 0) return;
  const n = columnsFor(width, settings);
  if (n !== cols) { cols = n; applyTheme(settings, { cols }); }
}

/* ---------- the update loop (throttled, one rAF at a time) ---------- */

let queued = false;
let lastRun = 0;
let lastHref = '';
let lastGuide = 0;

function schedule() {
  if (queued || !active) return;
  queued = true;
  const wait = Math.max(0, 120 - (performance.now() - lastRun));
  window.setTimeout(() => requestAnimationFrame(() => { queued = false; lastRun = performance.now(); if (active) tick(); }), wait);
}

function setSession(s: Session) { if (s !== 'unknown' && getYT().session !== s) setYT({ session: s }); }

function tick() {
  if (!settings) return;
  if (location.href !== lastHref) {
    lastHref = location.href;
    const r = route();
    html.setAttribute('data-orbit-route', r.kind);
    flag('orbit-yt-comments-open', false);
    setYT({ route: r, drawer: false });
    if (settings.rememberState) trackSpot('youtube', () => document.title);
    lastGuide = 0;
  }
  if (mobile) { ensureAdopted(); return; }
  try {
    setSession(sessionState());
    const narrow = window.innerWidth < 860;
    flag('orbit-yt-narrow', narrow);
    if (getYT().narrow !== narrow) setYT({ narrow });
    if (Date.now() - lastGuide > 2500) {
      lastGuide = Date.now();
      const guide = readGuide();
      const g0 = getYT().guide;
      if (JSON.stringify(guide) !== JSON.stringify(g0)) setYT({ guide });
      const account = readAccount();
      if (account && (account.avatar !== getYT().account?.avatar || account.name !== getYT().account?.name)) setYT({ account });
    }
    const r = getYT().route;
    const chips = r.kind === 'home' || r.kind === 'subscriptions' ? readChips() : [];
    const c0 = getYT().chips;
    if (chips.length !== c0.length || chips.some((c, i) => c.label !== c0[i]?.label || c.selected !== c0[i]?.selected || c.el !== c0[i]?.el)) setYT({ chips });
    flag('orbit-yt-subbar', chips.length > 1 && !settings.youtube.hideChips);
    setYT({ notifications: notificationCount() });
    const overlay = nativeOverlayOpen();
    flag('orbit-yt-overlay', overlay);
    if (getYT().overlay !== overlay) setYT({ overlay });
    const fs = isFullscreen();
    flag('orbit-yt-fullscreen', fs);
    if (getYT().fullscreen !== fs) setYT({ fullscreen: fs });
    watchGrid();
    ensureAdopted();
  } catch (e) {
    console.warn('[Orbit] YouTube update skipped:', e);
  }
}

/* ---------- observation: YouTube mutates constantly; ignore the player's own churn ---------- */

function observe() {
  const mo = new MutationObserver((records) => {
    if (!active) return;
    const player = $('#movie_player');
    for (const r of records) {
      if (player && player.contains(r.target)) continue;
      if ((r.target as Element).closest?.('#orbit-yt-chrome')) continue;
      schedule();
      return;
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
}

/* ---------- interactions ---------- */

function isTyping(e: Event): boolean {
  const t = e.composedPath()[0] as HTMLElement | undefined;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

function onKey(e: KeyboardEvent) {
  if (!active || mobile) return;
  const s = getYT();
  const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') { stop(); setYT({ palette: !s.palette, help: false }); return; }
  if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyO') { stop(); openSwitcher(); return; }
  if (e.key === 'Escape' && (s.palette || s.help || s.drawer)) { stop(); setYT({ palette: false, help: false, drawer: false }); return; }
  if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey || s.palette || !settings?.keyboard) return;
  if (e.key === '\\') { stop(); toggleSidebar(); }
  else if (e.key === '/') { stop(); window.dispatchEvent(new Event('orbit:search')); }
}

/** With "collapse comments" on, clicking the comment count reveals the thread list. */
function onClick(e: MouseEvent) {
  if (!active || !settings?.youtube.collapseComments) return;
  const h = (e.target as Element | null)?.closest?.('ytd-comments-header-renderer #count, ytd-comments-header-renderer h2');
  if (h) flag('orbit-yt-comments-open', !html.classList.contains('orbit-yt-comments-open'));
}

/* ---------- boot ---------- */

function boot() {
  if (!isHtml()) return;
  if (!isClassic()) html.classList.add('orbit-yt');
  void Promise.all([loadSettings(), loadRecent()]).then(([s]) => {
    settings = s;
    setYT({ settings: s, route: route() });
    reconcile();
    onSettingsChanged((next) => { settings = next; setYT({ settings: next }); if (observedGrid) sizeGrid(observedGrid.getBoundingClientRect().width); reconcile(); schedule(); });
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (settings?.theme === 'system') reconcile(); });
  });
  observe();
  for (const ev of ['yt-navigate-finish', 'yt-page-data-updated', 'yt-navigate-start']) document.addEventListener(ev, () => schedule());
  window.addEventListener('popstate', () => schedule());
  window.addEventListener('resize', () => schedule(), { passive: true });
  document.addEventListener('fullscreenchange', () => schedule());
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('click', onClick, true);
  window.addEventListener('orbit:classic', toggleClassic);
  chrome.runtime.onMessage.addListener((msg: Msg, _sender, reply) => {
    if (msg.type === 'toggle-classic') { toggleClassic(); reply(true); }
    else if (msg.type === 'get-state') reply({ active, supported: true, classic: isClassic(), platform: 'youtube' } satisfies TabState);
    return false;
  });
}

boot();
