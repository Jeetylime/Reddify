import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { App } from '../app/App';
import { initStore } from '../app/state/store';
import tokens from '../styles/tokens.css';
import styles from '../styles/app.css';

let host: HTMLElement | null = null;
let root: Root | null = null;
let started = false;

/**
 * Mounts Reddify in a closed-off Shadow DOM: Reddit's CSS can't leak in and ours can't leak out.
 * Styles are attached as a constructable stylesheet, which (unlike an inline <style>) isn't subject
 * to the page's Content-Security-Policy.
 */
export function mountApp() {
  if (host) return;
  host = document.createElement('reddify-app');
  const shadow = host.attachShadow({ mode: 'open' });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`${tokens}\n${styles}`);
  shadow.adoptedStyleSheets = [sheet];
  const container = document.createElement('div');
  shadow.appendChild(container);
  document.documentElement.appendChild(host);
  root = createRoot(container);
  root.render(<App />);
  if (!started) { started = true; void initStore(); }
}

export function unmountApp() {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
}

export const isMounted = () => host !== null;
