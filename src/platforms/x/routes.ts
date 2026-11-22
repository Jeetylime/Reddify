/** Classifies X URLs so Orbit knows what kind of page is showing. X itself still renders every page. */

export type XKind =
  | 'home' | 'explore' | 'search' | 'notifications' | 'messages' | 'bookmarks' | 'lists' | 'communities'
  | 'profile' | 'status' | 'media' | 'compose' | 'settings' | 'grok' | 'premium' | 'auth' | 'other';

export interface XRoute { kind: XKind; handle?: string; id?: string; tab?: string; q?: string; key: string }

/** First path segments that are X features, never usernames. */
const RESERVED = new Set([
  'home', 'explore', 'search', 'notifications', 'messages', 'i', 'settings', 'compose', 'login', 'logout', 'signup', 'tos', 'privacy',
  'hashtag', 'jobs', 'account', 'intent', 'share', 'download', 'about', 'rules', 'help', 'communities', 'lists', 'bookmarks', 'oauth',
]);

/** Log-in, sign-up and account-recovery flows: Orbit never touches these. */
const AUTH = /^\/(login|logout|signup|account\/|i\/flow\/|i\/jf\/|i\/oauth2?\/|oauth\/|i\/(sso|safety|verify))/i;

export function parseXRoute(pathname: string, search = ''): XRoute {
  const params = new URLSearchParams(search);
  const parts = pathname.split('/').filter(Boolean);
  const key = pathname + (search && search !== '?' ? search : '');
  const [a, b, c, d] = parts.map((p) => p.toLowerCase());
  if (AUTH.test(pathname)) return { kind: 'auth', key };
  if (!a || a === 'home') return { kind: 'home', key };
  if (a === 'explore') return { kind: 'explore', tab: b, key };
  if (a === 'search' || a === 'hashtag') return { kind: 'search', q: a === 'hashtag' ? `#${parts[1] ?? ''}` : params.get('q') ?? '', tab: params.get('f') ?? undefined, key };
  if (a === 'notifications') return { kind: 'notifications', tab: b, key };
  if (a === 'messages' || (a === 'i' && b === 'chat')) return { kind: 'messages', id: a === 'i' ? parts[2] : parts[1], key };
  if (a === 'compose') return { kind: 'compose', key };
  if (a === 'settings' || (a === 'i' && (b === 'display' || b === 'keyboard_shortcuts'))) return { kind: 'settings', key };
  if (a === 'i') {
    if (b === 'bookmarks') return { kind: 'bookmarks', id: parts[2], key };
    if (b === 'lists') return { kind: 'lists', id: parts[2], key };
    if (b === 'communities') return { kind: 'communities', id: parts[2], key };
    if (b === 'grok') return { kind: 'grok', key };
    if (b?.startsWith('premium') || b === 'verified-choose') return { kind: 'premium', key };
    return { kind: 'other', key };
  }
  if (RESERVED.has(a)) return { kind: 'other', key };
  const handle = parts[0];
  if (b === 'status' && c && /^\d+$/.test(c)) {
    if ((d === 'photo' || d === 'video') && parts[4]) return { kind: 'media', handle, id: c, key };
    return { kind: 'status', handle, id: c, tab: d, key };
  }
  if (b === 'lists') return { kind: 'lists', handle, key };
  if (b === 'communities') return { kind: 'communities', handle, key };
  return { kind: 'profile', handle, tab: b ?? 'posts', key };
}

export const ROUTE_TITLES: Record<XKind, string> = {
  home: 'Home', explore: 'Explore', search: 'Search', notifications: 'Notifications', messages: 'Messages', bookmarks: 'Bookmarks',
  lists: 'Lists', communities: 'Communities', profile: 'Profile', status: 'Post', media: 'Media', compose: 'New post', settings: 'Settings',
  grok: 'Grok', premium: 'Premium', auth: 'Account', other: 'X',
};

export function routeTitle(r: XRoute): [string, string?] {
  switch (r.kind) {
    case 'home': return ['Home', 'Your timeline'];
    case 'profile': return [`@${r.handle}`, r.tab && r.tab !== 'posts' ? r.tab.replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase()) : 'Profile'];
    case 'status': return ['Post', r.handle ? `Conversation · @${r.handle}` : 'Conversation'];
    case 'search': return [r.q ? `“${r.q}”` : 'Search', 'Search results'];
    case 'notifications': return ['Notifications', r.tab === 'mentions' ? 'Mentions' : r.tab === 'verified' ? 'Verified' : 'All activity'];
    case 'messages': return ['Messages', 'Direct messages'];
    case 'bookmarks': return ['Bookmarks', 'Saved posts'];
    case 'explore': return ['Explore', 'Trends and topics'];
    default: return [ROUTE_TITLES[r.kind]];
  }
}
