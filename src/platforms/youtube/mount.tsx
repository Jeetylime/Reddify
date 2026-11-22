import { mountChromeHost } from '@core/shell';
import type { ChromeHost } from '@core/shell';
import ytChrome from './ui/chrome.css';
import { Chrome } from './ui/Chrome';

/** Orbit's own layer on YouTube: a Shadow DOM attached to <html>, outside YouTube's app (see core/shell). */
let host: ChromeHost | null = null;

export function mountChrome() {
  if (!host) host = mountChromeHost('orbit-yt-chrome', <Chrome />, ytChrome);
}

export function unmountChrome() {
  host?.unmount();
  host = null;
}
