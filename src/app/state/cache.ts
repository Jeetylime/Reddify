import { useEffect, useState } from 'react';

interface Entry { at: number; value?: unknown; error?: Error; pending?: Promise<void> }
const store = new Map<string, Entry>();

/** Small promise cache for one-off lookups (community about, rules, user profile). */
export function useCached<T>(key: string | null, fetcher: () => Promise<T>, ttl = 5 * 60_000): { data?: T; error?: Error } {
  const [, force] = useState(0);
  useEffect(() => {
    if (!key) return;
    const e = store.get(key);
    if (e?.pending || (e && !e.error && Date.now() - e.at < ttl)) {
      e?.pending?.then(() => force((n) => n + 1));
      return;
    }
    const pending = fetcher()
      .then((value) => { store.set(key, { at: Date.now(), value }); })
      .catch((error) => { store.set(key, { at: Date.now(), error: error as Error }); })
      .finally(() => force((n) => n + 1));
    store.set(key, { at: e?.at ?? 0, value: e?.value, pending });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const e = key ? store.get(key) : undefined;
  return { data: e?.value as T | undefined, error: e?.error };
}

export function invalidate(prefix: string) {
  for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k);
}
