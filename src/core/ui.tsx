import { useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';

/** Small UI primitives shared by every Orbit platform UI. */

/** Closes something when clicking outside `ref` or pressing Escape (shadow-DOM aware). */
export function useDismiss(ref: RefObject<HTMLElement>, onClose: () => void, active: boolean) {
  const cb = useRef(onClose);
  cb.current = onClose;
  useEffect(() => {
    if (!active) return;
    const down = (e: Event) => { if (ref.current && !e.composedPath().includes(ref.current)) cb.current(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); cb.current(); } };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('pointerdown', down, true); document.removeEventListener('keydown', key, true); };
  }, [active, ref]);
}

/** Trigger button + popover menu. */
export function Menu({ button, buttonClass = 'ibtn', label, align = 'right', up, children }: {
  button: ReactNode; buttonClass?: string; label: string; align?: 'left' | 'right'; up?: boolean; children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, () => setOpen(false), open);
  return (
    <div className="pop-wrap" ref={ref}>
      <button type="button" className={buttonClass} title={label} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{button}</button>
      {open && <div className={`pop ${align} ${up ? 'up' : ''}`} role="menu">{children(() => setOpen(false))}</div>}
    </div>
  );
}

export function MenuItem({ icon, label, onClick, href, checked, hint }: { icon?: IconName; label: ReactNode; onClick?: () => void; href?: string; checked?: boolean; hint?: string }) {
  const inner = <>{icon && <Icon name={icon} size={16} />}<span>{label}</span>{checked && <Icon name="check" size={15} className="check" />}{hint && <span className="hint">{hint}</span>}</>;
  if (href) return <a className={`pop-item ${checked ? 'on' : ''}`} role="menuitem" href={href} onClick={onClick}>{inner}</a>;
  return <button className={`pop-item ${checked ? 'on' : ''}`} role="menuitem" onClick={onClick}>{inner}</button>;
}

export const Kbd = ({ children }: { children: ReactNode }) => <kbd className="kbd">{children}</kbd>;
