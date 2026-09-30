import { pubkeyToBase36 } from './nsite';

/**
 * The nsite gateway that serves published nests (question boxes). A dumb pipe:
 * any NIP-5A-compatible gateway can be swapped in here without republishing —
 * the manifests and blobs live on relays and Blossom servers.
 */
export const GATEWAY_DOMAIN = 'nwb.tf';

/** Gateways a nest link may be opened on; the first one is canonical. */
export const APP_GATEWAYS = ['nwb.tf', 'nsite.lol'];

/** Extra relays the gateway ecosystem uses to look up user data (10063 etc.). */
export const LOOKUP_RELAYS = ['wss://user.kindpag.es/', 'wss://purplepag.es/'];

/**
 * Canonical NIP-5A named-site URL of a nest: `<pubkeyB36><d>.<gateway>`. The
 * nest IS the named site (kind 35128); eggs are kind 1111 comments on it.
 */
export function nestGatewayUrl(pubkeyHex: string, nestId: string, gateway = GATEWAY_DOMAIN): string {
  return `https://${pubkeyToBase36(pubkeyHex)}${nestId}.${gateway}/`;
}

/**
 * Optional: the app itself deployed as a named nsite (identifier "ostrich") by
 * this hex pubkey. Only used as a fallback source of `site-assets.json` when the
 * running app is not a root-base build. Every nest site ships its own
 * `site-assets.json`, so a nest can always be hatched from another nest.
 */
export const APP_NSITE_ID = 'ostrich';

export function appNsitePubkey(): string | undefined {
  const value = import.meta.env.VITE_APP_NSITE_PUBKEY;
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value) ? value : undefined;
}

/** Absolute URL of a path on the canonical app nsite, or undefined if not configured. */
export function appNsiteUrl(gateway: string, path: string): string | undefined {
  const pubkey = appNsitePubkey();
  if (!pubkey) return undefined;
  return `https://${pubkeyToBase36(pubkey)}${APP_NSITE_ID}.${gateway}${path}`;
}

export interface NestSiteTarget {
  npub: string;
  nestId: string;
}

/**
 * When the app is served from a nest's own nsite, its baked index.html tags the
 * nest via `<meta name="egg:npub|egg:id">` so the SPA opens that nest at "/".
 * Meta tags (not an inline script) keep `script-src 'self'` intact.
 */
export function getNestSiteTarget(): NestSiteTarget | null {
  if (typeof document === 'undefined') return null;
  const npub = document.querySelector('meta[name="egg:npub"]')?.getAttribute('content');
  const nestId = document.querySelector('meta[name="egg:id"]')?.getAttribute('content');
  if (npub && nestId) return { npub, nestId };
  return null;
}

/** On a nest's own site "/" is the nest, so the app home lives at /home. */
export function homePath(): string {
  return getNestSiteTarget() ? '/home' : '/';
}
