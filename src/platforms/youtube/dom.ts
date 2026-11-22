/**
 * Native YouTube DOM adapter. Everything Orbit assumes about YouTube's markup lives here. YouTube's desktop
 * app is built from custom elements (`ytd-*`, `yt-*-view-model`) whose names are very stable, so Orbit keys
 * on element names, ids and ARIA rather than generated classes. Orbit never replaces YouTube's components:
 * it drives them (clicks, inputs) so YouTube keeps doing the real work — playback, likes, subscriptions,
 * comments, playlists, history, search and account features.
 */

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
export const isOrbit = (el: Element | null) => !!el?.closest('#orbit-yt-chrome');
const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

export const app = () => $('ytd-app');
/** The page element currently on screen (YouTube keeps earlier pages in the DOM, hidden). */
export const activePage = () => $('ytd-page-manager > :not([hidden])');

/* ---------- session & account ---------- */

export type Session = 'in' | 'out' | 'unknown';

export function sessionState(): Session {
  if ($('#masthead #avatar-btn, ytd-masthead button#avatar-btn, ytd-topbar-menu-button-renderer #avatar-btn')) return 'in';
  if ($('ytd-masthead a[href*="ServiceLogin"], ytd-masthead #sign-in, ytd-button-renderer a[href*="accounts.google.com"]')) return 'out';
  return 'unknown';
}

export interface Account { name: string; avatar?: string }
export function readAccount(): Account | null {
  const img = $<HTMLImageElement>('#masthead #avatar-btn img, ytd-masthead #avatar-btn img');
  if (!img) return null;
  return { name: img.alt?.replace(/^Avatar image$/i, '') || 'Your account', avatar: img.src || undefined };
}

export function notificationCount(): number {
  const b = $('ytd-notification-topbar-button-renderer .yt-spec-icon-badge-shape__badge, ytd-notification-topbar-button-renderer #notification-count, ytd-notification-topbar-button-renderer [class*="badge"]');
  const n = parseInt(text(b), 10);
  return Number.isFinite(n) ? n : 0;
}

/* ---------- the guide (YouTube's own sidebar, hidden by Orbit but kept for its links) ---------- */

export interface GuideEntry { title: string; href: string; avatar?: string; fresh?: boolean }
export interface GuideData { you: GuideEntry[]; subscriptions: GuideEntry[]; explore: GuideEntry[]; more: GuideEntry[]; yourVideos?: string }

function entries(section: Element): GuideEntry[] {
  return $$('ytd-guide-entry-renderer', section).map((e) => {
    const a = $<HTMLAnchorElement>('a#endpoint, a[href]', e);
    const img = $<HTMLImageElement>('img', e);
    return {
      title: a?.getAttribute('title') || text($('.title, yt-formatted-string', e)) || text(a),
      href: a?.getAttribute('href') ?? '',
      avatar: img?.src && !img.src.startsWith('data:') ? img.src : undefined,
      fresh: e.getAttribute('line-end-style') === 'dot' || !!$('#newness-dot:not([hidden]), .guide-entry-badge, [data-orbit-new]', e),
    };
  }).filter((x) => x.title && x.href);
}

export function readGuide(): GuideData {
  const out: GuideData = { you: [], subscriptions: [], explore: [], more: [] };
  for (const sec of $$('ytd-guide-renderer ytd-guide-section-renderer')) {
    const title = text($('#guide-section-title, h3', sec)).toLowerCase();
    const list = entries(sec);
    if (/subscriptions/.test(title)) out.subscriptions = list.filter((e) => /^\/(@|channel\/|c\/|user\/)/.test(e.href));
    else if (/^you\b|library/.test(title)) out.you = list;
    else if (/explore/.test(title)) out.explore = list;
    else if (!title && list.some((e) => /^\/account|settings/i.test(e.href + e.title))) out.more = list;
  }
  for (const e of [...out.you, ...$$('ytd-guide-entry-renderer a[href*="studio.youtube.com"]').map((a) => ({ title: '', href: a.getAttribute('href') ?? '' }))]) {
    if (/studio\.youtube\.com/.test(e.href)) { out.yourVideos = e.href; break; }
  }
  return out;
}

/* ---------- navigation ---------- */

/** An anchor YouTube rendered for this URL (guide first), whose own click handler navigates in-app. */
export function findNativeLink(href: string): HTMLAnchorElement | null {
  const sel = `a[href="${CSS.escape(href)}"]`;
  return $<HTMLAnchorElement>(`ytd-guide-renderer ${sel}`) ?? $<HTMLAnchorElement>(`ytd-mini-guide-renderer ${sel}`)
    ?? $$<HTMLAnchorElement>(sel).find((a) => !isOrbit(a) && !a.closest('[hidden]')) ?? null;
}

/** Navigates the way YouTube would (in-app, playback preserved), falling back to a page load. */
export function navigateYT(href: string): void {
  const u = new URL(href, location.origin);
  if (u.origin !== location.origin) { location.assign(u.toString()); return; }
  const path = u.pathname + u.search;
  if (path === location.pathname + location.search) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  const a = findNativeLink(path);
  if (a) { a.click(); return; }
  location.assign(u.toString());
}

