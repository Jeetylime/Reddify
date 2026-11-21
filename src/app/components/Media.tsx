import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import type { ImageSrc, MediaEmbed, MediaGallery, MediaVideo, Post } from '../api/types';
import { setState, useApp } from '../state/store';
import type { LightboxItem } from '../state/store';
import { clamp } from '../lib/format';
import { parseHTML } from '../lib/trusted';

const EMBED_HOSTS = /(^|\.)(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com|streamable\.com|clips\.twitch\.tv|player\.twitch\.tv|redgifs\.com|open\.spotify\.com|w\.soundcloud\.com|giphy\.com|imgur\.com|gfycat\.com)$/i;

export function embedSrc(m: MediaEmbed): string | null {
  let src: string | null | undefined;
  try { src = parseHTML(m.html).querySelector('iframe')?.getAttribute('src'); } catch { return null; }
  if (!src) return null;
  try {
    const u = new URL(src.startsWith('//') ? 'https:' + src : src);
    return u.protocol === 'https:' && EMBED_HOSTS.test(u.hostname) ? u.toString() : null;
  } catch { return null; }
}

export const openLightbox = (items: LightboxItem[], index = 0, title?: string) => setState({ lightbox: { items, index, title } });

/** Opens the most appropriate viewer for a post's media. Returns false if there is nothing to show. */
export function viewMedia(post: Post): boolean {
  const m = post.media;
  if (!m) return false;
  if (m.kind === 'image') openLightbox([{ url: m.src.url, w: m.src.w, h: m.src.h }], 0, post.title);
  else if (m.kind === 'gallery') openLightbox(m.items.map((x) => ({ url: x.src.url, w: x.src.w, h: x.src.h, caption: x.caption })), 0, post.title);
  else if (m.kind === 'video') setState({ lightbox: { items: [], index: 0, title: post.title, video: { url: m.url, audioUrl: m.audioUrl, poster: m.poster?.url, w: m.w, h: m.h, gif: m.gif } } });
  else if (m.kind === 'link' || m.kind === 'embed') window.open(post.url, '_blank', 'noopener,noreferrer');
  return true;
}

const ratio = (s?: { w: number; h: number }) => (s && s.w > 0 && s.h > 0 ? { aspectRatio: `${s.w} / ${s.h}` } : undefined);

/** Sizes a media box to its content so portrait media isn't letterboxed inside a full-width frame. */
function fit(s: { w: number; h: number } | undefined, full?: boolean, small?: boolean): React.CSSProperties | undefined {
  if (!s || !s.w || !s.h) return undefined;
  const maxH = full ? '76vh' : small ? '240px' : '540px';
  return { width: `min(100%, calc(${maxH} * ${(s.w / s.h).toFixed(4)}))` };
}

function Img({ src, alt = '', eager }: { src: ImageSrc; alt?: string; eager?: boolean }) {
  return <img src={src.url} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" style={ratio(src)} />;
}

function useReveal(post: Post) {
  const s = useApp((x) => x.settings);
  const [shown, setShown] = useState(false);
  const blocked = !shown && ((post.nsfw && s.blurNsfw) || (post.spoiler && s.blurSpoilers));
  return { blocked, label: post.nsfw ? 'NSFW' : 'Spoiler', reveal: (e: React.SyntheticEvent) => { e.stopPropagation(); setShown(true); } };
}

