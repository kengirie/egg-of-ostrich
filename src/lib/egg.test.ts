import { describe, expect, it } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent } from 'nostr-tools';
import { getPow } from 'nostr-tools/nip13';
import {
  buildCrackedTemplate,
  buildHatchTemplate,
  isValidNestId,
  layAnonymousEgg,
  nestAddress,
  parseCrackedIds,
  parseNest,
  sortClutch,
} from './egg';

const ownerKey = generateSecretKey();
const OWNER = getPublicKey(ownerKey);
const NEST = 'ask-me';

function sign(template: { kind: number; content: string; tags: string[][] }, key = ownerKey, t = 1000): NostrEvent {
  return finalizeEvent({ ...template, created_at: t }, key);
}

describe('layAnonymousEgg', () => {
  it('produces a valid, PoW-mined, top-level NIP-22 comment on the nest', () => {
    const egg = layAnonymousEgg({ owner: OWNER, nestId: NEST, content: '  好きな卵料理は？ ', difficulty: 8 });
    expect(verifyEvent(egg)).toBe(true);
    expect(egg.kind).toBe(1111);
    expect(egg.content).toBe('好きな卵料理は？');
    expect(egg.pubkey).not.toBe(OWNER);
    expect(getPow(egg.id)).toBeGreaterThanOrEqual(8);
    const address = nestAddress(OWNER, NEST);
    expect(egg.tags).toContainEqual(['A', address]);
    expect(egg.tags).toContainEqual(['a', address]);
    expect(egg.tags).toContainEqual(['K', '35128']);
    expect(egg.tags).toContainEqual(['k', '35128']);
    expect(egg.tags).toContainEqual(['p', OWNER]);
    expect(egg.tags.find(([n]) => n === 'nonce')).toBeTruthy();
  });

  it('uses a fresh throwaway key for every egg', () => {
    const a = layAnonymousEgg({ owner: OWNER, nestId: NEST, content: 'a', difficulty: 0 });
    const b = layAnonymousEgg({ owner: OWNER, nestId: NEST, content: 'b', difficulty: 0 });
    expect(a.pubkey).not.toBe(b.pubkey);
  });

  it('rejects empty and oversized eggs', () => {
    expect(() => layAnonymousEgg({ owner: OWNER, nestId: NEST, content: '   ' })).toThrow();
    expect(() => layAnonymousEgg({ owner: OWNER, nestId: NEST, content: 'x'.repeat(501) })).toThrow();
  });
});

describe('sortClutch', () => {
  const egg1 = layAnonymousEgg({ owner: OWNER, nestId: NEST, content: 'q1', difficulty: 4 });
  const egg2 = layAnonymousEgg({ owner: OWNER, nestId: NEST, content: 'q2', difficulty: 4 });
  const hatchOld = sign(buildHatchTemplate({ owner: OWNER, nestId: NEST, egg: egg1, content: 'old' }), ownerKey, 300);
  const hatchNew = sign(buildHatchTemplate({ owner: OWNER, nestId: NEST, egg: egg1, content: 'new' }), ownerKey, 400);
  const stranger = generateSecretKey();
  const fakeHatch = sign(buildHatchTemplate({ owner: OWNER, nestId: NEST, egg: egg2, content: 'fake' }), stranger, 500);

  it('pairs eggs with the owner’s newest hatch and ignores impostors', () => {
    const eggs = sortClutch([egg1, egg2, hatchNew, hatchOld, fakeHatch], OWNER, NEST, { difficulty: 4 });
    const byContent = Object.fromEntries(eggs.map((e) => [e.content, e]));
    expect(eggs).toHaveLength(2);
    expect(byContent.q1.hatch?.content).toBe('new');
    expect(byContent.q2.hatch).toBeUndefined();
  });

  it('drops eggs below the PoW threshold', () => {
    const weak = layAnonymousEgg({ owner: OWNER, nestId: NEST, content: 'spam', difficulty: 0 });
    const eggs = sortClutch([weak], OWNER, NEST, { difficulty: 30 });
    expect(eggs).toHaveLength(0);
  });

  it('drops eggs for other nests and cracked eggs', () => {
    const other = layAnonymousEgg({ owner: OWNER, nestId: 'other', content: 'q', difficulty: 4 });
    const eggs = sortClutch([egg1, egg2, other], OWNER, NEST, { difficulty: 4, cracked: new Set([egg1.id]) });
    expect(eggs.map((e) => e.id)).toEqual([egg2.id]);
  });
});

describe('cracked list', () => {
  it('round-trips egg ids through a NIP-78 event', () => {
    const template = buildCrackedTemplate(NEST, ['a'.repeat(64), 'a'.repeat(64), 'b'.repeat(64)]);
    expect(template.kind).toBe(30078);
    expect(template.tags).toContainEqual(['d', 'egg-of-ostriches/cracked/ask-me']);
    const ids = parseCrackedIds(sign(template));
    expect(ids).toEqual(new Set(['a'.repeat(64), 'b'.repeat(64)]));
  });
});

describe('parseNest', () => {
  it('reads title and description from a named-site manifest', () => {
    const nest = parseNest(sign({
      kind: 35128,
      content: '',
      tags: [['d', NEST], ['title', 'ダチョウの巣'], ['description', 'なんでも'], ['t', 'egg-of-ostriches']],
    }));
    expect(nest).toMatchObject({ id: NEST, title: 'ダチョウの巣', description: 'なんでも', pubkey: OWNER });
  });

  it('rejects malformed identifiers', () => {
    expect(parseNest(sign({ kind: 35128, content: '', tags: [['d', 'Bad!']] }))).toBeNull();
    expect(isValidNestId('ends-')).toBe(false);
    expect(isValidNestId('ok-1')).toBe(true);
  });
});
