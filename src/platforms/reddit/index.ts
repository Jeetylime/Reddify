import { loadSettings, onSettingsChanged, platformEnabled, resolveTheme } from '@core/settings';
import type { Settings } from '@core/settings';
import type { Msg, TabState } from '@core/messages';
import { knownHref, notifyExternalChange, onNavigate, parseRoute } from './app/lib/router';
import { isMounted, isRendered, mountApp, unmountApp } from './mount';
import { hideLauncher, showLauncher } from '@core/launcher';

/*
 * Activation: Orbit takes over only on pages it can fully render (feeds, posts, profiles, search,
 * inbox) and only while enabled. Everything else stays native Reddit, with a small launcher to hop
 * back. A per-tab "classic" flag (sessionStorage) lets you look at the original page any time.
 * Orbit never touches cookies, auth or Reddit's own scripts.
 */
const CLASSIC = 'orbit-classic';
const html = document.documentElement;
let settings: Settings | null = null;

const isHtml = () => document.contentType === 'text/html';
const isClassic = () => { try { return sessionStorage.getItem(CLASSIC) === '1'; } catch { return false; } };
const setClassic = (on: boolean) => { try { if (on) sessionStorage.setItem(CLASSIC, '1'); else sessionStorage.removeItem(CLASSIC); } catch { /* storage blocked */ } };
const supported = () => parseRoute(location.pathname, location.search) !== null;
const applyTheme = () => { if (settings) html.classList.toggle('orbit-light', resolveTheme(settings.theme) === 'light'); };

function reconcile() {
  const enabled = settings ? platformEnabled(settings, 'reddit') : true;
  if (isHtml() && enabled && supported() && !isClassic() && !failed) {
    html.classList.add('orbit-on');
    applyTheme();
    hideLauncher();
    if (settings && !isMounted()) {
      // wait for settings → no flash of the wrong theme
      if (!mountApp()) { failSafe('mount failed'); return; }
      // Safety net: never leave the user staring at a blank page.
      window.setTimeout(() => { if (isMounted() && !isRendered()) failSafe('app did not render'); }, 6000);
    }
    return;
  }
  html.classList.remove('orbit-on');
  if (isMounted()) unmountApp();
  if (settings && enabled && isHtml()) {
    showLauncher(isClassic() ? 'Back to Orbit' : 'Open Orbit', () => {
      setClassic(false);
      if (supported()) reconcile(); else location.assign('/');
    });
  } else hideLauncher();
}

let failed = false;
function failSafe(reason: string) {
  console.error(`[Orbit] ${reason} — falling back to classic Reddit for this tab. Please report this.`);
  failed = true;
  unmountApp();
  html.classList.remove('orbit-on');
}

function toggleClassic() {
  const goClassic = !isClassic();
  setClassic(goClassic);
  // Reddit's own app hasn't followed Orbit's client-side navigation, so reload to show the real page.
  if (goClassic && isMounted()) location.reload();
  else reconcile();
}

function boot() {
  if (!isHtml()) return;
  // Synchronously hide the native UI on pages we'll replace, before Reddit paints anything.
  if (supported() && !isClassic()) html.classList.add('orbit-on');

  void loadSettings().then((s) => {
    settings = s;
    reconcile();
    onSettingsChanged((next) => { settings = next; reconcile(); applyTheme(); });
  });

  // Our own navigations, plus Reddit's client-side ones while we're inactive (e.g. classic → feed).
  onNavigate(reconcile);
  window.addEventListener('popstate', reconcile);
  // Reddit's own (hidden) app can still rewrite the URL with history.replaceState; follow it if so.
  let last = location.href;
  window.setInterval(() => {
    if (location.href === last) return;
    last = location.href;
    if (!isMounted()) reconcile();
    else if (location.href !== knownHref()) { notifyExternalChange(); reconcile(); }
  }, 700);

  window.addEventListener('orbit:classic', toggleClassic);
  chrome.runtime.onMessage.addListener((msg: Msg, _sender, reply) => {
    if (msg.type === 'toggle-classic') { toggleClassic(); reply(true); }
    else if (msg.type === 'get-state') reply({ active: isMounted(), supported: supported(), classic: isClassic(), platform: 'reddit' } satisfies TabState);
    return false;
  });
}

boot();
