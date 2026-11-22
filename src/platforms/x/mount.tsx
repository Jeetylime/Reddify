import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import tokens from '@core/tokens.css';
import components from '@core/components.css';
import chromeCss from '@core/chrome.css';
import xChrome from './ui/chrome.css';
import { Chrome } from './ui/Chrome';

/**
 * Orbit's own layer on X lives in a Shadow DOM attached to <html> (outside X's React tree, so X's hydration
 * and re-renders never see it, and neither stylesheet can leak into the other).
 */
let host: HTMLElement | null = null;
let root: Root | null = null;
let keeper: MutationObserver | null = null;

export function mountChrome() {
  if (host) return;
  host = document.createElement('div');
  host.id = 'orbit-x-chrome';
  for (const [k, v] of [['display', 'block'], ['visibility', 'visible'], ['opacity', '1']]) host.style.setProperty(k, v, 'important');
  const shadow = host.attachShadow({ mode: 'open' });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`${tokens}\n${components}\n${chromeCss}\n${xChrome}`);
  shadow.adoptedStyleSheets = [sheet];
  const container = document.createElement('div');
  shadow.appendChild(container);
  document.documentElement.appendChild(host);
  root = createRoot(container);
  root.render(<Chrome />);
  keeper = new MutationObserver(() => { if (host && !host.isConnected) document.documentElement.appendChild(host); });
  keeper.observe(document.documentElement, { childList: true });
}

export function unmountChrome() {
  keeper?.disconnect();
  keeper = null;
  try { root?.unmount(); } catch { /* already gone */ }
  host?.remove();
  host = null;
  root = null;
}
