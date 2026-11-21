import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { App } from '../app/App';
import { ErrorBoundary } from '../app/components/ErrorBoundary';
import { initStore } from '../app/state/store';
import tokens from '../styles/tokens.css';
import styles from '../styles/app.css';

let host: HTMLElement | null = null;
let root: Root | null = null;
let started = false;
let keeper: MutationObserver | null = null;

/** Attach styles: constructable stylesheet (CSP-exempt), falling back to a <style> element. */
function attachStyles(shadow: ShadowRoot) {
  const css = `${tokens}\n${styles}`;
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    shadow.adoptedStyleSheets = [sheet];
  } catch (e) {
    console.warn('[Reddify] constructable stylesheet failed, using <style>', e);
    const style = document.createElement('style');
    style.textContent = css;
    shadow.appendChild(style);
  }
}

/** Mounts Reddify inside a Shadow DOM so Reddit's CSS can't leak in and ours can't leak out. */
export function mountApp(): boolean {
  if (host) return true;
  try {
    // A plain <div>, not a custom element: reddit.com hides undefined custom elements (:not(:defined)).
    host = document.createElement('div');
    host.id = 'reddify-app';
    for (const [k, v] of [['display', 'block'], ['visibility', 'visible'], ['opacity', '1'], ['position', 'static']]) host.style.setProperty(k, v, 'important');
    const shadow = host.attachShadow({ mode: 'open' });
    attachStyles(shadow);
    const container = document.createElement('div');
    shadow.appendChild(container);
    document.documentElement.appendChild(host);
    root = createRoot(container);
    root.render(<ErrorBoundary full><App /></ErrorBoundary>);
    if (!started) { started = true; void initStore(); }
    // Reddit's own scripts occasionally rebuild <html> children; put us back if we get removed.
    keeper = new MutationObserver(() => { if (host && !host.isConnected) document.documentElement.appendChild(host); });
    keeper.observe(document.documentElement, { childList: true });
    return true;
  } catch (e) {
    console.error('[Reddify] failed to mount', e);
    unmountApp();
    return false;
  }
}

export function unmountApp() {
  keeper?.disconnect();
  keeper = null;
  try { root?.unmount(); } catch { /* already gone */ }
  host?.remove();
  root = null;
  host = null;
}

export const isMounted = () => host !== null;

/** True once the app shell has actually painted. */
export const isRendered = () => !!host?.shadowRoot?.querySelector('.shell, .state');
