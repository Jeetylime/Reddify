import { resolveTheme } from '@core/settings';
import { switchTo } from '@core/platforms';
import { collectThread } from './decorate';
import { navigateX, openComposer, permalinkOf, findMain } from './dom';
import { getX, setX, toast, updateSettings, updateX } from './store';

/** Imperative actions shared by the sidebar, top bar, palette and keyboard shortcuts on X. */

export const go = (path: string) => { setX({ palette: false }); navigateX(path); };
export const compose = () => { setX({ palette: false }); openComposer(); };
export const toggleTheme = () => updateSettings({ theme: resolveTheme(getX().settings.theme) === 'dark' ? 'light' : 'dark' });
export const toggleSidebar = () => updateSettings({ sidebarMode: getX().settings.sidebarMode === 'compact' ? 'expanded' : 'compact' });
export const toggleRail = () => updateX({ hideRail: !getX().settings.x.hideRail });
export const classic = () => window.dispatchEvent(new Event('orbit:classic'));
export const toReddit = () => void switchTo('reddit', 'x', getX().settings.rememberState, document.title);

export function openSettings(section = '') {
  try { void chrome.runtime.sendMessage({ type: 'open-options', section }); }
  catch { toast('Couldn’t open settings — use the Orbit toolbar button instead.', 'error'); }
}

export function openReader() {
  const t = collectThread();
  if (!t.posts.length) { toast('Open a post to read its thread'); return; }
  setX({ reader: t, palette: false });
}

export async function copyLink() {
  const main = findMain();
  const route = getX().route;
  const focal = main?.querySelector('[data-orbit-focal] article');
  const path = (focal && permalinkOf(focal)) ?? (route.kind === 'status' ? location.pathname : undefined);
  const url = `https://x.com${path ?? location.pathname}`;
  try { await navigator.clipboard.writeText(url); toast('Link copied', 'success'); }
  catch { toast(url); }
}
