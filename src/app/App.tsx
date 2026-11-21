import { useEffect, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { Rail } from './components/Headers';
import { BackToTop, Drawer, Help, Lightbox, Palette, Toasts } from './components/Overlays';
import { FeedView } from './views/FeedView';
import { PostView } from './views/PostView';
import { InboxView, SearchView, UserView } from './views/OtherViews';
import { Empty } from './lib/ui';
import { isInApp, isRedditHost, navigate } from './lib/router';
import type { Route } from './lib/router';
import { useRoute } from './lib/useRoute';
import { setState, useApp } from './state/store';
import { classic, setScroller } from './state/actions';
import { useKeyboard } from './state/keyboard';
import { resolveTheme, themeVars } from '../shared/settings';

function docTitle(r: Route | null): string {
  if (!r) return 'Reddit';
  switch (r.kind) {
    case 'feed': return r.title;
    case 'post': return r.sub ? `r/${r.sub}` : 'Post';
    case 'user': return `u/${r.name}`;
    case 'search': return r.q ? `Search · ${r.q}` : 'Search';
    case 'inbox': return 'Inbox';
  }
}

export function App() {
  const settings = useApp((s) => s.settings);
  const ready = useApp((s) => s.ready);
  const lightbox = useApp((s) => !!s.lightbox);
  const palette = useApp((s) => s.palette);
  const help = useApp((s) => s.help);
  const drawer = useApp((s) => s.drawer);
  const mobileNav = useApp((s) => s.mobileNav);
  const route = useRoute();
  useKeyboard();

  const theme = resolveTheme(settings.theme);
  const vars = useMemo(() => themeVars(settings), [settings]);

  useEffect(() => {
    if (settings.theme !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: light)');
    const on = () => setState((s) => ({ settings: { ...s.settings } }));
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [settings.theme]);

  useEffect(() => { document.documentElement.classList.toggle('reddify-light', theme === 'light'); }, [theme]);
  useEffect(() => { document.title = `Reddify · ${docTitle(route)}`; setState({ focused: null, mobileNav: false }); }, [route?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // One delegated handler turns every in-app link into a client-side navigation.
  const onClick = (e: React.MouseEvent) => {
    const el = e.target as HTMLElement;
    const spoiler = el.closest('.md-spoiler-text');
    if (spoiler && !spoiler.classList.contains('revealed')) { e.preventDefault(); spoiler.classList.add('revealed'); return; }
    if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const a = el.closest('a[href]') as HTMLAnchorElement | null;
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    let u: URL;
    try { u = new URL(a.getAttribute('href')!, location.href); } catch { return; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return;
    if (isInApp(u)) { e.preventDefault(); navigate(u.pathname + u.search + u.hash); return; }
    if (!isRedditHost(u.hostname) && settings.externalInNewTab) { e.preventDefault(); window.open(u.toString(), '_blank', 'noopener,noreferrer'); }
  };

  const gallery = settings.layout === 'gallery' && !!route && (route.kind === 'feed' || route.kind === 'user' || (route.kind === 'search' && route.type === 'link'));
  const showRail = !!route && !settings.hide.rail && !gallery && !settings.readingMode && route.kind !== 'inbox' && route.kind !== 'search';
  const h = settings.hide;
  const cls = ['root', settings.sidebarMode === 'compact' && 'sb-compact', settings.readingMode && 'reading', mobileNav && 'mobile-nav',
    h.flairs && 'h-flairs', h.subIcons && 'h-icons', h.domain && 'h-domain', h.awards && 'h-awards'].filter(Boolean).join(' ');

  let view: React.ReactNode = null;
  if (ready) {
    if (!route) view = <div className="list"><Empty icon="external" title="This page isn’t redesigned" text="Reddify doesn’t cover this part of Reddit." action={<button className="btn" onClick={classic}>Open classic Reddit</button>} /></div>;
    else if (route.kind === 'feed') view = <FeedView key={route.key} route={route} />;
    else if (route.kind === 'post') view = <PostView key={route.key} route={route} />;
    else if (route.kind === 'user') view = <UserView key={route.key} route={route} />;
    else if (route.kind === 'search') view = <SearchView key={route.key} route={route} />;
    else view = <InboxView key={route.key} route={route} />;
  }

  return (
    <div className={cls} data-theme={theme} style={vars as React.CSSProperties} onClick={onClick}>
      <div className="shell">
        <Sidebar />
        <div className="main">
          <TopBar />
          <main className="scroller" ref={setScroller} tabIndex={-1}>
            <div className={`page ${gallery ? 'wide' : ''}`}>
              <div className="col">{view}</div>
              {showRail && <Rail route={route!} />}
            </div>
          </main>
          <BackToTop />
        </div>
      </div>
      {mobileNav && <div className="scrim" style={{ zIndex: 45 }} onPointerDown={() => setState({ mobileNav: false })} />}
      {palette && <Palette />}
      {help && <Help />}
      {drawer && <Drawer />}
      {lightbox && <Lightbox />}
      <Toasts />
    </div>
  );
}
