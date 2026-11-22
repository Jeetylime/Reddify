/**
 * Native X DOM adapter. Everything Orbit knows about X's markup lives here, so a change on X's side is a
 * one-file fix. Supports both of X's web clients:
 *  - the current "x-web" client (React 19 + Tailwind, semantic HTML, `--x-*` tokens, `data-engagement-action`…)
 *  - the older "responsive-web" client (react-native-web, `data-testid` everywhere).
 * Orbit never replaces X's own components: it finds them, marks them with data-orbit-* attributes for the
 * skin, and drives them (clicks) so X keeps doing the real work — posting, liking, DMs, auth.
 */

export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));

export const isOrbit = (el: Element | null) => !!el?.closest('#orbit-x-chrome');

/* ---------- landmarks ---------- */

export function findMain(): HTMLElement | null {
  return $('main[role="main"]') ?? $('main');
}

/** X's own left navigation column (hidden by Orbit, but kept in the DOM so its links stay clickable). */
export function findNavColumn(): HTMLElement | null {
  const marked = $('[data-orbit-native-nav]');
  if (marked?.isConnected) return marked;
  const legacy = $('header[role="banner"]');
  if (legacy) return legacy;
  const main = findMain();
  if (!main) return null;
  let el: HTMLElement | null = main;
  for (let depth = 0; el && el.parentElement && el.parentElement !== document.body && depth < 8; depth++) {
    const prev = el.previousElementSibling as HTMLElement | null;
    if (prev && !prev.contains(main) && prev.querySelector('nav, a[href="/home"], a[aria-label="X"], a[href="/explore"]')) return prev;
    el = el.parentElement;
  }
  return null;
}

/** The right-hand column (search, trends, who to follow…). */
export function findRail(): HTMLElement | null {
  const legacy = $('[data-testid="sidebarColumn"]');
  if (legacy) return legacy;
  const main = findMain();
  if (!main) return null;
  for (let el: Element | null = main; el && el !== document.body; el = el.parentElement) {
    const next = el.nextElementSibling;
    if (next && next.tagName === 'ASIDE') return next as HTMLElement;
    if (next && next.querySelector(':scope > aside, :scope > div > aside')) return next.querySelector<HTMLElement>('aside');
  }
  return $('aside:not(main aside)');
}

/** X's mobile bottom tab bar. */
export const findBottomBar = () => $('[data-bottom-bar]') ?? $('[data-testid="BottomBar"]');

/* ---------- session ---------- */

export type Session = 'in' | 'out' | 'unknown';

export function sessionState(): Session {
  if ($('a[href="/notifications"], a[href="/compose/post"], a[href="/i/bookmarks"], [data-testid="AppTabBar_Notifications_Link"], [data-testid="SideNav_AccountSwitcher_Button"]')) return 'in';
  if ($('a[href*="/i/jf/onboarding"], a[href^="/login"], a[href*="/i/flow/login"], a[href*="/i/flow/signup"], [data-testid="loginButton"]')) return 'out';
  return 'unknown';
}

/* ---------- navigation ---------- */

/** An anchor X rendered for this path, preferring the (hidden) native nav, then the page itself. */
export function findNativeLink(path: string): HTMLAnchorElement | null {
  const nav = findNavColumn();
  const sel = `a[href="${CSS.escape(path)}"]`;
  const inNav = nav ? $<HTMLAnchorElement>(sel, nav) : null;
  if (inNav) return inNav;
  const bottom = findBottomBar();
  const inBar = bottom ? $<HTMLAnchorElement>(sel, bottom) : null;
  if (inBar) return inBar;
  return $$<HTMLAnchorElement>(sel).find((a) => !isOrbit(a)) ?? null;
}

/**
 * Navigates the way X would: by clicking X's own link for that path, so X's router handles it (instant, no reload,
 * state preserved). Falls back to a normal page load when X hasn't rendered such a link.
 */
export function navigateX(path: string): void {
  const u = new URL(path, location.origin);
  const target = u.pathname + u.search;
  if (target === location.pathname + location.search) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  const a = findNativeLink(target);
  if (a) { a.click(); return; }
  location.assign(u.toString());
}

