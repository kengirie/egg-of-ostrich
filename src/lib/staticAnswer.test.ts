import { afterEach, describe, expect, it } from 'vitest';
import { answerSiteId, isAnswerSiteId, isValidNestId } from './egg';
import { isAnswerPageLive, renderAnswerAppHtml } from './staticAnswer';
import { answerGatewayUrl, getSiteTarget, nestGatewayUrl } from './siteConfig';

const EGG_ID = `0123456789ab${'c'.repeat(52)}`;
const SITE = 'https://abcq0123456789ab.nsite.lol/';
const OG = `https://blossom.example/${'d'.repeat(64)}.png`;

const BASE = {
  ownerName: 'ostrich',
  nestTitle: 'ダチョウの巣',
  question: '好きな食べ物は？',
  answer: '卵かけご飯です。',
  canonicalUrl: SITE,
  ogImageUrl: OG,
  npub: 'npub1abc',
  eggId: EGG_ID,
  scripts: ['/assets/index-abc.js'],
  styles: ['/assets/index-abc.css'],
};

describe('renderAnswerAppHtml', () => {
  it('bakes OG meta, answer identity and app entry points', () => {
    const html = renderAnswerAppHtml(BASE);
    expect(html).toContain('<html lang="ja">');
    expect(html).toContain('<meta property="og:type" content="article">');
    expect(html).toContain('<meta property="og:site_name" content="Egg of Ostriches">');
    expect(html).toContain('<title>好きな食べ物は？ | Egg of Ostriches</title>');
    expect(html).toContain('<meta property="og:title" content="好きな食べ物は？ | Egg of Ostriches">');
    expect(html).toContain('<meta name="twitter:title" content="好きな食べ物は？ | Egg of Ostriches">');
    expect(html).toContain('<meta property="og:description" content="ostrichさんの回答「卵かけご飯です。」">');
    expect(html).toContain('<meta name="twitter:description" content="ostrichさんの回答「卵かけご飯です。」">');
    expect(html).toContain(`<meta property="og:url" content="${SITE}">`);
    expect(html).toContain(`<meta property="og:image" content="${OG}">`);
    expect(html).toContain(`<meta name="twitter:image" content="${OG}">`);
    expect(html).toContain('<meta property="og:image:type" content="image/png">');
    expect(renderAnswerAppHtml({ ...BASE, ogImageType: 'image/gif' })).toContain(
      '<meta property="og:image:type" content="image/gif">',
    );
    expect(html).toContain('<meta property="og:image:width" content="1200">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain('<meta name="egg:npub" content="npub1abc">');
    expect(html).toContain(`<meta name="egg:answer" content="${EGG_ID}">`);
    expect(html).not.toContain('egg:id');
    expect(html).toContain('<link rel="stylesheet" crossorigin href="/assets/index-abc.css">');
    expect(html).toContain('<script type="module" crossorigin src="/assets/index-abc.js"></script>');
    expect(html).toContain("script-src 'self'");
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('好きな食べ物は？');
  });

  it('truncates long answers in the description', () => {
    const html = renderAnswerAppHtml({ ...BASE, answer: 'あ'.repeat(300) });
    expect(html).toContain(`<meta property="og:description" content="ostrichさんの回答「${'あ'.repeat(200)}…」">`);
    // The noscript fallback keeps the full answer.
    expect(html).toContain('あ'.repeat(300));
  });

  it('escapes user-supplied text', () => {
    const xss = '<script>alert(1)</script>';
    const html = renderAnswerAppHtml({
      ...BASE,
      question: xss,
      answer: xss,
      ownerName: `"x"${xss}`,
      nestTitle: xss,
    });
    expect(html).not.toContain(xss);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&quot;x&quot;');
  });

  it('refuses suspicious inputs', () => {
    expect(() => renderAnswerAppHtml({ ...BASE, ogImageUrl: 'javascript:alert(1)' })).toThrow();
    expect(() => renderAnswerAppHtml({ ...BASE, canonicalUrl: 'data:text/html,x' })).toThrow();
    expect(() => renderAnswerAppHtml({ ...BASE, scripts: ['https://evil.example/x.js'] })).toThrow();
    expect(() => renderAnswerAppHtml({ ...BASE, styles: ['/x.css"><script>'] })).toThrow();
    expect(() => renderAnswerAppHtml({ ...BASE, npub: 'npub1"x' })).toThrow();
    expect(() => renderAnswerAppHtml({ ...BASE, eggId: 'not-an-id' })).toThrow();
  });
});

describe('isAnswerPageLive', () => {
  it('recognizes the baked answer page and nothing else', () => {
    expect(isAnswerPageLive(renderAnswerAppHtml(BASE), EGG_ID)).toBe(true);
    expect(isAnswerPageLive(renderAnswerAppHtml(BASE), 'e'.repeat(64))).toBe(false);
    expect(isAnswerPageLive('<html><meta name="egg:npub" content="npub1abc"></html>', EGG_ID)).toBe(false);
    expect(isAnswerPageLive('', 'bad')).toBe(false);
  });
});

describe('answer sites', () => {
  const PUBKEY = 'f'.repeat(64);

  it('derives a 13-char named-site id from the egg id', () => {
    expect(answerSiteId(EGG_ID)).toBe('q0123456789ab');
    expect(isAnswerSiteId('q0123456789ab')).toBe(true);
    expect(isAnswerSiteId('nest')).toBe(false);
    expect(isValidNestId(answerSiteId(EGG_ID))).toBe(true);
    expect(() => answerSiteId('not-an-id')).toThrow();
  });

  it('builds nest and answer links on the canonical gateway', () => {
    expect(nestGatewayUrl(PUBKEY)).toMatch(/^https:\/\/[0-9a-z]{50}nest\.nsite\.lol\/$/);
    const url = answerGatewayUrl(PUBKEY, EGG_ID);
    expect(url).toMatch(/^https:\/\/[0-9a-z]{50}q0123456789ab\.nsite\.lol\/$/);
    // The subdomain label must fit DNS's 63-character limit.
    expect(new URL(url).hostname.split('.')[0].length).toBeLessThanOrEqual(63);
  });
});

describe('getSiteTarget', () => {
  function addMeta(name: string, content: string) {
    const meta = document.createElement('meta');
    meta.setAttribute('name', name);
    meta.setAttribute('content', content);
    document.head.appendChild(meta);
  }

  afterEach(() => {
    document.head.querySelectorAll('meta[name^="egg:"]').forEach((el) => el.remove());
  });

  it('returns null on normal app hosts', () => {
    expect(getSiteTarget()).toBeNull();
  });

  it('reads a nest site', () => {
    addMeta('egg:npub', 'npub1abc');
    addMeta('egg:id', 'nest');
    expect(getSiteTarget()).toEqual({ kind: 'nest', npub: 'npub1abc' });
  });

  it('reads an answer site', () => {
    addMeta('egg:npub', 'npub1abc');
    addMeta('egg:answer', EGG_ID);
    expect(getSiteTarget()).toEqual({ kind: 'answer', npub: 'npub1abc', eggId: EGG_ID });
  });

  it('ignores a malformed egg:answer or npub', () => {
    addMeta('egg:npub', 'npub1abc');
    addMeta('egg:answer', '../evil');
    expect(getSiteTarget()).toEqual({ kind: 'nest', npub: 'npub1abc' });
    document.head.querySelectorAll('meta[name^="egg:"]').forEach((el) => el.remove());
    addMeta('egg:npub', 'npub1"x');
    expect(getSiteTarget()).toBeNull();
  });
});
