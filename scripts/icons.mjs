// Renders the Reddify mark to PNG icons using the pre-installed Chromium (Playwright).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../src/icons');
mkdirSync(out, { recursive: true });
const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8f95ff"/><stop offset="1" stop-color="#6a71f2"/></linearGradient></defs>
  <rect width="32" height="32" rx="${size <= 16 ? 7 : 8.5}" fill="url(#g)"/>
  <path d="M10.5 23V9h6.4c3 0 4.9 1.7 4.9 4.3 0 1.9-1.1 3.3-2.9 3.9L22.4 23h-3.6l-3.2-5.5h-1.8V23zm3.3-8.3h2.9c1.2 0 1.9-.6 1.9-1.5s-.7-1.5-1.9-1.5h-2.9z" fill="#fff"/>
</svg>`;
// Playwright is pre-installed globally here; it isn't a project dependency.
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(size)}</body></html>`);
  await page.locator('svg').screenshot({ path: `${out}/icon${size}.png`, omitBackground: true });
}
await browser.close();
console.log('icons written to', out);
