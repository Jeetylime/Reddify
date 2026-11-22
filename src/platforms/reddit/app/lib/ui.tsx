import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '@core/Icon';
export { Kbd, Menu, MenuItem, useDismiss } from '@core/ui';
import type { IconName } from '@core/Icon';
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

export function ErrorState({ message, onRetry, detail }: { message: string; onRetry?: () => void; detail?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="state err" role="alert">
      <div className="state-ic"><Icon name="alert" size={22} /></div>
      <h3>Couldn’t load this</h3>
      <p>{message}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        {onRetry && <button className="btn" onClick={onRetry}><Icon name="refresh" size={15} />Try again</button>}
        {detail && <button className="btn ghost" onClick={() => setOpen((v) => !v)}>{open ? 'Hide details' : 'Show details'}</button>}
      </div>
      {open && detail && (
        <pre style={{ marginTop: 14, maxWidth: '100%', whiteSpace: 'pre-wrap', wordBreak: 'break-all', textAlign: 'left', fontSize: 11.5, lineHeight: 1.5, padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-2)', userSelect: 'text' }}>{detail}</pre>
      )}
    </div>
  );
}

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
