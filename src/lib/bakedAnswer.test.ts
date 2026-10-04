import { afterEach, describe, expect, it } from 'vitest';
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import { buildAnswerNoteTemplate } from './answer';
import { readBakedAnswer } from './bakedAnswer';
import { layAnonymousEgg } from './egg';
import { renderAnswerAppHtml } from './staticAnswer';

const ownerKey = generateSecretKey();
const OWNER = getPublicKey(ownerKey);
const URL_ = 'https://exampleq0123456789ab.nsite.lol/';

function setHead(html: string) {
  document.head.innerHTML = new DOMParser().parseFromString(html, 'text/html').head.innerHTML;
}

function bake(opts: { tamper?: boolean } = {}) {
  const egg = layAnonymousEgg({ owner: OWNER, nestId: 'nest', content: '好きな卵料理は？', difficulty: 12 });
  const note = finalizeEvent(
    { ...buildAnswerNoteTemplate({ owner: OWNER, nestId: 'nest', egg, content: 'オムレツ', answerUrl: URL_ }), created_at: 2000 },
    ownerKey,
  );
  const hatch = opts.tamper ? { ...note, content: '改ざん' } : note;
  setHead(
    renderAnswerAppHtml({
      ownerName: 'ostrich',
      nestTitle: 'ダチョウの巣',
      question: egg.content,
      answer: 'オムレツ',
      canonicalUrl: URL_,
      ogImageUrl: `https://blossom.example/${'d'.repeat(64)}.png`,
      npub: 'npub1abc',
      eggId: egg.id,
      eggEvent: egg,
      hatchEvent: hatch,
      scripts: ['/assets/index-abc.js'],
      styles: ['/assets/index-abc.css'],
    }),
  );
  return { egg, note };
}

describe('readBakedAnswer', () => {
  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('reads back the baked egg and its answer', () => {
    const { egg } = bake();
    const baked = readBakedAnswer(OWNER, egg.id);
    expect(baked?.egg.content).toBe('好きな卵料理は？');
    expect(baked?.egg.hatch?.content).toBe('オムレツ');
    expect(baked?.egg.hatch?.url).toBe(URL_);
    expect(baked?.nestTitle).toBe('ダチョウの巣');
  });

  it('drops a tampered answer but keeps the egg', () => {
    const { egg } = bake({ tamper: true });
    const baked = readBakedAnswer(OWNER, egg.id);
    expect(baked?.egg.id).toBe(egg.id);
    expect(baked?.egg.hatch).toBeUndefined();
  });

  it('refuses the wrong egg id or owner', () => {
    const { egg } = bake();
    expect(readBakedAnswer(OWNER, 'f'.repeat(64))).toBeNull();
    expect(readBakedAnswer(getPublicKey(generateSecretKey()), egg.id)).toBeNull();
  });
});
