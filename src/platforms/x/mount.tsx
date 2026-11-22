import { mountChromeHost } from '@core/shell';
import type { ChromeHost } from '@core/shell';
import xChrome from './ui/chrome.css';
import { Chrome } from './ui/Chrome';

/** Orbit's own layer on X: a Shadow DOM attached to <html>, outside X's React tree (see core/shell). */
let host: ChromeHost | null = null;

export function mountChrome() {
  if (!host) host = mountChromeHost('orbit-x-chrome', <Chrome />, xChrome);
}

export function unmountChrome() {
  host?.unmount();
  host = null;
}
