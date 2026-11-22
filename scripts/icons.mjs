// Renders the Orbit mark to PNG icons using the pre-installed Chromium (Playwright).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../src/icons');
mkdirSync(out, { recursive: true });
import { readFileSync } from 'node:fs';
const master = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../docs/brand/orbit-mark.svg'), 'utf8');
const svg = (size) => master.replace('width="512" height="512"', `width="${size}" height="${size}"`);
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
