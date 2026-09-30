import type { RelayMetadata } from '@/contexts/AppContext';

/**
 * The app's fixed relay set (Rostrum's approach) — used for every read and
 * write, for logged-out and logged-in users alike, and deliberately NOT
 * overridden by a user's NIP-65. Nests, eggs and hatches are scoped to this
 * app, so pinning read and write to the same relays keeps "where an egg was
 * thrown" and "where the nest owner reads it" structurally identical.
 */
export const APP_RELAYS: RelayMetadata = {
  relays: [
    { url: 'wss://nos.lol/', read: true, write: true },
    { url: 'wss://nostr.mom/', read: true, write: true },
    { url: 'wss://relay.ditto.pub/', read: true, write: true },
    { url: 'wss://relay.dreamith.to/', read: true, write: true },
  ],
  updatedAt: 0,
};

/**
 * Read-only aggregators for user metadata. Only queried for profile-ish kinds:
 * they answer everything else with an instant empty EOSE, which would make the
 * pool's EOSE timeout cut off slower relays that actually hold the eggs.
 */
export const PROFILE_RELAYS = ['wss://purplepag.es/'];
export const PROFILE_KINDS = new Set([0, 3, 10002, 10063]);
