import { getState, setState, toast, updateSettings } from './store';
import { feedHref, navigate, parseRoute } from '../lib/router';
import type { Layout } from '@core/settings';
import { resolveTheme } from '@core/settings';

/** Imperative actions shared by buttons, keyboard shortcuts and the command palette. */

let scroller: HTMLElement | null = null;
export const setScroller = (el: HTMLElement | null) => { scroller = el; };
export const getScroller = () => scroller;

let refreshFn: (() => void) | null = null;
export const setRefresh = (fn: (() => void) | null) => { refreshFn = fn; };

export const toTop = () => scroller?.scrollTo({ top: 0, behavior: 'smooth' });
export function refresh() {
  if (!refreshFn) { toast('Nothing to refresh here'); return; }
  refreshFn();
  scroller?.scrollTo({ top: 0 });
}

export const setLayout = (layout: Layout) => updateSettings({ layout });
export const toggleTheme = () => updateSettings({ theme: resolveTheme(getState().settings.theme) === 'dark' ? 'light' : 'dark' });
export const toggleSidebar = () => updateSettings((s) => ({ sidebarMode: s.sidebarMode === 'compact' ? 'expanded' : 'compact' }));
export const toggleReading = () => updateSettings((s) => ({ readingMode: !s.readingMode }));
export const openPalette = () => setState({ palette: true, help: false });
export const openHelp = () => setState({ help: true, palette: false });
export const openDrawer = () => setState({ drawer: true });
export const classic = () => window.dispatchEvent(new Event('orbit:classic'));

export function openSettings() {
  try { void chrome.runtime.sendMessage({ type: 'open-options' }); }
  catch { toast('Couldn’t open settings — use the Orbit toolbar button instead.', 'error'); }
}

export function setSort(sort: string) {
  const r = parseRoute(location.pathname, location.search);
  if (r?.kind === 'feed') navigate(feedHref(r, sort, r.t));
  else toast('Sorting applies to feeds');
}
