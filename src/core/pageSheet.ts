import tokens from './tokens.css';
import { readableOn, themeVars } from './settings';
import type { Settings } from './settings';

/**
 * Page-level styling for platforms where Orbit lays its design over the site's own app (X, YouTube).
 * One constructable stylesheet per platform (CSP-exempt) adopted by the document, built from named parts so
 * each concern (tokens, the site's own variables, sticky offsets…) can update independently.
 */
export class PageSheet {
  private sheet = new CSSStyleSheet();
  private parts = new Map<string, string>();
  private stickyTops = new Set<string>();

  /** @param root selector of the html element while Orbit is on, e.g. `html.orbit-x`. */
  constructor(private root: string, private chromeRoot: string) {}

  set(name: string, css: string) {
    if (this.parts.get(name) === css) return;
    this.parts.set(name, css);
    try { this.sheet.replaceSync([...this.parts.values()].join('\n')); } catch (e) { console.warn('[Orbit] page sheet failed', e); }
    this.adopt();
  }

  adopt() { if (!document.adoptedStyleSheets.includes(this.sheet)) document.adoptedStyleSheets = [...document.adoptedStyleSheets, this.sheet]; }

  clear() {
    this.parts.clear();
    this.stickyTops.clear();
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((x) => x !== this.sheet);
  }

  /** Orbit's design tokens (core/tokens.css) rewritten for the page and namespaced as `--o-*`. */
  tokens(): string {
    return tokens
      .replace(/\.root\[data-theme="(dark|light)"\]/g, `${this.root}[data-orbit-theme="$1"]`)
      .replace(/\.root\s*\{/g, `${this.root} {`)
      .replace(/--([a-z])/g, '--o-$1');
  }

  /** Settings-derived variables (accent, type, density…) as `--o-*` declarations. */
  static vars(s: Settings): string {
    return Object.entries(themeVars(s)).map(([k, v]) => `${k.replace(/^--/, '--o-')}:${v.replace(/var\(--/g, 'var(--o-')};`).join('')
      + `--o-accent-fg:${readableOn(s.accent)};`;
  }

  /** Registers a sticky element's original `top` so a rule can dock it under Orbit's top bar. */
  dockSticky(el: HTMLElement, top: number) {
    const key = String(Math.round(top));
    el.setAttribute('data-orbit-sticky', key);
    if (this.stickyTops.has(key)) return;
    this.stickyTops.add(key);
    this.set('sticky', [...this.stickyTops].map((k) => `${this.chromeRoot} [data-orbit-sticky="${k}"]{top:calc(${k}px + var(--o-top-h))!important}`).join('\n'));
  }
}

/** rgba ramp declarations (`--name-00` … `--name-100`) for a base colour. */
export function alphaRamp(prefix: string, rgb: string): string {
  const steps = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30, 40, 50, 60, 70, 80, 85, 90, 95, 100];
  return steps.map((n) => `${prefix}-${String(n).padStart(2, '0')}:rgba(${rgb},${n / 100})!important;`).join('');
}

/**
 * Keeps a site's own light/dark switch (an attribute on <html>) in step with Orbit's theme while Orbit is on,
 * and restores the site's value when it turns off.
 */
export class NativeThemeSync {
  private original: string | null | undefined;
  private guard: MutationObserver | null = null;
  constructor(private attr: string, private toValue: (theme: 'dark' | 'light') => string | null) {}

  apply(theme: 'dark' | 'light', onlyIfPresent: boolean) {
    const html = document.documentElement;
    if (onlyIfPresent && !html.hasAttribute(this.attr)) return;
    const want = this.toValue(theme);
    if (this.original === undefined) this.original = html.getAttribute(this.attr);
    const write = () => { if (want === null) html.removeAttribute(this.attr); else html.setAttribute(this.attr, want); };
    if (html.getAttribute(this.attr) !== want) write();
    this.guard?.disconnect();
    this.guard = new MutationObserver(() => { if (html.getAttribute(this.attr) !== want) { this.original = html.getAttribute(this.attr); write(); } });
    this.guard.observe(html, { attributes: true, attributeFilter: [this.attr] });
  }

  restore() {
    this.guard?.disconnect();
    this.guard = null;
    if (this.original === undefined) return;
    const html = document.documentElement;
    if (this.original === null) html.removeAttribute(this.attr); else html.setAttribute(this.attr, this.original);
    this.original = undefined;
  }
}