/** Clicks the first native element matching any selector. Returns whether something was clicked. */
export function clickNative(...selectors: string[]): boolean {
  for (const s of selectors) {
    const el = $$<HTMLElement>(s).find((e) => !isOrbit(e));
    if (el) { el.click(); return true; }
  }
  return false;
}

export function openComposer(): void {
  if (clickNative('[data-testid="SideNav_NewTweet_Button"]', 'a[href="/compose/post"]', 'a[href="/compose/tweet"]')) return;
  location.assign('/compose/post');
}

/** Runs a search with X's own search box when one exists (keeps the SPA), otherwise loads the search page. */
export function searchX(q: string): void {
  const url = `/search?q=${encodeURIComponent(q)}&src=typed_query`;
  const input = $$<HTMLInputElement>('form[role="search"] input, input[data-testid="SearchBox_Search_Input"], input[type="search"]').find((i) => !isOrbit(i));
  const form = input?.closest('form');
  if (input && form) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, q);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const before = location.href;
    try { form.requestSubmit(); } catch { /* not submittable */ }
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    window.setTimeout(() => { if (location.href === before) location.assign(url); }, 450);
    return;
  }
  location.assign(url);
}

/* ---------- account & badges ---------- */

export interface Account { handle: string; name: string; avatar?: string }

