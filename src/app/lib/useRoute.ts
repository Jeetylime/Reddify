import { useSyncExternalStore } from 'react';
import { onNavigate, parseRoute } from './router';
import type { Route } from './router';

let memo: { href: string; route: Route | null } = { href: '', route: null };
let version = 0;
onNavigate(() => { version++; });
const snapshot = () => location.pathname + location.search + '#' + version;

/** Re-renders on in-app navigation and Back/Forward; returns the parsed route. */
export function useRoute(): Route | null {
  const s = useSyncExternalStore(onNavigate, snapshot);
  if (memo.href !== s) memo = { href: s, route: parseRoute(location.pathname, location.search) };
  return memo.route;
}
