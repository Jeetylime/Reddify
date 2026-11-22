/** Classifies YouTube URLs so Orbit knows what kind of page is showing. YouTube itself renders every page. */

export type YTKind =
  | 'home' | 'watch' | 'shorts' | 'search' | 'subscriptions' | 'history' | 'playlists' | 'playlist' | 'library'
  | 'trending' | 'channel' | 'channels' | 'account' | 'other';

export interface YTRoute { kind: YTKind; id?: string; list?: string; q?: string; handle?: string; tab?: string; key: string }

export function parseYTRoute(pathname: string, search = ''): YTRoute {
  const p = new URLSearchParams(search);
  const parts = pathname.split('/').filter(Boolean);
  const key = pathname + (search && search !== '?' ? search : '');
  const [a, b, c] = parts;
  if (!a) return { kind: 'home', key };
  if (a === 'watch') return { kind: 'watch', id: p.get('v') ?? undefined, list: p.get('list') ?? undefined, key };
  if (a === 'shorts') return { kind: 'shorts', id: b, key };
  if (a === 'results') return { kind: 'search', q: p.get('search_query') ?? '', key };
  if (a === 'playlist') return { kind: 'playlist', list: p.get('list') ?? undefined, key };
  if (a === 'feed') {
    if (b === 'subscriptions') return { kind: 'subscriptions', key };
    if (b === 'history') return { kind: 'history', key };
    if (b === 'playlists') return { kind: 'playlists', key };
    if (b === 'you' || b === 'library') return { kind: 'library', key };
    if (b === 'trending' || b === 'explore') return { kind: 'trending', key };
    if (b === 'channels') return { kind: 'channels', key };
    return { kind: 'other', key };
  }
  if (a === 'account' || a.startsWith('account_')) return { kind: 'account', key };
  if (a.startsWith('@')) return { kind: 'channel', handle: a.slice(1), tab: b, key };
  if ((a === 'channel' || a === 'c' || a === 'user') && b) return { kind: 'channel', handle: b, tab: c, key };
  return { kind: 'other', key };
}

export function routeTitle(r: YTRoute): [string, string?] {
  switch (r.kind) {
    case 'home': return ['Home', 'Recommended for you'];
    case 'watch': return ['Watching', r.list ? 'Playlist' : undefined];
    case 'shorts': return ['Shorts'];
    case 'search': return [r.q ? `“${r.q}”` : 'Search', 'Search results'];
    case 'subscriptions': return ['Subscriptions', 'Latest from your channels'];
    case 'history': return ['History', 'Watch history'];
    case 'playlists': return ['Playlists'];
    case 'playlist': return [r.list === 'WL' ? 'Watch later' : r.list === 'LL' ? 'Liked videos' : 'Playlist'];
    case 'library': return ['You', 'Library'];
    case 'trending': return ['Trending', 'Explore'];
    case 'channel': return [`@${r.handle}`, r.tab ? r.tab[0].toUpperCase() + r.tab.slice(1) : 'Channel'];
    case 'channels': return ['All subscriptions'];
    case 'account': return ['Settings'];
    default: return ['YouTube'];
  }
}
