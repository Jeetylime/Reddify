import { loadSettings, onSettingsChanged, resolveTheme } from '../shared/settings';
import type { Settings } from '../shared/settings';
import type { Msg, TabState } from '../shared/messages';
import { onNavigate, parseRoute } from '../app/lib/router';
import { isMounted, mountApp, unmountApp } from './mount';
import { hideLauncher, showLauncher } from './launcher';

/*
 * Activation: Reddify takes over only on pages it can fully render (feeds, posts, profiles, search,
 * inbox) and only while enabled. Everything else stays native Reddit, with a small launcher to hop
 * back. A per-tab "classic" flag (sessionStorage) lets you look at the original page any time.
 * Reddify never touches cookies, auth or Reddit's own scripts.
 */
const CLASSIC = 'reddify-classic';
const html = document.documentElement;
let settings: Settings | null = null;

const isHtml = () => document.contentType === 'text/html';
const isClassic = () => { try { return sessionStorage.getItem(CLASSIC) === '1'; } catch { return false; } };
const setClassic = (on: boolean) => { try { if (on) sessionStorage.setItem(CLASSIC, '1'); else sessionStorage.removeItem(CLASSIC); } catch { /* storage blocked */ } };
const supported = () => parseRoute(location.pathname, location.search) !== null;
const applyTheme = () => { if (settings) html.classList.toggle('reddify-light', resolveTheme(settings.theme) === 'light'); };

function reconcile() {
  const enabled = settings?.enabled ?? true;
  if (isHtml() && enabled && supported() && !isClassic()) {
    html.classList.add('reddify-on');
    applyTheme();
    hideLauncher();
    if (settings && !isMounted()) mountApp(); // wait for settings → no flash of the wrong theme
    return;
  }
  html.classList.remove('reddify-on');
  if (isMounted()) unmountApp();
  if (settings && enabled && isHtml()) {
    showLauncher(isClassic() ? 'Back to Reddify' : 'Open Reddify', () => {
      setClassic(false);
      if (supported()) reconcile(); else location.assign('/');
    });
  } else hideLauncher();
}

function toggleClassic() {
  const goClassic = !isClassic();
  setClassic(goClassic);
  // Reddit's own app hasn't followed Reddify's client-side navigation, so reload to show the real page.
  if (goClassic && isMounted()) location.reload();
  else reconcile();
}

function boot() {
  if (!isHtml()) return;
  // Synchronously hide the native UI on pages we'll replace, before Reddit paints anything.
  if (supported() && !isClassic()) html.classList.add('reddify-on');

  void loadSettings().then((s) => {
    settings = s;
    reconcile();
    onSettingsChanged((next) => { settings = next; reconcile(); applyTheme(); });
  });

  // Our own navigations, plus Reddit's client-side ones while we're inactive (e.g. classic → feed).
  onNavigate(reconcile);
  window.addEventListener('popstate', reconcile);
  let last = location.href;
  window.setInterval(() => { if (location.href !== last) { last = location.href; if (!isMounted()) reconcile(); } }, 700);

  window.addEventListener('reddify:classic', toggleClassic);
  chrome.runtime.onMessage.addListener((msg: Msg, _sender, reply) => {
    if (msg.type === 'toggle-classic') { toggleClassic(); reply(true); }
    else if (msg.type === 'get-state') reply({ active: isMounted(), supported: supported(), classic: isClassic() } satisfies TabState);
    return false;
  });
}

boot();
