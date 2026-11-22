import { build, context } from 'esbuild';
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => resolve(root, 'src', p);
const out = resolve(root, 'dist');
const watch = process.argv.includes('--watch');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const shared = {
  bundle: true,
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  target: 'chrome111',
  jsx: 'automatic',
  logLevel: 'warning',
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
};

// Content script & service worker are self-contained IIFEs (content scripts can't be ES modules).
// Content CSS is imported as *text* and adopted into the Shadow DOM, so it never touches Reddit's page.
const jobs = [
  // One content bundle per platform: Reddit never loads X code and vice versa. Both share src/core.
  { ...shared, entryPoints: { 'content-reddit': src('platforms/reddit/index.ts'), 'content-x': src('platforms/x/index.ts'), 'content-youtube': src('platforms/youtube/index.ts') }, outdir: out, format: 'iife', loader: { '.css': 'text' } },
  { ...shared, entryPoints: { background: src('background/index.ts') }, outdir: out, format: 'iife' },
  { ...shared, entryPoints: { options: src('options/main.tsx'), popup: src('popup/main.tsx') }, outdir: out, format: 'iife' },
];

function copyStatic() {
  const manifest = JSON.parse(readFileSync(src('manifest.json'), 'utf8'));
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  manifest.version = pkg.version;
  writeFileSync(resolve(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  // Declarative (CSP-exempt, document_start) page styles, gated by classes the content scripts set.
  cpSync(src('platforms/reddit/reddit.css'), resolve(out, 'reddit.css'));
  cpSync(src('platforms/x/x.css'), resolve(out, 'x.css'));
  cpSync(src('platforms/youtube/youtube.css'), resolve(out, 'youtube.css'));
  cpSync(src('options/options.html'), resolve(out, 'options.html'));
  cpSync(src('popup/popup.html'), resolve(out, 'popup.html'));
  if (existsSync(src('icons'))) cpSync(src('icons'), resolve(out, 'icons'), { recursive: true });
}

if (watch) {
  for (const j of jobs) await (await context(j)).watch();
  copyStatic();
  console.log('Orbit: watching for changes…');
} else {
  await Promise.all(jobs.map((j) => build(j)));
  copyStatic();
  console.log('Orbit built → dist/');
}
