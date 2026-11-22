/** Maps Reddit URLs to Orbit views. Unrecognised URLs return null and are left to native Reddit. */

export const SORT_SET = new Set(['best', 'hot', 'new', 'top', 'rising', 'controversial']);
export const TIMED = new Set(['top', 'controversial']);

export type FeedRoute = { kind: 'feed'; scope: 'home' | 'popular' | 'all' | 'sub' | 'multi'; sub?: string; sort: string; t?: string; base: string; title: string; key: string };
export type PostRoute = { kind: 'post'; sub: string; id: string; focus?: string; key: string };
export type UserRoute = { kind: 'user'; name: string; tab: string; sort: string; t?: string; key: string };
export type SearchRoute = { kind: 'search'; q: string; sort: string; t?: string; type: 'link' | 'sr' | 'user'; sub?: string; key: string };
export type InboxRoute = { kind: 'inbox'; which: 'inbox' | 'unread' | 'sent'; key: string };
export type Route = FeedRoute | PostRoute | UserRoute | SearchRoute | InboxRoute;

const USER_TABS = new Set(['overview', 'submitted', 'comments', 'saved', 'upvoted', 'downvoted', 'hidden']);
const RESERVED_SUBS = new Set(['random', 'randnsfw', 'friends', 'mod']);

export function parseRoute(pathname: string, search: string): Route | null {
  const params = new URLSearchParams(search);
  let parts: string[];
  try { parts = pathname.split('/').filter(Boolean).map(decodeURIComponent); } catch { return null; }
  const key = '/' + parts.join('/') + (search && search !== '?' ? search : '');
  const t = params.get('t') ?? undefined;
  const [a, b, c, d, , f] = parts;

  if (parts.length === 0) return { kind: 'feed', scope: 'home', sort: 'best', t, base: '', title: 'Home', key };
  if (parts.length === 1 && SORT_SET.has(a)) return { kind: 'feed', scope: 'home', sort: a, t, base: '', title: 'Home', key };

  if (a === 'search' && parts.length === 1) {
    const ty = params.get('type');
    const type = ty === 'sr' || ty === 'communities' ? 'sr' : ty === 'user' || ty === 'people' ? 'user' : 'link';
    return { kind: 'search', q: params.get('q') ?? '', sort: params.get('sort') ?? 'relevance', t, type, key };
  }
  if (a === 'r' && b && !RESERVED_SUBS.has(b.toLowerCase()) && /^[\w+]+$/.test(b)) {
    if (c === 'comments' && d) return { kind: 'post', sub: b, id: d, focus: f || undefined, key: `/r/${b}/comments/${d}${f ? '/_/' + f : ''}` };
    if (c === 'search' && parts.length === 3) return { kind: 'search', q: params.get('q') ?? '', sort: params.get('sort') ?? 'relevance', t, type: 'link', sub: b, key };
    if (parts.length === 2 || (parts.length === 3 && SORT_SET.has(c))) {
      const lower = b.toLowerCase();
      const scope = lower === 'popular' ? 'popular' : lower === 'all' ? 'all' : b.includes('+') ? 'multi' : 'sub';
      const sort = c && c !== 'best' ? c : 'hot';
      const title = scope === 'popular' ? 'Popular' : scope === 'all' ? 'All' : scope === 'multi' ? b.split('+').map((s) => `r/${s}`).join(' + ') : `r/${b}`;
      return { kind: 'feed', scope, sub: scope === 'sub' ? b : undefined, sort, t, base: `/r/${b}`, title, key };
    }
    return null;
  }
  if (a === 'comments' && b && parts.length <= 3) return { kind: 'post', sub: '', id: b, key: `/comments/${b}` };
  if ((a === 'user' || a === 'u') && b && /^[\w-]+$/.test(b)) {
    if (c === 'm' && d && (parts.length === 4 || (parts.length === 5 && SORT_SET.has(parts[4])))) {
      return { kind: 'feed', scope: 'multi', sort: parts[4] && parts[4] !== 'best' ? parts[4] : 'hot', t, base: `/user/${b}/m/${d}`, title: `${d}`, key };
    }
    if (parts.length === 2) return { kind: 'user', name: b, tab: 'overview', sort: params.get('sort') ?? 'new', t, key };
    if (parts.length === 3 && USER_TABS.has(c)) return { kind: 'user', name: b, tab: c, sort: params.get('sort') ?? 'new', t, key };
    return null;
  }
  if (a === 'message' && parts.length === 2 && (b === 'inbox' || b === 'unread' || b === 'sent')) return { kind: 'inbox', which: b, key };
  return null;
}

export function withQuery(path: string, params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return path + (s ? `?${s}` : '');
}

export function feedHref(r: FeedRoute, sort: string, t?: string): string {
  const path = r.scope === 'home' ? (sort === 'best' ? '/' : `/${sort}/`) : `${r.base}/${sort}/`;
  return withQuery(path, { t: TIMED.has(sort) ? (t ?? 'day') : undefined });
}

export function isRedditHost(h: string) { return /^(www\.)?reddit\.com$/i.test(h); }

/** Can Orbit render this URL in-app? */
export function isInApp(u: URL): boolean {
  if (!isRedditHost(u.hostname) || u.hostname.toLowerCase() !== location.hostname.toLowerCase()) return false;
  if (/\.(json|rss|xml|compact)$/i.test(u.pathname)) return false;
  return parseRoute(u.pathname, u.search) !== null;
}

/* ---------- client-side navigation ---------- */

type Listener = () => void;
const listeners = new Set<Listener>();
let lastNav: 'push' | 'pop' = 'push';
export const navType = () => lastNav;

let known = location.href;
/** The last URL Orbit itself rendered — lets the content script spot URL changes made by someone else. */
export const knownHref = () => known;
const emit = () => { known = location.href; listeners.forEach((l) => l()); };
export const notifyExternalChange = () => { lastNav = 'push'; emit(); };

window.addEventListener('popstate', () => { lastNav = 'pop'; emit(); });

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const u = new URL(to, location.origin);
  if (!isInApp(u)) { location.assign(u.toString()); return; }
  const next = u.pathname + u.search + u.hash;
  lastNav = 'push';
  if (next !== location.pathname + location.search + location.hash) {
    if (opts.replace) history.replaceState(history.state, '', next);
    else history.pushState({ orbit: true }, '', next);
  }
  emit();
}

export function onNavigate(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
