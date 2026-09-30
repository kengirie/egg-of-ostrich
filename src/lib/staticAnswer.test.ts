import { afterEach, describe, expect, it } from 'vitest';
import { renderAnswerAppHtml } from './staticAnswer';
import { answerGatewayUrl, answerPaths, answerSlug, getNestSiteTarget, nestGatewayUrl } from './siteConfig';

const SLUG = '0123456789abcdef';

const BASE = {
  ownerName: 'ostrich',
  nestTitle: 'ダチョウの巣',
  question: '好きな食べ物は？',
  answer: '卵かけご飯です。',
  canonicalUrl: `https://abcask.nwb.tf/a/${SLUG}.html`,
  ogImageUrl: `https://abcask.nwb.tf/a/${SLUG}.png`,
  npub: 'npub1abc',
  nestId: 'ask',
  answerSlug: SLUG,
  scripts: ['/assets/index-abc.js'],
  styles: ['/assets/index-abc.css'],
};

describe('renderAnswerAppHtml', () => {
  it('bakes OG meta, answer identity and app entry points', () => {
    const html = renderAnswerAppHtml(BASE);
    expect(html).toContain('<html lang="ja">');
    expect(html).toContain('<meta property="og:type" content="article">');
    expect(html).toContain('<meta property="og:site_name" content="Egg of Ostriches">');
    expect(html).toContain('<meta property="og:title" content="ostrichの巣に届いた卵">');
    expect(html).toContain('<meta property="og:description" content="卵かけご飯です。">');
    expect(html).toContain(`<meta property="og:url" content="https://abcask.nwb.tf/a/${SLUG}.html">`);
    expect(html).toContain(`<meta property="og:image" content="https://abcask.nwb.tf/a/${SLUG}.png">`);
    expect(html).toContain('<meta property="og:image:width" content="1200">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain('<meta name="egg:npub" content="npub1abc">');
    expect(html).toContain('<meta name="egg:id" content="ask">');
    expect(html).toContain(`<meta name="egg:answer" content="${SLUG}">`);
    expect(html).toContain('<link rel="stylesheet" crossorigin href="/assets/index-abc.css">');
    expect(html).toContain('<script type="module" crossorigin src="/assets/index-abc.js"></script>');
    expect(html).toContain("script-src 'self'");
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('好きな食べ物は？');
  });

  it('truncates long answers in the description', () => {
    const html = renderAnswerAppHtml({ ...BASE, answer: 'あ'.repeat(300) });
    expect(html).toContain(`<meta property="og:description" content="${'あ'.repeat(120)}…">`);
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
    expect(() => renderAnswerAppHtml({ ...BASE, nestId: 'Bad"id' })).toThrow();
    expect(() => renderAnswerAppHtml({ ...BASE, answerSlug: 'ABCDEF0123456789' })).toThrow();
    expect(() => renderAnswerAppHtml({ ...BASE, answerSlug: '0123' })).toThrow();
  });
});

describe('answer URL helpers', () => {
  const PUBKEY = 'f'.repeat(64);
  const EGG_ID = `${SLUG}${'a'.repeat(48)}`;

  it('derives the slug and paths from the egg id', () => {
    expect(answerSlug(EGG_ID)).toBe(SLUG);
    expect(answerPaths(SLUG)).toEqual({ html: `/a/${SLUG}.html`, png: `/a/${SLUG}.png` });
    expect(() => answerSlug('not-an-id')).toThrow();
    expect(() => answerPaths('../x')).toThrow();
  });

  it('builds the answer URL on the nest gateway', () => {
    expect(answerGatewayUrl(PUBKEY, 'ask', EGG_ID)).toBe(`${nestGatewayUrl(PUBKEY, 'ask')}a/${SLUG}.html`);
    expect(answerGatewayUrl(PUBKEY, 'ask', EGG_ID, 'nsite.lol')).toMatch(
      new RegExp(`^https://[0-9a-z]{50}ask\\.nsite\\.lol/a/${SLUG}\\.html$`),
    );
  });
});

describe('getNestSiteTarget', () => {
  function addMeta(name: string, content: string) {
    const meta = document.createElement('meta');
    meta.setAttribute('name', name);
    meta.setAttribute('content', content);
    document.head.appendChild(meta);
  }

  afterEach(() => {
    document.head.querySelectorAll('meta[name^="egg:"]').forEach((el) => el.remove());
  });

  it('returns null outside a nest site', () => {
    expect(getNestSiteTarget()).toBeNull();
  });

  it('reads the nest without an answer', () => {
    addMeta('egg:npub', 'npub1abc');
    addMeta('egg:id', 'ask');
    expect(getNestSiteTarget()).toEqual({ npub: 'npub1abc', nestId: 'ask' });
  });

  it('reads egg:answer on an answer page', () => {
    addMeta('egg:npub', 'npub1abc');
    addMeta('egg:id', 'ask');
    addMeta('egg:answer', SLUG);
    expect(getNestSiteTarget()).toEqual({ npub: 'npub1abc', nestId: 'ask', answerSlug: SLUG });
  });

  it('ignores a malformed egg:answer', () => {
    addMeta('egg:npub', 'npub1abc');
    addMeta('egg:id', 'ask');
    addMeta('egg:answer', '../evil');
    expect(getNestSiteTarget()).toEqual({ npub: 'npub1abc', nestId: 'ask' });
  });
});