/** YouTube's own search box (in the hidden masthead). */
const searchInput = () => $<HTMLInputElement>('ytd-masthead input.ytSearchboxComponentInput, ytd-masthead input#search, ytd-masthead input[name="search_query"]');

function setNativeValue(input: HTMLInputElement, v: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, v);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Searches with YouTube's own search box (keeps search history, filters and the in-app navigation). */
export function searchYT(q: string): void {
  const url = `/results?search_query=${encodeURIComponent(q).replace(/%20/g, '+')}`;
  const input = searchInput();
  if (input) {
    setNativeValue(input, q);
    const before = location.href;
    const btn = $<HTMLElement>('ytd-masthead button.ytSearchboxComponentSearchButton, ytd-masthead #search-icon-legacy, ytd-masthead button[aria-label="Search"]');
    if (btn) btn.click(); else input.form?.requestSubmit();
    window.setTimeout(() => { if (location.href === before) location.assign(url); }, 600);
    return;
  }
  location.assign(url);
}

/** Asks YouTube's own search box for suggestions and reads what it renders. */
export function nativeSuggestions(q: string): Promise<string[]> {
  const input = searchInput();
  if (!input || !q) return Promise.resolve([]);
  setNativeValue(input, q);
  return new Promise((resolve) => window.setTimeout(() => {
    const rows = $$('.ytSearchboxComponentSuggestionsContainer [role="option"], .sbsb_c, ytd-searchbox-suggestion, [role="listbox"] [role="option"]')
      .filter((r) => !isOrbit(r))
      .map((r) => text(r))
      .filter(Boolean);
    resolve([...new Set(rows)].slice(0, 8));
  }, 260));
}

/* ---------- masthead actions (kept native) ---------- */

export const clickNative = (...selectors: string[]): boolean => {
  for (const s of selectors) {
    const el = $$<HTMLElement>(s).find((e) => !isOrbit(e));
    if (el) { el.click(); return true; }
  }
  return false;
};
export const openAccountMenu = () => clickNative('ytd-masthead #avatar-btn', 'ytd-topbar-menu-button-renderer #avatar-btn');
export const openNotifications = () => clickNative('ytd-notification-topbar-button-renderer button', 'ytd-notification-topbar-button-renderer');
export const openCreate = () => clickNative('ytd-masthead ytd-topbar-menu-button-renderer button[aria-label="Create"]', 'ytd-masthead button[aria-label="Create"]');
export const signInHref = () => $<HTMLAnchorElement>('ytd-masthead a[href*="ServiceLogin"], ytd-masthead a[href*="accounts.google.com"]')?.href
  ?? `https://accounts.google.com/ServiceLogin?service=youtube&continue=${encodeURIComponent(location.href)}`;

/* ---------- chips (YouTube's category filters) ---------- */

export interface NativeChip { label: string; selected: boolean; el: HTMLElement }

/** The category chips on Home / Subscriptions (the bar under the masthead). */
export function readChips(): NativeChip[] {
  const page = activePage();
  if (!page) return [];
  const bar = $('ytd-feed-filter-chip-bar-renderer', page);
  if (!bar) return [];
  return $$('yt-chip-cloud-chip-renderer', bar).map((c) => ({
    label: text($('.ytChipShapeChip, #text, chip-shape', c) ?? c),
    selected: c.hasAttribute('selected') || !!$('.ytChipShapeActive, [aria-selected="true"]', c),
    el: ($('button', c) ?? c) as HTMLElement,
  })).filter((c) => c.label);
}

/* ---------- overlays & player ---------- */

/** True while YouTube shows a popup/dialog: Orbit's chrome steps behind it. */
export function nativeOverlayOpen(): boolean {
  for (const d of $$('ytd-popup-container tp-yt-iron-dropdown, ytd-popup-container tp-yt-paper-dialog, tp-yt-paper-dialog, [role="dialog"][aria-modal="true"]')) {
    if (isOrbit(d) || d.getAttribute('aria-hidden') === 'true') continue;
    const r = d.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(d).display !== 'none' && getComputedStyle(d).visibility !== 'hidden') return true;
  }
  return false;
}

export const watchFlexy = () => $('ytd-watch-flexy:not([hidden])');
export const isTheater = () => !!watchFlexy()?.hasAttribute('theater');
export const isFullscreen = () => !!document.fullscreenElement || !!$('ytd-watch-flexy[fullscreen]:not([hidden])');
export const mainVideo = () => $<HTMLVideoElement>('#movie_player video.html5-main-video, #movie_player video');
export const toggleTheaterNative = () => clickNative('#movie_player .ytp-size-button');

/** Grid container on the active page, used to size columns. */
export const activeGrid = () => { const p = activePage(); return p ? $('ytd-rich-grid-renderer', p) : null; };
