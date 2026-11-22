import { useEffect, useRef, useState } from 'react';
import { Icon } from '@core/Icon';
import { largeMedia, navigateX } from '../dom';
import { getX, setX, useX } from '../store';
import type { ReadPost } from '../decorate';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Orbit's media viewer for X images: full-bleed, zoom & pan, keyboard, thumbnails, the post alongside. */
export function Lightbox() {
  const lb = useX((s) => s.lightbox)!;
  const [i, setI] = useState(lb.index);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const n = lb.images.length;
  const close = () => setX({ lightbox: null });
  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const step = (d: number) => { if (n > 1) { setI((v) => (v + d + n) % n); reset(); } };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const map: Record<string, () => void> = {
        Escape: close, ArrowRight: () => step(1), ArrowLeft: () => step(-1),
        '+': () => setZoom((z) => clamp(z + 0.5, 1, 6)), '=': () => setZoom((z) => clamp(z + 0.5, 1, 6)), '-': () => setZoom((z) => clamp(z - 0.5, 1, 6)), '0': reset,
      };
      if (map[e.key]) { e.preventDefault(); e.stopPropagation(); map[e.key](); }
    };
    document.addEventListener('keydown', k, true);
    return () => document.removeEventListener('keydown', k, true);
  }, [n]); // eslint-disable-line react-hooks/exhaustive-deps

  const src = lb.images[i] ? largeMedia(lb.images[i], 'large') : '';
  const post = lb.post;
  return (
    <div className="lightbox x-lightbox" role="dialog" aria-modal="true" aria-label="Media viewer">
      <div className="lb-top">
        <span className="t">{post ? <>{post.name} <span className="mute">@{post.author}</span></> : 'Media'}</span>
        {n > 1 && <span className="n">{i + 1} / {n}</span>}
        <button className="ibtn" onClick={() => setZoom((z) => clamp(z - 0.5, 1, 6))} aria-label="Zoom out" title="Zoom out (−)"><Icon name="minus" /></button>
        <button className="ibtn" onClick={() => setZoom((z) => clamp(z + 0.5, 1, 6))} aria-label="Zoom in" title="Zoom in (+)"><Icon name="plus" /></button>
        {src && <a className="ibtn" href={largeMedia(lb.images[i], 'orig')} target="_blank" rel="noopener noreferrer" aria-label="Open original" title="Open original"><Icon name="external" /></a>}
        {post?.permalink && <button className="ibtn" onClick={() => { close(); navigateX(post.permalink!); }} aria-label="Open post" title="Open post"><Icon name="comment" /></button>}
        <button className="ibtn" onClick={close} aria-label="Close" title="Close (Esc)"><Icon name="x" /></button>
      </div>
      <div className="lb-stage" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}
        onWheel={(e) => setZoom((z) => { const nz = clamp(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1, 6); if (nz === 1) setPan({ x: 0, y: 0 }); return nz; })}>
        {src && (
          <img src={src} alt={post?.text.slice(0, 120) ?? ''} referrerPolicy="no-referrer" draggable={false} className={zoom > 1 ? 'zoomed' : ''}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false }; }}
            onPointerMove={(e) => { const d = drag.current; if (!d || zoom === 1) return; d.moved = true; setPan({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y }); }}
            onPointerUp={() => { const d = drag.current; drag.current = null; if (d && !d.moved) { if (zoom > 1) reset(); else setZoom(2.5); } }} />
        )}
        {n > 1 && <>
          <button className="lb-nav l" onClick={() => step(-1)} aria-label="Previous"><Icon name="chev-left" size={22} /></button>
          <button className="lb-nav r" onClick={() => step(1)} aria-label="Next"><Icon name="chev-right" size={22} /></button>
        </>}
      </div>
      {post?.text && <div className="lb-cap">{post.text.length > 220 ? `${post.text.slice(0, 220)}…` : post.text}</div>}
      {n > 1 && <div className="lb-thumbs">{lb.images.map((u, k) => <button key={k} className={k === i ? 'on' : ''} onClick={() => { setI(k); reset(); }} aria-label={`Image ${k + 1}`}><img src={u} alt="" loading="lazy" referrerPolicy="no-referrer" /></button>)}</div>}
    </div>
  );
}

function when(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Thread reader: the author's whole thread as one calm, long-form article. */
export function Reader() {
  const r = useX((s) => s.reader)!;
  const ref = useRef<HTMLDivElement>(null);
  const close = () => setX({ reader: null });
  const first: ReadPost | undefined = r.posts[0];
  const words = r.posts.reduce((n, p) => n + p.text.split(/\s+/).filter(Boolean).length, 0);
  const mins = Math.max(1, Math.round(words / 220));

  useEffect(() => {
    ref.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
    document.addEventListener('keydown', k, true);
    return () => document.removeEventListener('keydown', k, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a[data-native]') as HTMLAnchorElement | null;
    if (!a) return;
    e.preventDefault();
    const native = a.getAttribute('data-native') ?? '';
    if (native.startsWith('/')) { close(); navigateX(native); } else window.open(a.href, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <div className="scrim" onPointerDown={close} />
      <div className="x-reader" role="dialog" aria-modal="true" aria-label="Thread reader" tabIndex={-1} ref={ref} onClick={onClick}>
        <header className="xr-head">
          {first?.avatar ? <img className="avatar lg round" src={first.avatar} alt="" referrerPolicy="no-referrer" /> : <span className="avatar lg round">{first?.author[0]?.toUpperCase()}</span>}
          <div className="grow">
            <b>{first?.name}</b>
            <span className="mute">@{first?.author} · {r.posts.length} {r.posts.length === 1 ? 'post' : 'posts'} · {mins} min read</span>
          </div>
          <button className="ibtn" onClick={close} aria-label="Close reader" title="Close (Esc)"><Icon name="x" /></button>
        </header>
        <article className="xr-body">
          {r.posts.map((p, k) => (
            <section key={k} className="xr-post">
              {p.html && <p dangerouslySetInnerHTML={{ __html: p.html }} />}
              {p.images.length > 0 && <div className={`xr-media n${Math.min(p.images.length, 4)}`}>{p.images.map((u, j) => (
                <button key={j} onClick={() => setX({ lightbox: { images: p.images, index: j, post: p }, reader: getX().reader })} aria-label={`Image ${j + 1}`}>
                  <img src={largeMedia(u)} alt="" loading="lazy" referrerPolicy="no-referrer" />
                </button>
              ))}</div>}
              <div className="xr-meta">
                <span className="tnum">{k + 1}/{r.posts.length}</span>
                {p.time && <span>{when(p.time)}</span>}
                {p.permalink && <a href={p.permalink} data-native={p.permalink}>Open post</a>}
              </div>
            </section>
          ))}
        </article>
      </div>
    </>
  );
}
