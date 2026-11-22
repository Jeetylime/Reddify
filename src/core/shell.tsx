import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ReactNode } from 'react';
import type { Root } from 'react-dom/client';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { Kbd, useDismiss } from './ui';
import tokens from './tokens.css';
import components from './components.css';
import chromeCss from './chrome.css';
import shellCss from './shell.css';

/**
 * The Orbit shell shared by every platform that layers Orbit over a live site (X, YouTube): the Shadow DOM
 * host, the command palette, the shortcuts sheet and toasts. Reddit renders its own full app but uses the
 * same CSS components and the same switcher.
 */

/* ---------- chrome host ---------- */

export interface ChromeHost { unmount: () => void }

/** Mounts a React tree in a Shadow DOM attached to <html> (outside the site's own app and its hydration). */
export function mountChromeHost(id: string, node: ReactNode, css: string): ChromeHost {
  const host = document.createElement('div');
  host.id = id;
  for (const [k, v] of [['display', 'block'], ['visibility', 'visible'], ['opacity', '1']]) host.style.setProperty(k, v, 'important');
  const shadow = host.attachShadow({ mode: 'open' });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`${tokens}\n${components}\n${chromeCss}\n${shellCss}\n${css}`);
  shadow.adoptedStyleSheets = [sheet];
  const container = document.createElement('div');
  shadow.appendChild(container);
  document.documentElement.appendChild(host);
  const root: Root = createRoot(container);
  root.render(node);
  // Sites occasionally rebuild <html>'s children; put the host back if it gets removed.
  const keeper = new MutationObserver(() => { if (!host.isConnected) document.documentElement.appendChild(host); });
  keeper.observe(document.documentElement, { childList: true });
  return {
    unmount() {
      keeper.disconnect();
      try { root.unmount(); } catch { /* already gone */ }
      host.remove();
    },
  };
}

/* ---------- command palette ---------- */

export interface PaletteRow { id: string; group: string; label: string; icon: IconName; hint?: string; keywords?: string; run: () => void }

export function Palette({ rows: all, onClose, placeholder, footer, search }: {
  rows: PaletteRow[];
  onClose: () => void;
  placeholder: string;
  footer: ReactNode;
  /** Extra row for free text ("Search YouTube for …"). */
  search?: (q: string) => PaletteRow | null;
}) {
  const [q, setQ] = useState('');
  const [hl, setHl] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const hits = t ? all.filter((r) => `${r.label} ${r.keywords ?? ''}`.toLowerCase().includes(t)) : all;
    const extra = q.trim() && search ? search(q.trim()) : null;
    return extra ? [...hits, extra] : hits;
  }, [q, all, search]);
  useEffect(() => setHl(0), [q]);
  useEffect(() => { list.current?.querySelector('.pal-row.hl')?.scrollIntoView({ block: 'nearest' }); }, [hl]);
  const run = (r: PaletteRow | undefined) => { if (!r) return; onClose(); r.run(); };
  const onKey = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    const n = rows.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHl((h) => (h + 1) % n); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHl((h) => (h - 1 + n) % n); }
    else if (e.key === 'Enter') { e.preventDefault(); run(rows[hl]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };
  return (
    <>
      <div className="scrim" onPointerDown={onClose} />
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="pal-in"><Icon name="search" size={18} /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder={placeholder} aria-label="Command palette" /><Kbd>esc</Kbd></div>
        <div className="pal-list" ref={list} role="listbox">
          {rows.map((r, i) => (
            <div key={r.id}>
              {(i === 0 || rows[i - 1].group !== r.group) && <div className="pal-group">{r.group}</div>}
              <button className={`pal-row ${i === hl ? 'hl' : ''}`} role="option" aria-selected={i === hl} onMouseMove={() => i !== hl && setHl(i)} onClick={() => run(r)}>
                <Icon name={r.icon} size={17} /><span className="lbl">{r.label}</span>{r.hint && <span className="hint">{r.hint}</span>}<span className="enter"><Kbd>↵</Kbd></span>
              </button>
            </div>
          ))}
        </div>
        <div className="pal-foot"><span><Kbd>↑</Kbd><Kbd>↓</Kbd>navigate</span><span><Kbd>↵</Kbd>open</span><span style={{ marginLeft: 'auto' }}>{footer}</span></div>
      </div>
    </>
  );
}

/* ---------- shortcuts sheet ---------- */

export function HelpSheet({ groups, onClose }: { groups: [string, [string, string[]][]][]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, onClose, true);
  return (
    <>
      <div className="scrim" />
      <div className="help" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" ref={ref}>
        <div className="help-h"><h2>Keyboard shortcuts</h2><button className="ibtn" onClick={onClose} aria-label="Close"><Icon name="x" /></button></div>
        <div className="help-grid">
          {groups.map(([g, items]) => (
            <div className="help-group" key={g}><h4>{g}</h4>
              {items.map(([label, keys]) => <div className="help-row" key={label}><span>{label}</span><span className="keys">{keys.map((k, i) => <Kbd key={i}>{k}</Kbd>)}</span></div>)}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------- toasts ---------- */

export interface ToastItem { id: number; text: string; kind: 'info' | 'success' | 'error' }

export function ToastStack({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`} role="status"><Icon name={t.kind === 'success' ? 'check' : t.kind === 'error' ? 'alert' : 'info'} size={16} /><span>{t.text}</span></div>)}
    </div>
  );
}
