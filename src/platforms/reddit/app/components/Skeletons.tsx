import type { Layout } from '@core/settings';

export function PostSkeletons({ layout, n = 6 }: { layout: Layout; n?: number }) {
  if (layout === 'gallery') {
    return (
      <div className="masonry" aria-busy="true" aria-label="Loading">
        {[0, 1, 2].map((c) => (
          <div className="masonry-col" key={c}>
            {[0, 1, 2].map((i) => <div key={i} className="sk" style={{ height: 150 + (((c + 1) * (i + 2) * 47) % 160), borderRadius: 8 }} />)}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="list" aria-busy="true" aria-label="Loading posts">
      {Array.from({ length: n }, (_, i) => (
        <div className="sk-row" key={i} style={layout === 'minimal' ? { padding: '11px 16px' } : undefined}>
          {layout !== 'minimal' && <div className="sk" style={{ width: 26, height: 54, flex: 'none' }} />}
          <div style={{ flex: 1 }}>
            {layout !== 'minimal' && <div className="sk" style={{ width: '28%', height: 10, marginBottom: 10 }} />}
            <div className="sk" style={{ width: `${78 - (i % 3) * 14}%`, height: layout === 'minimal' ? 12 : 16 }} />
            {layout === 'comfortable' && i % 2 === 0 && <div className="sk" style={{ height: 200, marginTop: 12, borderRadius: 8 }} />}
            {layout === 'comfortable' && i % 2 === 1 && <><div className="sk" style={{ height: 10, marginTop: 10, width: '92%' }} /><div className="sk" style={{ height: 10, marginTop: 6, width: '64%' }} /></>}
          </div>
          {layout === 'compact' && <div className="sk" style={{ width: 84, height: 62, borderRadius: 7, flex: 'none' }} />}
        </div>
      ))}
    </div>
  );
}

export function ThreadSkeleton() {
  return (
    <>
      <div className="post-full" aria-busy="true">
        <div className="sk" style={{ width: '30%', height: 11, marginBottom: 16 }} />
        <div className="sk" style={{ width: '86%', height: 22, marginBottom: 10 }} />
        <div className="sk" style={{ width: '52%', height: 22, marginBottom: 16 }} />
        <div className="sk" style={{ height: 300, borderRadius: 8, marginBottom: 12 }} />
      </div>
      <div className="c-bar"><h2>Comments</h2></div>
      {Array.from({ length: 4 }, (_, i) => (
        <div className="thread" key={i}>
          <div className="sk" style={{ width: 150, height: 10, margin: '4px 0 12px 6px' }} />
          <div className="sk" style={{ width: '90%', height: 11, margin: '0 0 7px 26px' }} />
          <div className="sk" style={{ width: `${50 + i * 9}%`, height: 11, margin: '0 0 10px 26px' }} />
        </div>
      ))}
    </>
  );
}
