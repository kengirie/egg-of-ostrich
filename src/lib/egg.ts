import type { NostrEvent } from '@nostrify/nostrify';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import { getPow, minePow } from 'nostr-tools/nip13';
import { NAMED_SITE_KIND } from './nsite';

/**
 * Egg of Ostriches data model — no custom kinds.
 *
 * - A **nest** (question box) is a NIP-5A named site (kind 35128). Its address
 *   `35128:<owner>:<d>` is the NIP-22 root that every egg hangs from.
 * - An **egg** (question) is a top-level kind 1111 comment on the nest, signed
 *   by a throwaway key minted in the browser: fully anonymous, no login.
 * - A **hatch** (answer) is a kind 1111 reply to an egg, signed by the owner.
 * - **Cracked** (hidden) eggs are listed by the owner in a NIP-78 (kind 30078)
 *   app-data event, so visitors see the same cleaned-up nest.
 */

export const COMMENT_KIND = 1111;
export const APP_DATA_KIND = 30078;

/** `t` tag on nest manifests so an owner's nests can be told apart from other nsites. */
export const NEST_TAG = 'egg-of-ostriches';

/** Maximum egg (question) length in characters. */
export const EGG_MAX_LENGTH = 500;
/** Maximum hatch (answer) length in characters. */
export const HATCH_MAX_LENGTH = 2000;

/**
 * NIP-13 proof-of-work every anonymous egg must carry. Throwaway keys make
 * pubkey-based moderation useless, so a little CPU per egg is the spam brake.
 */
export const EGG_POW_DIFFICULTY = 12;

export interface Nest {
  pubkey: string;
  id: string;
  title: string;
  description: string;
  createdAt: number;
  event: NostrEvent;
}

export interface Hatch {
  id: string;
  content: string;
  createdAt: number;
}

export interface Egg {
  id: string;
  pubkey: string;
  content: string;
  createdAt: number;
  /** The owner's latest answer, if the egg has hatched. */
  hatch?: Hatch;
}

export function nestAddress(pubkey: string, id: string): string {
  return `${NAMED_SITE_KIND}:${pubkey}:${id}`;
}

export function crackedListId(nestId: string): string {
  return `${NEST_TAG}/cracked/${nestId}`;
}

function tagValue(event: NostrEvent, name: string): string | undefined {
  return event.tags.find(([n]) => n === name)?.[1];
}

/** Named-site `d` rule (NIP-5A): `^[a-z0-9-]{1,13}$`, not ending with '-'. */
export function isValidNestId(id: string): boolean {
  return /^[a-z0-9-]{1,13}$/.test(id) && !id.endsWith('-');
}

/** Parse a kind 35128 manifest into a nest. Returns null for anything malformed. */
export function parseNest(event: NostrEvent): Nest | null {
  if (event.kind !== NAMED_SITE_KIND) return null;
  const id = tagValue(event, 'd');
  if (!id || !isValidNestId(id)) return null;
  return {
    pubkey: event.pubkey,
    id,
    title: tagValue(event, 'title')?.trim() || id,
    description: tagValue(event, 'description')?.trim() ?? '',
    createdAt: event.created_at,
    event,
  };
}

export function isEggNest(event: NostrEvent): boolean {
  return event.tags.some(([n, v]) => n === 't' && v === NEST_TAG);
}

/** NIP-22 root + parent tags for a top-level egg on a nest. */
function eggTags(owner: string, nestId: string): string[][] {
  const address = nestAddress(owner, nestId);
  const kind = String(NAMED_SITE_KIND);
  return [
    ['A', address],
    ['K', kind],
    ['P', owner],
    ['a', address],
    ['k', kind],
    ['p', owner],
  ];
}

/**
 * Lay an anonymous egg: a kind 1111 comment on the nest, mined to
 * `EGG_POW_DIFFICULTY` and signed by a key that is thrown away immediately.
 * Pure (no network) so it can be tested; the caller publishes the result.
 */
