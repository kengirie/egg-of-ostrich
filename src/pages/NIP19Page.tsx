import { nip19 } from 'nostr-tools';
import { Navigate, useParams } from 'react-router-dom';
import { NEST_ID, isAnswerSiteId } from '@/lib/egg';
import { NAMED_SITE_KIND } from '@/lib/nsite';
import NestPage from './NestPage';
import NotFound from './NotFound';

/**
 * `/<npub>` is that user's nest. `naddr` of a kind 35128 nest or answer site
 * redirects to the matching in-app page.
 */
export function NIP19Page() {
  const { nip19: identifier } = useParams<{ nip19: string }>();

  if (!identifier) {
    return <NotFound />;
  }

  let decoded;
  try {
    decoded = nip19.decode(identifier);
  } catch {
    return <NotFound />;
  }

  if (decoded.type === 'npub') {
    return <NestPage npub={identifier} />;
  }

  if (decoded.type === 'naddr' && decoded.data.kind === NAMED_SITE_KIND) {
    const npub = nip19.npubEncode(decoded.data.pubkey);
    const d = decoded.data.identifier;
    if (d === NEST_ID) return <Navigate to={`/${npub}`} replace />;
    if (isAnswerSiteId(d)) return <Navigate to={`/${npub}/${d}`} replace />;
  }

  return <NotFound />;
}
