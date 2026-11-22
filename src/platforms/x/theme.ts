import { resolveTheme } from '@core/settings';
import { PageSheet, alphaRamp } from '@core/pageSheet';
import type { Settings } from '@core/settings';

/**
 * Page-level theming for X. One constructable stylesheet (CSP-exempt) adopted by the document holds:
 *  1. Orbit's design tokens, prefixed `--o-*`, generated from core/tokens.css (single source of truth);
 *  2. X's own semantic tokens (`--x-bg-primary`, `--x-fg-*`…) re-pointed at Orbit's, so every X surface —
 *     menus, dialogs, DMs, settings — picks up Orbit's palette without per-component CSS;
 *  3. for X's older client, a remap of its atomic colour classes (scanned from its stylesheet at runtime);
 *  4. offsets for X's sticky headers so they dock under Orbit's top bar.
 */

const page = new PageSheet('html.orbit-x', 'html.orbit-x-chrome');
const TOKENS = page.tokens();

function build(s: Settings): string {
  const theme = resolveTheme(s.theme);
  const dark = theme === 'dark';
  const vars = PageSheet.vars(s);
  const colW = Math.max(560, Math.min(s.contentWidth, 860));
  const media = { compact: '300px', balanced: '520px', full: '100000px' }[s.x.mediaSize];
  const gap = { cozy: '14px', regular: '10px', tight: '6px' }[s.density];
  const pad = { cozy: '16px', regular: '12px', tight: '8px' }[s.density];
  const fg = dark ? '255,255,255' : '0,0,0';
  const bgA = dark ? '0,0,0' : '255,255,255';
  return `${TOKENS}
html.orbit-x {
  ${vars}
  --o-top-h: 56px;
  --o-col-w: ${colW}px;
  --o-media-h: ${media};
  --o-gap: ${gap};
  --o-pad: ${pad};
  --o-like: ${dark ? '#ff5c8a' : '#e5245e'};
  --o-repost: ${dark ? '#34c38a' : '#11a36b'};
  --o-thread: color-mix(in srgb, var(--o-accent) 55%, var(--o-border-2));
  color-scheme: ${theme};
  background: var(--o-bg) !important;
}
html.orbit-x, html.orbit-x [data-theme], html.orbit-x .light-theme, html.orbit-x .dark-theme {
  --x-bg-primary: var(--o-bg) !important;
  --x-bg-secondary: var(--o-surface-2) !important;
  --x-bg-tertiary: var(--o-surface-3) !important;
  --x-bg-quaternary: var(--o-hover) !important;
  --x-bg-modal: var(--o-surface) !important;
  --x-bg-sheets: var(--o-surface) !important;
  --x-bg-inputs: var(--o-surface-2) !important;
  --x-modal-bg: var(--o-surface) !important;
  --x-fg-primary: var(--o-text) !important;
  --x-fg-secondary: var(--o-text-2) !important;
  --x-fg-tertiary: var(--o-text-3) !important;
  --x-fg-inverted: var(--o-bg) !important;
  --x-fg-brand: var(--o-accent) !important;
  --x-fg-on-brand: var(--o-accent-fg) !important;
  --x-border-normal: var(--o-border-2) !important;
  --x-border-divider: var(--o-border) !important;
  --x-border-hover: var(--o-border-2) !important;
  --x-border-active: var(--o-accent-line) !important;
  --x-border-media: var(--o-border) !important;
  --x-hover-subtle: var(--o-hover) !important;
  --x-hover-faint: var(--o-hover) !important;
  --x-overlay-normal: var(--o-scrim) !important;
  --x-overlay-strong: var(--o-scrim) !important;
  --x-shadow-popup: var(--o-shadow-pop) !important;
  --x-shadow-lg: var(--o-shadow-pop) !important;
  --x-btn-primary: var(--o-text) !important;
  --x-btn-primary-hover: color-mix(in srgb, var(--o-text) 86%, var(--o-bg)) !important;
  --x-btn-primary-pressed: color-mix(in srgb, var(--o-text) 76%, var(--o-bg)) !important;
  --x-btn-brand: var(--o-accent) !important;
  --x-btn-brand-hover: color-mix(in srgb, var(--o-accent) 88%, #000) !important;
  --x-btn-brand-pressed: color-mix(in srgb, var(--o-accent) 78%, #000) !important;
  --x-btn-ghost-hover: var(--o-hover) !important;
  --x-btn-ghost-pressed: var(--o-active) !important;
  --x-ring: var(--o-accent) !important;
  --x-font-sans: var(--o-font) !important;
  ${alphaRamp('--x-fg-alpha', fg)}
  ${alphaRamp('--x-bg-alpha', bgA)}
}
`;
}

export const ensureAdopted = () => page.adopt();

export function applyTheme(s: Settings) {
  document.documentElement.dataset.orbitTheme = resolveTheme(s.theme);
  page.set('base', build(s));
}

export function clearTheme() {
  page.clear();
  legacyRules.length = 0;
  seen = new WeakMap();
  delete document.documentElement.dataset.orbitTheme;
}