export function readAccount(): Account | null {
  const nav = findNavColumn() ?? document;
  const legacyBtn = $('[data-testid="SideNav_AccountSwitcher_Button"]', nav);
  const img = $<HTMLImageElement>('img[alt^="@"]', legacyBtn ?? nav) ?? (legacyBtn ? $<HTMLImageElement>('img', legacyBtn) : null);
  let handle = img?.alt?.startsWith('@') ? img.alt.slice(1) : '';
  const profile = $<HTMLAnchorElement>('[data-testid="AppTabBar_Profile_Link"], a[aria-label="Profile"]', nav);
  if (!handle && profile) handle = profile.getAttribute('href')?.replace(/^\//, '').split('/')[0] ?? '';
  if (!handle && legacyBtn) handle = /@(\w{1,15})/.exec(legacyBtn.textContent ?? '')?.[1] ?? '';
  if (!handle) return null;
  const box = legacyBtn ?? img?.closest('button, a, [role="button"]') ?? null;
  const text = (box?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const name = text.split(`@${handle}`)[0].trim() || handle;
  return { handle, name, avatar: img?.src };
}

function badgeIn(link: Element | null): number {
  if (!link) return 0;
  const labelled = $('[aria-label*="unread" i]', link);
  const m = /(\d+)/.exec(labelled?.getAttribute('aria-label') ?? '');
  if (m) return Number(m[1]);
  for (const el of $$('div, span', link)) {
    if (el.childElementCount === 0 && /^\d{1,3}\+?$/.test(el.textContent?.trim() ?? '')) return parseInt(el.textContent!, 10);
  }
  return 0;
}

export function readBadges(): { notifications: number; messages: number } {
  const nav = findNavColumn() ?? findBottomBar() ?? document;
  return {
    notifications: badgeIn($('a[href="/notifications"], [data-testid="AppTabBar_Notifications_Link"]', nav)),
    messages: badgeIn($('a[href="/i/chat"], a[href="/messages"], [data-testid="AppTabBar_DirectMessage_Link"]', nav)),
  };
}

/** Where X sends "Messages" today (/i/chat on the new client, /messages on the old one). */
export function messagesPath(): string {
  const nav = findNavColumn() ?? document;
  const a = $<HTMLAnchorElement>('a[href="/i/chat"], a[href="/messages"], [data-testid="AppTabBar_DirectMessage_Link"]', nav);
  return a?.getAttribute('href') ?? '/messages';
}

/* ---------- page header & tabs ---------- */

export interface NativeTab { label: string; selected: boolean; el: HTMLElement }

/** X's sticky page header at the top of the main column (title, back button, feed tabs). */
export function findPageHeader(main: HTMLElement): HTMLElement | null {
  const legacy = $('[data-testid="primaryColumn"] > div > div:first-child');
  if (legacy && legacy.querySelector('h2, [role="tablist"]')) return legacy;
  for (const el of $$('[data-top-chrome], [data-page-header], .sticky', main)) {
    if (el.closest('article')) continue;
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.height < 140) return el.closest('[data-top-chrome]') as HTMLElement ?? el;
  }
  return null;
}

/** The feed tabs on Home ("For you", "Following", pinned lists…). */
export function readHomeTabs(main: HTMLElement): NativeTab[] {
  const header = findPageHeader(main);
  const list = (header && $('[role="tablist"]', header)) ?? $('[role="tablist"]', main);
  if (!list || list.closest('article')) return [];
  return $$('[role="tab"]', list).map((el) => ({
    label: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
    selected: el.getAttribute('aria-selected') === 'true',
    el,
  })).filter((t) => t.label);
}

/* ---------- overlays ---------- */

/** True while X shows a modal (composer, media viewer, dialogs): Orbit's chrome steps behind it. */
export function nativeOverlayOpen(): boolean {
  return $$('[aria-modal="true"], [role="dialog"]').some((d) => !isOrbit(d) && d.getBoundingClientRect().width > 0);
}

/* ---------- posts ---------- */

export const POST_TEXT = '[data-testid="tweetText"], div[lang][dir="auto"], div[lang][dir="ltr"], div[lang][dir="rtl"]';
export const MEDIA_IMG = 'img[src*="pbs.twimg.com/media/"], img[src*="/ext_tw_video_thumb/"], img[src*="/amplify_video_thumb/"], img[src*="/tweet_video_thumb/"]';

/** The @handle that wrote a post. */
export function authorOf(article: Element): string | undefined {
  const a = $<HTMLAnchorElement>('[data-post-avatar] a[href], [data-testid="Tweet-User-Avatar"] a[href], [data-testid="User-Name"] a[href]', article)
    ?? $$<HTMLAnchorElement>('a[href]', article).find((x) => /^\/\w{1,15}$/.test(x.getAttribute('href') ?? ''));
  return a?.getAttribute('href')?.replace(/^\//, '').split('/')[0]?.toLowerCase();
}

/** Permalink path of a post ("/user/status/123"), from its timestamp link. */
export function permalinkOf(article: Element): string | undefined {
  const t = $<HTMLAnchorElement>('a[href*="/status/"]:has(time)', article)
    ?? $$<HTMLAnchorElement>('a[href*="/status/"]', article).find((a) => /^\/\w+\/status\/\d+$/.test(a.getAttribute('href') ?? ''));
  return t?.getAttribute('href') ?? undefined;
}

/** Upgrades a pbs.twimg.com media URL to a larger rendition. */
export function largeMedia(src: string, size: 'large' | 'orig' = 'large'): string {
  try {
    const u = new URL(src);
    if (!/pbs\.twimg\.com$/.test(u.hostname)) return src;
    if (u.searchParams.has('name')) u.searchParams.set('name', size);
    else if (/:(small|medium|thumb)$/.test(u.pathname)) u.pathname = u.pathname.replace(/:(small|medium|thumb)$/, `:${size}`);
    else u.searchParams.set('name', size);
    return u.toString();
  } catch { return src; }
}

/** Localised labels X uses for promoted posts. */
export const AD_LABELS = new Set(['Ad', 'Ads', 'Promoted', 'Sponsored', 'Anzeige', 'Gesponsert', 'Publicidad', 'Promocionado', 'Sponsorisé', 'Publicité', 'Sponsorizzato', 'Promovido', 'Patrocinado', '広告', 'プロモーション', '광고', 'Реклама', 'Reklam', 'Advertentie', 'Promoot']);

export function isPromoted(article: Element): boolean {
  if ($('[data-testid="placementTracking"] [data-testid="top-impression-pixel"]', article)) return true;
  for (const el of $$('span, div', article)) {
    if (el.childElementCount > 0) continue;
    const t = el.textContent?.trim();
    if (t && t.length <= 14 && AD_LABELS.has(t) && !el.closest(POST_TEXT)) return true;
  }
  return false;
}
