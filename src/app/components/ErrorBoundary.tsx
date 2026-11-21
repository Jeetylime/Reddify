import { Component } from 'react';
import type { ReactNode } from 'react';

/** Keeps one broken view from blanking the whole app; shows what went wrong and a way out. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string; full?: boolean }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('[Reddify] render error:', error); }
  componentDidUpdate(prev: { resetKey?: string }) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const box: React.CSSProperties = this.props.full
      ? { position: 'fixed', inset: 0, zIndex: 2147483000, background: '#121316', color: '#ebecf0', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif' }
      : {};
    return (
      <div style={box}>
        <div className="state err" style={{ maxWidth: 520, textAlign: 'center', padding: 40 }}>
          <h3 style={{ margin: '0 0 8px' }}>Reddify hit a problem showing this page</h3>
          <p style={{ opacity: 0.75, fontSize: 13 }}>{String(error.message || error)}</p>
          <p>
            <button className="btn" onClick={() => location.reload()} style={{ marginRight: 8 }}>Reload</button>
            <button className="btn primary" onClick={() => window.dispatchEvent(new Event('reddify:classic'))}>Open classic Reddit</button>
          </p>
        </div>
      </div>
    );
  }
}
