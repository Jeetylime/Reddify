import { useEffect, useRef, useState } from 'react';
import { Icon, Logo, PlatformIcon } from './Icon';
import { PLATFORMS, PLATFORM_ORDER, loadSpots, spotLabel, switchTo } from './platforms';
import type { PlatformId, Spots } from './platforms';

/**
 * The Orbit launcher: the logo in each platform's navigation opens a compact menu for jumping between
 * platforms. Identical on every site. Fully keyboard operable (Enter/Space/↓ to open, arrows/Home/End to
 * move, number keys to pick, Esc to close), with the current platform marked.
 */
/** Opens the switcher from a keyboard shortcut (⌥O on every platform). */
export const openSwitcher = () => window.dispatchEvent(new Event('orbit:switcher'));

export function PlatformSwitcher({ current, compact, remember, onSettings, homeHref }: {
  current: PlatformId;
  compact?: boolean;
  remember: boolean;
  onSettings: () => void;
  /** Where clicking the wordmark area goes when the menu is not wanted (middle-click / ⌘-click). */
  homeHref: string;
}) {
  const [open, setOpen] = useState(false);
  const [spots, setSpots] = useState<Spots>({});
  const [busy, setBusy] = useState<PlatformId | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLElement | null)[]>([]);

  const rows: { key: string; run: () => void }[] = [
    ...PLATFORM_ORDER.map((id) => ({ key: id, run: () => pick(id) })),
    { key: 'settings', run: () => { close(true); onSettings(); } },
  ];

  function close(focusTrigger: boolean) {
    setOpen(false);
    if (focusTrigger) trigger.current?.focus();
  }

  function pick(id: PlatformId) {
    if (id === current) { close(true); return; }
    setBusy(id);
    void switchTo(id, current, remember, document.title);
  }

  function focusAt(i: number) {
    const n = rows.length;
    items.current[((i % n) + n) % n]?.focus();
  }

  // Load remembered spots up front so the menu is complete the moment it opens.
  useEffect(() => { void loadSpots().then(setSpots); }, []);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener('orbit:switcher', show);
    return () => window.removeEventListener('orbit:switcher', show);
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadSpots().then(setSpots);
    // Focus the current platform first so Enter keeps you where you are.
    requestAnimationFrame(() => focusAt(Math.max(0, PLATFORM_ORDER.indexOf(current))));
    const down = (e: Event) => { if (wrap.current && !e.composedPath().includes(wrap.current)) setOpen(false); };
    document.addEventListener('pointerdown', down, true);
    return () => document.removeEventListener('pointerdown', down, true);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); setOpen(true); }
  };

  const onMenuKey = (e: React.KeyboardEvent) => {
    const i = items.current.findIndex((el) => el === (e.target as HTMLElement));
    const stop = () => { e.preventDefault(); e.stopPropagation(); };
    if (e.key === 'ArrowDown') { stop(); focusAt(i + 1); }
    else if (e.key === 'ArrowUp') { stop(); focusAt(i - 1); }
    else if (e.key === 'Home') { stop(); focusAt(0); }
    else if (e.key === 'End') { stop(); focusAt(rows.length - 1); }
    else if (e.key === 'Escape') { stop(); close(true); }
    else if (e.key === 'Tab') close(false);
    else if (/^[1-9]$/.test(e.key) && PLATFORM_ORDER[Number(e.key) - 1]) { stop(); pick(PLATFORM_ORDER[Number(e.key) - 1]); }
    else if (e.key === 'Enter' || e.key === ' ') { stop(); if (i >= 0) rows[i].run(); }
    else e.stopPropagation(); // keep the host site's single-key shortcuts out of the menu
  };

  return (
    <div className={`orb-switch ${compact ? 'compact' : ''}`} ref={wrap}>
      <button ref={trigger} type="button" className="orb-trigger" aria-haspopup="menu" aria-expanded={open} aria-label="Orbit — switch platform"
        title="Switch platform" onClick={(e) => { if (e.metaKey || e.ctrlKey) { window.open(homeHref, '_blank'); return; } setOpen((o) => !o); }} onKeyDown={onTriggerKey}>
        <Logo size={26} />
        <span className="orb-word">Orbit</span>
        <span className="orb-plat">{PLATFORMS[current].name}</span>
        <Icon name="chev-down" size={13} className="orb-chev" />
      </button>
      {open && (
        <div className="orb-menu" role="menu" aria-label="Switch platform" onKeyDown={onMenuKey}>
          <div className="orb-head" aria-hidden="true">
            <Logo size={18} />
            <b>ORBIT</b>
            <span>Platforms</span>
          </div>
          {PLATFORM_ORDER.map((id, i) => {
            const p = PLATFORMS[id];
            const active = id === current;
            const resume = remember && !active ? spotLabel(spots[id]) : undefined;
            return (
              <button key={id} ref={(el) => { items.current[i] = el; }} type="button" role="menuitemradio" aria-checked={active}
                className={`orb-item ${active ? 'on' : ''}`} onClick={() => pick(id)} data-platform={id}>
                <PlatformIcon id={id} size={30} />
                <span className="orb-text">
                  <b>{p.label}</b>
                  <small>{busy === id ? 'Opening…' : resume ? `Resume · ${resume}` : p.tagline}</small>
                </span>
                {active ? <span className="orb-dot" aria-hidden="true" /> : <kbd className="kbd">{i + 1}</kbd>}
              </button>
            );
          })}
          <div className="orb-sep" />
          <button ref={(el) => { items.current[PLATFORM_ORDER.length] = el; }} type="button" role="menuitem" className="orb-item small" onClick={rows[rows.length - 1].run}>
            <span className="orb-ic"><Icon name="settings" size={16} /></span>
            <span className="orb-text"><b>Orbit settings</b></span>
          </button>
        </div>
      )}
    </div>
  );
}
