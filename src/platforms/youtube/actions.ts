import { resolveTheme } from '@core/settings';
import { switchTo } from '@core/platforms';
import type { PlatformId } from '@core/platforms';
import { navigateYT, searchYT, toggleTheaterNative } from './dom';
import { getYT, rememberSearch, setYT, toast, updateSettings } from './store';

/** Imperative actions shared by the sidebar, top bar, palette and shortcuts on YouTube. */

export const go = (href: string) => { setYT({ palette: false, drawer: false }); navigateYT(href); };
export const search = (q: string) => { rememberSearch(q); setYT({ palette: false }); searchYT(q); };
export const toggleTheme = () => updateSettings({ theme: resolveTheme(getYT().settings.theme) === 'dark' ? 'light' : 'dark' });
export const toggleSidebar = () => {
  if (getYT().narrow) { setYT((s) => ({ drawer: !s.drawer })); return; }
  updateSettings({ sidebarMode: getYT().settings.sidebarMode === 'compact' ? 'expanded' : 'compact' });
};
export const theater = () => { if (!toggleTheaterNative()) toast('Open a video to use theater mode'); };
export const classic = () => window.dispatchEvent(new Event('orbit:classic'));
export const toPlatform = (id: PlatformId) => void switchTo(id, 'youtube', getYT().settings.rememberState, document.title);

export function openSettings(section = 'youtube') {
  try { void chrome.runtime.sendMessage({ type: 'open-options', section }); }
  catch { toast('Couldn’t open settings — use the Orbit toolbar button instead.', 'error'); }
}
