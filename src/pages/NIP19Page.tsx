import { nip19 } from 'nostr-tools';
import { Navigate, useParams } from 'react-router-dom';
import { isValidNestId } from '@/lib/egg';
import { NAMED_SITE_KIND } from '@/lib/nsite';
import NotFound from './NotFound';

/** Only nests are addressable here: `naddr` of a kind 35128 → /<npub>/<nest-id>. */
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

  if (decoded.type === 'naddr' && decoded.data.kind === NAMED_SITE_KIND && isValidNestId(decoded.data.identifier)) {
    return <Navigate to={`/${nip19.npubEncode(decoded.data.pubkey)}/${decoded.data.identifier}`} replace />;
  }

  return <NotFound />;
}
