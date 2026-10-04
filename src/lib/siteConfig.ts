import { pubkeyToBase36 } from './nsite';
import { NEST_ID, answerSiteId } from './egg';

/**
 * The nsite gateway used for every link we hand out (nest and answer sites).
 * nwb.tf caches manifests aggressively and has had outages, so the canonical
 * gateway is nsite.lol; the manifests and blobs live on relays and Blossom, so
 * any NIP-5A gateway can still open the same sites.
 */
export const GATEWAY_DOMAIN = 'nsite.lol';

/** Gateways a site may be opened on; the first one is canonical. */
export const APP_GATEWAYS = ['nsite.lol', 'nwb.tf'];

/** Extra relays the gateway ecosystem uses to look up user data (10063 etc.). */
export const LOOKUP_RELAYS = ['wss://user.kindpag.es/', 'wss://purplepag.es/'];

/** NIP-5A named-site URL: `https://<pubkeyB36><d>.<gateway>/`. */
export function namedSiteUrl(pubkeyHex: string, identifier: string, gateway = GATEWAY_DOMAIN): string {
  return `https://${pubkeyToBase36(pubkeyHex)}${identifier}.${gateway}/`;
}

/** The user's nest (question box) link. */
export function nestGatewayUrl(pubkeyHex: string, gateway = GATEWAY_DOMAIN): string {
  return namedSiteUrl(pubkeyHex, NEST_ID, gateway);
}

/** The answer site for `eggId` — the link in the kind 1 answer note. */
export function answerGatewayUrl(pubkeyHex: string, eggId: string, gateway = GATEWAY_DOMAIN): string {
  return namedSiteUrl(pubkeyHex, answerSiteId(eggId), gateway);
}

/**
 * Optional: the app itself deployed as a named nsite (identifier "ostrich") by
 * this hex pubkey. Only used as a fallback source of `site-assets.json` when the
 * running app is not a root-base build. Every nest and answer site ships its
 * own `site-assets.json`, so a nest can always be hatched from another site.
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

export type SiteTarget =
  | { kind: 'nest'; npub: string }
  | { kind: 'answer'; npub: string; eggId: string };

/**
 * When the app is served from a nest or answer site, the baked index.html tags
 * it with `<meta name="egg:npub">` (+ `<meta name="egg:answer">` = egg id on an
 * answer site) so the SPA opens the right page at "/". Meta tags (not an inline
 * script) keep `script-src 'self'` intact.
 */
export function getSiteTarget(): SiteTarget | null {
  if (typeof document === 'undefined') return null;
  const npub = document.querySelector('meta[name="egg:npub"]')?.getAttribute('content');
  if (!npub || !/^npub1[a-z0-9]+$/.test(npub)) return null;
  const eggId = document.querySelector('meta[name="egg:answer"]')?.getAttribute('content');
  if (eggId && /^[0-9a-f]{64}$/.test(eggId)) return { kind: 'answer', npub, eggId };
  return { kind: 'nest', npub };
}

/** On a nest/answer site "/" is taken, so the app home lives at /home. */
export function homePath(): string {
  return getSiteTarget() ? '/home' : '/';
}