export function layAnonymousEgg(opts: {
  owner: string;
  nestId: string;
  content: string;
  difficulty?: number;
}): NostrEvent {
  const content = opts.content.trim();
  if (!content) throw new Error('An egg needs something inside');
  if (content.length > EGG_MAX_LENGTH) throw new Error(`Eggs hold at most ${EGG_MAX_LENGTH} characters`);

  const secretKey = generateSecretKey();
  const mined = minePow(
    {
      pubkey: getPublicKey(secretKey),
      kind: COMMENT_KIND,
      content,
      tags: eggTags(opts.owner, opts.nestId),
      // minePow keeps created_at current while it searches.
      created_at: Math.floor(Date.now() / 1000),
    },
    opts.difficulty ?? EGG_POW_DIFFICULTY,
  );
  // finalizeEvent re-derives the same id from the mined tags/created_at.
  const event = finalizeEvent(
    { kind: mined.kind, content: mined.content, tags: mined.tags, created_at: mined.created_at },
    secretKey,
  );
  secretKey.fill(0);
  return event;
}

/** The owner's answer: a NIP-22 reply whose parent is the egg. */
export function buildHatchTemplate(opts: {
  owner: string;
  nestId: string;
  egg: Pick<Egg, 'id' | 'pubkey'>;
  content: string;
}): { kind: number; content: string; tags: string[][] } {
  const content = opts.content.trim();
  if (!content) throw new Error('An answer cannot be empty');
  if (content.length > HATCH_MAX_LENGTH) throw new Error(`Answers hold at most ${HATCH_MAX_LENGTH} characters`);
  const address = nestAddress(opts.owner, opts.nestId);
  return {
    kind: COMMENT_KIND,
    content,
    tags: [
      ['A', address],
      ['K', String(NAMED_SITE_KIND)],
      ['P', opts.owner],
      ['e', opts.egg.id, '', opts.egg.pubkey],
      ['k', String(COMMENT_KIND)],
      ['p', opts.egg.pubkey],
    ],
  };
}

/** NIP-78 list of eggs the owner cracked (hid). Replaces the previous list. */
export function buildCrackedTemplate(nestId: string, eggIds: string[]): {
  kind: number;
  content: string;
  tags: string[][];
} {
  return {
    kind: APP_DATA_KIND,
    content: '',
    tags: [
      ['d', crackedListId(nestId)],
      ...Array.from(new Set(eggIds)).map((id) => ['e', id]),
      ['alt', 'Egg of Ostriches: hidden questions'],
    ],
  };
}

export function parseCrackedIds(event: NostrEvent | undefined): Set<string> {
  if (!event) return new Set();
  return new Set(event.tags.filter(([n, v]) => n === 'e' && /^[0-9a-f]{64}$/.test(v ?? '')).map(([, v]) => v));
}

/**
 * Sort kind 1111 events under a nest into eggs with their hatches. Events are
 * user input: anything malformed is dropped rather than trusted.
 *
 * - Egg: root and parent both the nest, non-empty, carries enough PoW.
 * - Hatch: signed by the owner, root is the nest, parent is a known egg. The
 *   newest hatch wins, so an owner can re-answer.
 */
export function sortClutch(
  events: NostrEvent[],
  owner: string,
  nestId: string,
  opts: { cracked?: Set<string>; difficulty?: number } = {},
): Egg[] {
  const address = nestAddress(owner, nestId);
  const difficulty = opts.difficulty ?? EGG_POW_DIFFICULTY;
  const eggs = new Map<string, Egg>();
  const hatches: NostrEvent[] = [];

  for (const event of events) {
    if (event.kind !== COMMENT_KIND) continue;
    if (tagValue(event, 'A') !== address) continue;
    const parentKind = tagValue(event, 'k');

    if (parentKind === String(NAMED_SITE_KIND)) {
      const content = event.content.trim();
      if (!content || tagValue(event, 'a') !== address) continue;
      if (getPow(event.id) < difficulty) continue;
      if (opts.cracked?.has(event.id)) continue;
      eggs.set(event.id, {
        id: event.id,
        pubkey: event.pubkey,
        content: content.slice(0, EGG_MAX_LENGTH),
        createdAt: event.created_at,
      });
    } else if (parentKind === String(COMMENT_KIND) && event.pubkey === owner) {
      hatches.push(event);
    }
  }

  for (const event of hatches.sort((a, b) => a.created_at - b.created_at)) {
    const eggId = tagValue(event, 'e');
    const egg = eggId ? eggs.get(eggId) : undefined;
    const content = event.content.trim();
    if (!egg || !content) continue;
    egg.hatch = { id: event.id, content, createdAt: event.created_at };
  }

  return Array.from(eggs.values()).sort((a, b) => b.createdAt - a.createdAt);
}
