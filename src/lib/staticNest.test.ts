import { describe, expect, it } from 'vitest';
import { renderNestAppHtml } from './staticNest';

const BASE = {
  title: 'ダチョウの巣',
  description: '',
  ownerName: 'ostrich',
  canonicalUrl: 'https://abcask.nwb.tf/',
  ogImageUrl: 'https://abcask.nwb.tf/og.png',
  npub: 'npub1abc',
  nestId: 'ask',
  scripts: ['/assets/index-abc.js'],
  styles: ['/assets/index-abc.css'],
};

describe('renderNestAppHtml', () => {
  it('bakes OG meta, nest identity and app entry points', () => {
    const html = renderNestAppHtml(BASE);
    expect(html).toContain('<meta property="og:image" content="https://abcask.nwb.tf/og.png">');
    expect(html).toContain('<meta name="egg:npub" content="npub1abc">');
    expect(html).toContain('<meta name="egg:id" content="ask">');
    expect(html).toContain('<script type="module" crossorigin src="/assets/index-abc.js"></script>');
    expect(html).toContain("script-src 'self'");
    expect(html).toContain('ostrichの巣に、匿名で卵');
  });

  it('escapes user-supplied text', () => {
    const html = renderNestAppHtml({ ...BASE, title: '<script>alert(1)</script>', ownerName: '"x"' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&quot;x&quot;');
  });

  it('refuses suspicious inputs', () => {
    expect(() => renderNestAppHtml({ ...BASE, ogImageUrl: 'javascript:alert(1)' })).toThrow();
    expect(() => renderNestAppHtml({ ...BASE, scripts: ['https://evil.example/x.js'] })).toThrow();
    expect(() => renderNestAppHtml({ ...BASE, nestId: 'Bad"id' })).toThrow();
  });
});
