import { describe, expect, it } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent } from 'nostr-tools';
import { getPow } from 'nostr-tools/nip13';
import { buildAnswerNoteTemplate } from './answer';
import {
  buildCrackedTemplate,
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
  const stranger = generateSecretKey();
  const answerUrl = 'https://example.nwb.tf/a/0123456789abcdef.html';
  const answer = (egg: NostrEvent, content: string, key: Uint8Array, t: number, nestId = NEST) =>
    sign(buildAnswerNoteTemplate({ owner: OWNER, nestId, egg, content, answerUrl }), key, t);

  it('pairs eggs with kind 1 answer notes and their links', () => {
    const eggs = sortClutch([egg1, egg2, answer(egg2, 'note', ownerKey, 200)], OWNER, NEST, { difficulty: 4 });
    const byContent = Object.fromEntries(eggs.map((e) => [e.content, e]));
    expect(byContent.q2.hatch).toMatchObject({ content: 'note', url: answerUrl });
    expect(byContent.q1.hatch).toBeUndefined();
  });

  it('lets the owner’s newest answer win', () => {
    const older = answer(egg1, 'old', ownerKey, 300);
    const newer = answer(egg1, 'new', ownerKey, 400);
    const eggs = sortClutch([egg1, newer, older], OWNER, NEST, { difficulty: 4 });
    expect(eggs[0].hatch).toEqual({ id: newer.id, content: 'new', url: answerUrl, createdAt: 400 });
  });

  it('ignores legacy kind 1111 replies from the owner', () => {
    const legacy = sign(
      {
        kind: 1111,
        content: 'legacy',
        tags: [
          ['A', nestAddress(OWNER, NEST)],
          ['K', '35128'],
          ['P', OWNER],
          ['e', egg1.id, '', egg1.pubkey],
          ['k', '1111'],
          ['p', egg1.pubkey],
        ],
      },
      ownerKey,
      300,
    );
    const eggs = sortClutch([egg1, legacy], OWNER, NEST, { difficulty: 4 });
    expect(eggs).toHaveLength(1);
    expect(eggs[0].hatch).toBeUndefined();
  });

  it('ignores kind 1 answers from impostors, other nests or unknown eggs', () => {
    const unlisted = layAnonymousEgg({ owner: OWNER, nestId: NEST, content: 'unlisted', difficulty: 4 });
    const events = [
      egg1,
      answer(egg1, 'fake', stranger, 600),
      answer(egg1, 'elsewhere', ownerKey, 700, 'other'),
      answer(unlisted, 'orphan', ownerKey, 800),
    ];
    const eggs = sortClutch(events, OWNER, NEST, { difficulty: 4 });
    expect(eggs).toHaveLength(1);
    expect(eggs[0].hatch).toBeUndefined();
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