/** Docks a sticky header below Orbit's top bar. */
export const dockSticky = (el: HTMLElement, top: number) => page.dockSticky(el, top);

/* ---------- X's older client: atomic colour classes ---------- */

type Slot = 'bg' | 'surface' | 'surface3' | 'text' | 'text2' | 'border' | 'border2' | 'accent' | 'accentSoft' | 'scrim';
const COLOR_MAP: Record<string, Slot> = {
  // backgrounds: Lights out / Dim / Default
  'rgb(0, 0, 0)': 'bg', 'rgb(21, 32, 43)': 'bg', 'rgb(255, 255, 255)': 'bg',
  'rgb(22, 24, 28)': 'surface', 'rgb(30, 39, 50)': 'surface', 'rgb(247, 249, 249)': 'surface', 'rgb(32, 35, 39)': 'surface3', 'rgb(39, 51, 64)': 'surface3', 'rgb(239, 243, 244)': 'surface3',
  // text
  'rgb(231, 233, 234)': 'text', 'rgb(247, 249, 249)_text': 'text', 'rgb(15, 20, 25)': 'text',
  'rgb(113, 118, 123)': 'text2', 'rgb(139, 152, 165)': 'text2', 'rgb(83, 100, 113)': 'text2', 'rgb(83, 100, 113)_text': 'text2',
  // borders
  'rgb(47, 51, 54)': 'border', 'rgb(56, 68, 77)': 'border', 'rgb(207, 217, 222)': 'border2', 'rgb(51, 54, 57)': 'border2', 'rgb(66, 83, 100)': 'border2',
  // brand
  'rgb(29, 155, 240)': 'accent', 'rgba(29, 155, 240, 0.1)': 'accentSoft', 'rgba(29, 155, 240, 0.2)': 'accentSoft',
  'rgba(91, 112, 131, 0.4)': 'scrim', 'rgba(0, 0, 0, 0.4)': 'scrim', 'rgba(36, 45, 52, 0.25)': 'scrim',
};
const SLOT_VAR: Record<Slot, string> = {
  bg: 'var(--o-bg)', surface: 'var(--o-surface-2)', surface3: 'var(--o-surface-3)', text: 'var(--o-text)', text2: 'var(--o-text-2)',
  border: 'var(--o-border)', border2: 'var(--o-border-2)', accent: 'var(--o-accent)', accentSoft: 'var(--o-accent-soft)', scrim: 'var(--o-scrim)',
};
const PROPS: [string, 'bg' | 'text' | 'border'][] = [
  ['background-color', 'bg'], ['color', 'text'], ['border-color', 'border'], ['border-top-color', 'border'], ['border-bottom-color', 'border'],
  ['border-left-color', 'border'], ['border-right-color', 'border'], ['fill', 'text'],
];
let seen = new WeakMap<CSSStyleSheet, number>();
const legacyRules: string[] = [];

function slotFor(value: string, kind: 'bg' | 'text' | 'border'): Slot | undefined {
  const v = value.trim();
  if (kind === 'text') return COLOR_MAP[`${v}_text`] ?? (COLOR_MAP[v] && ['text', 'text2', 'accent'].includes(COLOR_MAP[v]) ? COLOR_MAP[v] : undefined);
  if (kind === 'border') return COLOR_MAP[v] && ['border', 'border2', 'surface3', 'accent'].includes(COLOR_MAP[v]) ? (COLOR_MAP[v] === 'surface3' ? 'border' : COLOR_MAP[v]) : undefined;
  const s = COLOR_MAP[v];
  return s && !['text', 'text2', 'border', 'border2'].includes(s) ? s : (v === 'rgb(247, 249, 249)' ? 'surface' : undefined);
}

/**
 * Scans X's react-native-web stylesheet for single-class colour rules and re-points them at Orbit tokens.
 * Incremental: only rules added since the last scan are read. No-op on X's current client.
 */
export function remapLegacy(): void {
  const el = document.getElementById('react-native-stylesheet') as HTMLStyleElement | null;
  const sh = el?.sheet;
  if (!sh) return;
  let rules: CSSRuleList;
  try { rules = sh.cssRules; } catch { return; }
  const from = seen.get(sh) ?? 0;
  if (rules.length === from) return;
  for (let i = from; i < rules.length; i++) {
    const r = rules[i];
    if (!(r instanceof CSSStyleRule) || !/^\.r-[a-z0-9]+$/.test(r.selectorText)) continue;
    const out: string[] = [];
    for (const [prop, kind] of PROPS) {
      const v = r.style.getPropertyValue(prop);
      if (!v) continue;
      const slot = slotFor(v, kind);
      if (slot) out.push(`${prop}:${SLOT_VAR[slot]}!important`);
    }
    if (/TwitterChirp/i.test(r.style.getPropertyValue('font-family'))) out.push('font-family:var(--o-font)!important');
    if (out.length) legacyRules.push(`html.orbit-x ${r.selectorText}{${out.join(';')}}`);
  }
  seen.set(sh, rules.length);
  page.set('legacy', legacyRules.join('\n'));
}