/** Plays Reddit's split DASH video+audio as one: muted <video> + synced <audio>. */
export function VideoPlayer({ m, autoplay, onExpand }: { m: MediaVideo; autoplay: boolean; onExpand?: () => void }) {
  const v = useRef<HTMLVideoElement>(null);
  const a = useRef<HTMLAudioElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [audioOk, setAudioOk] = useState(!!m.audioUrl);
  const [time, setTime] = useState({ cur: 0, dur: m.duration ?? 0 });
  const [failed, setFailed] = useState(false);

  const toggle = (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    const el = v.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => {}); else el.pause();
  };

  useEffect(() => {
    const vid = v.current, aud = a.current;
    if (!vid || !aud) return;
    const sync = () => { if (Math.abs(aud.currentTime - vid.currentTime) > 0.25) aud.currentTime = vid.currentTime; };
    const play = () => { sync(); if (!aud.muted) void aud.play().catch(() => {}); };
    const pause = () => aud.pause();
    vid.addEventListener('playing', play); vid.addEventListener('pause', pause); vid.addEventListener('waiting', pause); vid.addEventListener('seeked', sync);
    const id = window.setInterval(() => { if (!vid.paused) sync(); }, 1500);
    return () => { vid.removeEventListener('playing', play); vid.removeEventListener('pause', pause); vid.removeEventListener('waiting', pause); vid.removeEventListener('seeked', sync); window.clearInterval(id); };
  }, []);

  useEffect(() => {
    const aud = a.current;
    if (!aud) return;
    aud.muted = muted;
    if (!muted && v.current && !v.current.paused) { aud.currentTime = v.current.currentTime; void aud.play().catch(() => {}); }
  }, [muted]);

  useEffect(() => {
    if (!box.current || !(autoplay || m.gif)) return;
    const io = new IntersectionObserver(([e]) => {
      const el = v.current; if (!el) return;
      if (e.intersectionRatio >= 0.6) void el.play().catch(() => {}); else if (e.intersectionRatio < 0.2) el.pause();
    }, { threshold: [0, 0.2, 0.6] });
    io.observe(box.current);
    return () => io.disconnect();
  }, [autoplay, m.gif]);

  const fmt = (n: number) => (Number.isFinite(n) ? `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}` : '0:00');
  const pct = time.dur ? (time.cur / time.dur) * 100 : 0;
  return (
    <div ref={box} className={`video ${playing ? '' : 'paused'}`} style={ratio({ w: m.w, h: m.h })} onClick={toggle}>
      <video ref={v} src={m.url} poster={m.poster?.url} loop={m.gif} muted playsInline preload={autoplay || m.gif ? 'metadata' : 'none'}
        onError={() => setFailed(true)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime({ cur: e.currentTarget.currentTime, dur: e.currentTarget.duration || m.duration || 0 })} />
      {m.audioUrl && <audio ref={a} src={audioOk ? m.audioUrl : undefined} preload="none" muted onError={() => setAudioOk(false)} />}
      {failed && <div className="veil" onClick={(e) => e.stopPropagation()}><span className="pill-btn"><Icon name="alert" size={15} />Video unavailable</span></div>}
      {!playing && !m.gif && !failed && <span className="play-big" aria-hidden="true"><Icon name="play" size={22} fill /></span>}
      {m.gif && <span className="m-badge">GIF</span>}
      {!m.gif && !failed && (
        <div className="v-ctl" onClick={(e) => e.stopPropagation()}>
          <button onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}><Icon name={playing ? 'pause' : 'play'} size={16} fill={!playing} /></button>
          <div className="v-bar" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); if (v.current && time.dur) v.current.currentTime = clamp((e.clientX - r.left) / r.width, 0, 1) * time.dur; }}>
            <span><i style={{ width: `${pct}%` }} /></span>
          </div>
          <span className="v-time">{fmt(time.cur)} / {fmt(time.dur)}</span>
          <button onClick={() => setMuted((x) => !x)} disabled={!m.audioUrl || !audioOk} aria-label={muted ? 'Unmute' : 'Mute'} title={m.audioUrl && audioOk ? (muted ? 'Unmute' : 'Mute') : 'No audio track'}>
            <Icon name={muted || !m.audioUrl || !audioOk ? 'mute' : 'volume'} size={16} />
          </button>
          {onExpand && <button onClick={() => { v.current?.pause(); onExpand(); }} aria-label="Theater view"><Icon name="maximize" size={15} /></button>}
        </div>
      )}
    </div>
  );
}

