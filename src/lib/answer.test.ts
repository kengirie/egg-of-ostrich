import { describe, expect, it } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent } from 'nostr-tools';
import { ANSWER_KIND, buildAnswerNoteTemplate, parseAnswerNote } from './answer';
import { layAnonymousEgg, nestAddress } from './egg';

const ownerKey = generateSecretKey();
const OWNER = getPublicKey(ownerKey);
const NEST = 'ask-me';
const ANSWER_URL = 'https://example.nwb.tf/a/0123456789abcdef.html';

function sign(template: { kind: number; content: string; tags: string[][] }, key = ownerKey, t = 1000): NostrEvent {
  return finalizeEvent({ ...template, created_at: t }, key);
}

const egg = layAnonymousEgg({ owner: OWNER, nestId: NEST, content: 'q', difficulty: 4 });

function build(content = '  ゆで卵です  ', answerUrl = ANSWER_URL) {
  return buildAnswerNoteTemplate({ owner: OWNER, nestId: NEST, egg, content, answerUrl });
}

/** Sign a built note after replacing (or dropping, with `undefined`) one tag. */
function withTag(name: string, tag: string[] | undefined): NostrEvent {
  const template = build();
  const tags = template.tags.filter(([n]) => n !== name);
  return sign({ ...template, tags: tag ? [...tags, tag] : tags });
}

describe('buildAnswerNoteTemplate', () => {
  it('builds a kind 1 note quoting the egg with the hashtag and link trailer', () => {
    const template = build();
    expect(template.kind).toBe(ANSWER_KIND);
    expect(template.kind).toBe(1);
    expect(template.content).toBe(`ゆで卵です\n\n#EggOfOstriches\n${ANSWER_URL}`);
    expect(template.tags).toEqual([
      ['q', egg.id, '', egg.pubkey],
      ['a', nestAddress(OWNER, NEST)],
      ['t', 'eggofostriches'],
      ['r', ANSWER_URL],
    ]);
    expect(verifyEvent(sign(template))).toBe(true);
  });

  it('rejects empty, oversized, non-https links and bad egg ids', () => {
    expect(() => build('   ')).toThrow();
    expect(() => build('x'.repeat(2001))).toThrow();
    expect(() => build('ok', 'http://example.com/a/x.html')).toThrow();
    expect(() => build('ok', 'javascript:alert(1)')).toThrow();
    expect(() =>
      buildAnswerNoteTemplate({
        owner: OWNER,
        nestId: NEST,
        egg: { id: 'nope', pubkey: egg.pubkey },
        content: 'ok',
        answerUrl: ANSWER_URL,
      }),
    ).toThrow();
  });
});

describe('parseAnswerNote', () => {
  it('round-trips a built note and strips the trailer', () => {
    const event = sign(build('一行目\n二行目'));
    expect(parseAnswerNote(event, OWNER, NEST)).toEqual({
      id: event.id,
      eggId: egg.id,
      content: '一行目\n二行目',
      url: ANSWER_URL,
      createdAt: 1000,
    });
  });

  it('falls back to the full trimmed content without a trailer', () => {
    const event = sign({ ...build(), content: '  just text  ' });
    expect(parseAnswerNote(event, OWNER, NEST)?.content).toBe('just text');
  });

  it('rejects a note that is only the trailer', () => {
    const event = sign({ ...build(), content: `\n\n#EggOfOstriches\n${ANSWER_URL}` });
    expect(parseAnswerNote(event, OWNER, NEST)).toBeNull();
  });

  it('rejects wrong author, wrong nest and wrong kind', () => {
    expect(parseAnswerNote(sign(build(), generateSecretKey()), OWNER, NEST)).toBeNull();
    expect(parseAnswerNote(sign(build()), OWNER, 'other')).toBeNull();
    expect(parseAnswerNote(withTag('a', undefined), OWNER, NEST)).toBeNull();
    expect(parseAnswerNote(sign({ ...build(), kind: 1111 }), OWNER, NEST)).toBeNull();
  });

  it('rejects a missing or malformed q tag', () => {
    expect(parseAnswerNote(withTag('q', undefined), OWNER, NEST)).toBeNull();
    expect(parseAnswerNote(withTag('q', ['q', egg.id.toUpperCase()]), OWNER, NEST)).toBeNull();
    expect(parseAnswerNote(withTag('q', ['q', 'abc']), OWNER, NEST)).toBeNull();
  });

  it('rejects a missing or non-https r tag', () => {
    expect(parseAnswerNote(withTag('r', undefined), OWNER, NEST)).toBeNull();
    expect(parseAnswerNote(withTag('r', ['r', 'http://example.com/a/x.html']), OWNER, NEST)).toBeNull();
    expect(parseAnswerNote(withTag('r', ['r', 'javascript:alert(1)']), OWNER, NEST)).toBeNull();
  });

  it('returns null instead of throwing on garbage', () => {
    const event = sign(build());
    expect(parseAnswerNote({ ...event, tags: [[], ['a'], ['q'], ['r']] }, OWNER, NEST)).toBeNull();
    const noTags = { ...event, tags: undefined } as unknown as NostrEvent;
    expect(parseAnswerNote(noTags, OWNER, NEST)).toBeNull();
  });
});
