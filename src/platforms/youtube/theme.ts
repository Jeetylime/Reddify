import { resolveTheme } from '@core/settings';
import type { Settings } from '@core/settings';
import { PageSheet } from '@core/pageSheet';

/**
 * Page-level theming for YouTube (one adopted stylesheet, see core/pageSheet):
 *  - Orbit's tokens as `--o-*`;
 *  - YouTube's colour tokens (`--yt-spec-*` and the newer `--yt-sys-color-baseline--*`) re-pointed at Orbit's,
 *    so every YouTube surface — menus, dialogs, panels, Studio links — follows Orbit's palette;
 *  - sizing derived from settings (grid columns, watch width, recommendation layout).
 * Nothing inside the video player (`.ytp-*`) is themed: playback UI stays YouTube's.
 */

const page = new PageSheet('html.orbit-yt', 'html.orbit-yt-chrome');
const TOKENS = page.tokens();

const YT_MAP: [string[], string][] = [
  [['base-background', 'general-background-a'], 'var(--o-bg)'],
  [['raised-background', 'general-background-b', 'general-background-c', 'brand-background-solid', 'brand-background-primary', 'brand-background-secondary', 'snackbar-background'], 'var(--o-surface)'],
  [['menu-background'], 'var(--o-surface-2)'],
  [['text-primary', 'icon-active-other', 'wordmark-text'], 'var(--o-text)'],
  [['text-secondary', 'icon-inactive', 'text-primary-inverse-faded'], 'var(--o-text-2)'],
  [['text-disabled', 'icon-disabled'], 'var(--o-text-3)'],
  [['text-primary-inverse', 'call-to-action-inverse'], 'var(--o-bg)'],
  [['inverted-background'], 'var(--o-text)'],
  [['outline', '10-percent-layer'], 'var(--o-border-2)'],
  [['badge-chip-background', 'additive-background', 'touch-response', 'mono-tonal-hover', 'button-chip-background-hover'], 'var(--o-hover)'],
  [['mono-filled-hover'], 'color-mix(in srgb, var(--o-text) 86%, var(--o-bg))'],
  [['call-to-action', 'suggested-action', 'brand-icon-active', 'brand-link-text', 'themed-blue'], 'var(--o-accent)'],
  [['call-to-action-faded'], 'var(--o-accent-soft)'],
  [['filled-button-text', 'brand-button-text'], 'var(--o-accent-fg)'],
];

function ytVars(): string {
  const out: string[] = [];
  for (const [names, v] of YT_MAP) for (const n of names) {
    out.push(`--yt-spec-${n}:${v}!important;`);
    out.push(`--yt-sys-color-baseline--${n}:${v}!important;`);
  }
  return out.join('');
}

export interface GridMetrics { cols: number }

function build(s: Settings, grid: GridMetrics): string {
  const theme = resolveTheme(s.theme);
  const y = s.youtube;
  const gap = { cozy: 20, regular: 16, tight: 10 }[s.density];
  const player = { standard: '1280px', wide: '1720px', immersive: '100vw' }[y.watchWidth];
  return `${TOKENS}
html.orbit-yt {
  ${PageSheet.vars(s)}
  --o-top-h: 56px;
  --o-yt-cols: ${grid.cols};
  --o-yt-gap: ${gap}px;
  --o-yt-radius: ${y.grid === 'compact' ? 10 : 14}px;
  --o-like: ${theme === 'dark' ? '#ff5c8a' : '#e5245e'};
  color-scheme: ${theme};
  background: var(--o-bg) !important;
}
html.orbit-yt.orbit-yt-subbar { --o-top-h: 102px; }
html.orbit-yt, html.orbit-yt [dark], html.orbit-yt ytd-app, html.orbit-yt ytm-app { ${ytVars()} }
html.orbit-yt-chrome ytd-rich-grid-renderer {
  --ytd-rich-grid-items-per-row: var(--o-yt-cols) !important;
  --ytd-rich-grid-posts-per-row: var(--o-yt-cols) !important;
  --ytd-rich-grid-slim-items-per-row: calc(var(--o-yt-cols) + 2) !important;
  --ytd-rich-grid-item-margin: var(--o-yt-gap) !important;
  --ytd-rich-grid-item-max-width: none !important;
}
html.orbit-yt-chrome ytd-watch-flexy { --ytd-watch-flexy-max-player-width: ${player} !important; }
`;
}

export function applyTheme(s: Settings, grid: GridMetrics) {
  document.documentElement.dataset.orbitTheme = resolveTheme(s.theme);
  page.set('base', build(s, grid));
}

export function clearTheme() {
  page.clear();
  delete document.documentElement.dataset.orbitTheme;
}

export const ensureAdopted = () => page.adopt();

/** Columns that fit the grid width for the chosen thumbnail size and layout. */
export function columnsFor(width: number, s: Settings): number {
  const base = { small: 230, medium: 290, large: 370 }[s.youtube.thumbSize];
  const min = s.youtube.grid === 'compact' ? base * 0.78 : s.youtube.grid === 'editorial' ? base * 1.18 : base;
  const gap = { cozy: 20, regular: 16, tight: 10 }[s.density];
  return Math.max(1, Math.min(8, Math.floor((width + gap) / (min + gap))));
}