function Gallery({ post, m, full, cls }: { post: Post; m: MediaGallery; full?: boolean; cls: string }) {
  const [i, setI] = useState(0);
  const items = useMemo(() => m.items.map((x) => ({ url: x.src.url, w: x.src.w, h: x.src.h, caption: x.caption })), [m]);
  const open = (idx: number) => (e: React.SyntheticEvent) => { e.stopPropagation(); openLightbox(items, idx, post.title); };
  if (full) {
    const cur = m.items[i];
    const go = (d: number) => (e: React.SyntheticEvent) => { e.stopPropagation(); setI((i + d + m.items.length) % m.items.length); };
    // Reserve the tallest aspect ratio so the page doesn't jump while flipping through.
    const maxRatio = Math.max(...m.items.map((x) => (x.src.w ? x.src.h / x.src.w : 0.75)));
    return (
      <div className="media zoomable">
        <div onClick={open(i)} style={{ aspectRatio: `1 / ${Math.min(maxRatio, 1.3)}`, maxHeight: '76vh', display: 'grid', placeItems: 'center', margin: '0 auto' }}>
          <img src={(cur.preview ?? cur.src).url} alt={cur.caption ?? ''} referrerPolicy="no-referrer" style={{ maxHeight: '76vh', height: '100%', width: '100%', objectFit: 'contain' }} />
        </div>
        {m.items.length > 1 && <>
          <button className="carousel-nav l" onClick={go(-1)} aria-label="Previous image"><Icon name="chev-left" size={18} /></button>
          <button className="carousel-nav r" onClick={go(1)} aria-label="Next image"><Icon name="chev-right" size={18} /></button>
          <span className="m-badge" style={{ left: 'auto', right: 8, top: 8, bottom: 'auto' }}>{i + 1} / {m.items.length}</span>
          {m.items.length <= 12 && <div className="dots">{m.items.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>}
        </>}
        {cur.caption && <div className="caption">{cur.caption}</div>}
      </div>
    );
  }
  const shown = m.items.slice(0, 3);
  return (
    <div className={`media ${cls}`}>
      <div className={`strip n${shown.length}`}>
        {shown.map((x, k) => (
          <div key={k} className={k === 2 && m.items.length > 3 ? 'more' : ''} data-more={`+${m.items.length - 3}`} onClick={open(k)} style={shown.length === 1 ? ratio(x.src) : undefined}>
            <Img src={x.preview ?? x.src} />
          </div>
        ))}
      </div>
      <span className="m-badge"><Icon name="layers" size={13} />{m.items.length}</span>
    </div>
  );
}

export function PostMedia({ post, full }: { post: Post; full?: boolean }) {
  const settings = useApp((s) => s.settings);
  const gate = useReveal(post);
  const [embedOn, setEmbedOn] = useState(!!full);
  const m = post.media;
  if (!m) return null;
  const cls = settings.compactMedia && !full ? 'small' : '';

  if (m.kind === 'link') {
    return (
      <a className="link-card" href={m.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
        {m.preview && !post.nsfw ? <img src={m.preview.url} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="lc-ph"><Icon name="link" size={20} /></span>}
        <div className="grow">
          <div className="lc-d"><Icon name="globe" size={12} />{m.domain}</div>
          <div className="lc-u">{m.url.replace(/^https?:\/\/(www\.)?/, '')}</div>
        </div>
        <Icon name="external" size={15} />
      </a>
    );
  }
  if (gate.blocked) {
    const poster = m.kind === 'image' ? (m.preview ?? m.src) : m.kind === 'gallery' ? (m.items[0].preview ?? m.items[0].src) : m.poster;
    return (
      <div className={`media ${cls}`} style={{ ...(ratio(poster) ?? { aspectRatio: '16 / 9' }), maxHeight: 420 }}>
        {poster && <img className="blurred" src={poster.url} alt="" referrerPolicy="no-referrer" loading="lazy" style={{ height: '100%', objectFit: 'cover' }} />}
        <div className="veil" onClick={gate.reveal}><span className="pill-btn"><Icon name="eye" size={16} />{gate.label} · Click to reveal</span></div>
      </div>
    );
  }
  if (m.kind === 'image') {
    return (
      <div className={`media zoomable ${cls}`} style={fit(m.src, full, !!cls)} onClick={(e) => { e.stopPropagation(); openLightbox([{ url: m.src.url, w: m.src.w, h: m.src.h }], 0, post.title); }}>
        <Img src={full ? m.src : (m.preview ?? m.src)} alt={post.title} eager={full} />
        <span className="m-zoom"><Icon name="maximize" size={14} /></span>
      </div>
    );
  }
  if (m.kind === 'gallery') return <Gallery post={post} m={m} full={full} cls={cls} />;
  if (m.kind === 'video') {
    return <div className={`media ${cls}`} style={fit(m, full, !!cls)}><VideoPlayer m={m} autoplay={settings.autoplayVideo} onExpand={() => viewMedia(post)} /></div>;
  }
  const src = embedSrc(m);
  if (!src) {
    return <a className="link-card" href={post.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}><span className="lc-ph"><Icon name="play" size={20} /></span><div className="grow"><div className="lc-d">{m.provider ?? post.domain}</div><div className="lc-u">{post.url}</div></div><Icon name="external" size={15} /></a>;
  }
  if (!embedOn) {
    return (
      <div className={`media ${cls}`} style={{ aspectRatio: '16 / 9', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setEmbedOn(true); }}>
        {m.poster && <img src={m.poster.url} alt="" loading="lazy" referrerPolicy="no-referrer" style={{ height: '100%', objectFit: 'cover' }} />}
        <span className="play-big"><Icon name="play" size={22} fill /></span>
        <span className="m-badge">{m.provider ?? 'Video'}</span>
      </div>
    );
  }
  return (
    <div className={`media embed ${cls}`} style={{ aspectRatio: `${m.w || 16} / ${m.h || 9}`, maxHeight: '76vh' }} onClick={(e) => e.stopPropagation()}>
      <iframe src={src} title={post.title} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" />
    </div>
  );
}

export function thumbOf(p: Post): string | undefined {
  const m = p.media;
  if (m?.kind === 'image') return (m.preview ?? m.src).url;
  if (m?.kind === 'gallery') return (m.items[0].preview ?? m.items[0].src).url;
  if (m?.kind === 'video' || m?.kind === 'embed') return m.poster?.url ?? p.thumb;
  if (m?.kind === 'link') return m.preview?.url ?? p.thumb;
  return p.thumb;
}
