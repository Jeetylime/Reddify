import { useEffect, useMemo, useState } from 'react';
import { FeedList } from '../components/FeedList';
import { CommunityHeader, useCommunity } from '../components/Headers';
import { fetchListing } from '../api/reddit';
import type { Item, Page } from '../api/types';
import { Paged, getPaged, usePaged } from '../state/paged';
import { visitSub } from '../state/store';
import { setRefresh } from '../state/actions';
import { navType } from '../lib/router';
import type { FeedRoute } from '../lib/router';

/** A cached listing for a route. Pushing a link loads fresh; Back/Forward restores from cache. */
export function useListing(key: string, fetcher: (after: string | null) => Promise<Page<Item>>) {
  const [nonce, setNonce] = useState(0);
  const paged = useMemo(
    () => getPaged<Item>(`${key}#${nonce}`, () => new Paged<Item>(fetcher, (i) => i.name), navType() === 'push' || nonce > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, nonce],
  );
  usePaged(paged);
  useEffect(() => { setRefresh(() => setNonce((n) => n + 1)); return () => setRefresh(null); }, []);
  return paged;
}

export function FeedView({ route }: { route: FeedRoute }) {
  const path = route.scope === 'home' ? `/${route.sort}.json` : `${route.base}/${route.sort}.json`;
  const paged = useListing(route.key, (after) => fetchListing(path, { t: route.t, after }));
  const { data: community } = useCommunity(route.sub);
  useEffect(() => { if (route.sub) visitSub(community?.name ?? route.sub, community?.icon); }, [route.sub, community?.name, community?.icon]);
  return (
    <>
      {route.sub && <CommunityHeader name={route.sub} />}
      <FeedList paged={paged} applyMutes={route.scope !== 'sub'} />
    </>
  );
}
