import { useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Icon } from '../components/Icon';
import type { IconName } from '../components/Icon';
import { colorFor } from './format';
import { getScroller } from '../state/actions';
import type { Flair } from '../api/types';

export function Avatar({ name, src, size = '', round }: { name: string; src?: string; size?: 'xs' | 'md' | 'lg' | ''; round?: boolean }) {
  const [bad, setBad] = useState(false);
  const cls = `avatar ${size} ${round ? 'round' : ''}`;
  if (src && !bad) return <img className={cls} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} />;
  return <span className={cls} style={{ background: colorFor(name) }} aria-hidden="true">{name.replace(/^[ru]\//i, '').charAt(0).toUpperCase()}</span>;
}

export function FlairChip({ flair }: { flair?: Flair }) {
  if (!flair) return null;
  return (
    <span className={`flair ${flair.fg ?? ''}`} style={flair.bg ? { background: flair.bg } : undefined} title={flair.text}>
      {flair.emojis?.map((e, i) => <img key={i} src={e.u} alt={e.e} referrerPolicy="no-referrer" />)}
      {flair.text}
    </span>
  );
}

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

export function Empty({ icon = 'info', title, text, action }: { icon?: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="state">
      <div className="state-ic"><Icon name={icon} size={22} /></div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state err" role="alert">
      <div className="state-ic"><Icon name="alert" size={22} /></div>
      <h3>Couldn’t load this</h3>
      <p>{message}</p>
      {onRetry && <button className="btn" onClick={onRetry}><Icon name="refresh" size={15} />Try again</button>}
    </div>
  );
}

export const Kbd = ({ children }: { children: ReactNode }) => <kbd className="kbd">{children}</kbd>;
export const Spinner = () => <span className="spin" role="status" aria-label="Loading" />;

/** Fires `cb` when the returned sentinel element comes within ~1.5 screens of the viewport. */
export function useSentinel(cb: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const fn = useRef(cb);
  fn.current = cb;
  useEffect(() => {
    if (!enabled || !ref.current) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) fn.current(); }, { root: getScroller(), rootMargin: '1200px 0px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [enabled]);
  return ref;
}
