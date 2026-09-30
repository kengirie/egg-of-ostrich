import { describe, expect, it } from 'vitest';
import { aggregateHash, buildNamedSiteManifest, pubkeyToBase36, rebuildNamedSiteManifest } from './nsite';

const H1 = 'a'.repeat(64);
const H2 = 'b'.repeat(64);
const H3 = 'c'.repeat(64);

describe('aggregateHash', () => {
  it('is order-independent', async () => {
    const a = await aggregateHash([
      { path: '/index.html', sha256: H1 },
      { path: '/pages/001.webp', sha256: H2 },
    ]);
    const b = await aggregateHash([
      { path: '/pages/001.webp', sha256: H2 },
      { path: '/index.html', sha256: H1 },
    ]);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('pubkeyToBase36', () => {
  it('produces exactly 50 lowercase base36 characters', () => {
    const label = pubkeyToBase36('f'.repeat(64));
    expect(label).toMatch(/^[0-9a-z]{50}$/);
  });

  it('pads small pubkeys to the fixed 50-char width', () => {
    const label = pubkeyToBase36('0'.repeat(63) + '1');
    expect(label).toBe('0'.repeat(49) + '1');
  });

  it('round-trips back to the original pubkey', () => {
    const pubkey = 'ac08882489c38edc4cd7d46b4955c283cd49c7ad0ff1d072cd8197c3caf36ec0';
    const label = pubkeyToBase36(pubkey);
    const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
    let n = 0n;
    for (const c of label) n = n * 36n + BigInt(digits.indexOf(c));
    expect(n.toString(16).padStart(64, '0')).toBe(pubkey);
  });

  it('rejects malformed input', () => {
    expect(() => pubkeyToBase36('nothex')).toThrow();
  });
});

describe('buildNamedSiteManifest', () => {
  it('builds a kind 35128 manifest with d, paths, aggregate x, and servers', async () => {
    const template = await buildNamedSiteManifest({
      identifier: 'my-deck',
      paths: [
        { path: '/index.html', sha256: H1 },
        { path: '/pages/001.webp', sha256: H2 },
      ],
      servers: ['https://blossom.example/'],
      title: 'My deck',
      description: 'About it',
    });
    expect(template.kind).toBe(35128);
    expect(template.tags).toContainEqual(['d', 'my-deck']);
    expect(template.tags).toContainEqual(['path', '/index.html', H1]);
    expect(template.tags).toContainEqual(['path', '/pages/001.webp', H2]);
    expect(template.tags).toContainEqual(['server', 'https://blossom.example/']);
    expect(template.tags).toContainEqual(['title', 'My deck']);
    expect(template.tags).toContainEqual(['description', 'About it']);
    const x = template.tags.find(([name]) => name === 'x');
    expect(x?.[2]).toBe('aggregate');
    expect(x?.[1]).toBe(await aggregateHash([
      { path: '/index.html', sha256: H1 },
      { path: '/pages/001.webp', sha256: H2 },
    ]));
  });

  it('enforces the named-site d rules', async () => {
    const paths = [{ path: '/index.html', sha256: H1 }];
    await expect(buildNamedSiteManifest({ identifier: 'UPPER', paths, servers: [] })).rejects.toThrow();
    await expect(buildNamedSiteManifest({ identifier: 'way-too-long-id', paths, servers: [] })).rejects.toThrow();
    await expect(buildNamedSiteManifest({ identifier: 'ends-', paths, servers: [] })).rejects.toThrow();
    await expect(buildNamedSiteManifest({ identifier: 'ok', paths: [], servers: [] })).rejects.toThrow();
  });
});

describe('rebuildNamedSiteManifest', () => {
  const existing = {
    tags: [
      ['d', 'nest1'],
      ['path', '/index.html', H1],
      ['server', 'https://blossom.example/'],
      ['x', 'f'.repeat(64), 'aggregate'],
      ['title', 'My nest'],
      ['path', '/og.png', H2],
      ['t', 'marshmallow'],
      ['unknown', 'kept', 'as-is'],
    ],
  };

  it('keeps existing paths and other tags in order, appending new paths', async () => {
    const template = await rebuildNamedSiteManifest(existing, [
      { path: '/a/abc123.html', sha256: H3 },
    ]);
    expect(template).toEqual({
      kind: 35128,
      content: '',
      tags: [
        ['d', 'nest1'],
        ['path', '/index.html', H1],
        ['path', '/og.png', H2],
        ['path', '/a/abc123.html', H3],
        ['x', await aggregateHash([
          { path: '/index.html', sha256: H1 },
          { path: '/og.png', sha256: H2 },
          { path: '/a/abc123.html', sha256: H3 },
        ]), 'aggregate'],
        ['server', 'https://blossom.example/'],
        ['title', 'My nest'],
        ['t', 'marshmallow'],
        ['unknown', 'kept', 'as-is'],
      ],
    });
  });

  it('replaces the hash of an existing path and recomputes the aggregate', async () => {
    const template = await rebuildNamedSiteManifest(existing, [
      { path: '/og.png', sha256: H3 },
    ]);
    const pathTags = template.tags.filter(([name]) => name === 'path');
    expect(pathTags).toEqual([
      ['path', '/index.html', H1],
      ['path', '/og.png', H3],
    ]);
    const xTags = template.tags.filter(([name]) => name === 'x');
    expect(xTags).toHaveLength(1);
    expect(xTags[0]).toEqual([
      'x',
      await aggregateHash([
        { path: '/index.html', sha256: H1 },
        { path: '/og.png', sha256: H3 },
      ]),
      'aggregate',
    ]);
  });

  it('does not mutate the existing tags', async () => {
    const before = JSON.parse(JSON.stringify(existing.tags));
    await rebuildNamedSiteManifest(existing, [{ path: '/og.png', sha256: H3 }]);
    expect(existing.tags).toEqual(before);
  });

  it('rejects malformed added paths and hashes', async () => {
    const bad = (path: string, sha256: string) => rebuildNamedSiteManifest(existing, [{ path, sha256 }]);
    await expect(bad('a/relative.html', H1)).rejects.toThrow();
    await expect(bad('/a/../escape.html', H1)).rejects.toThrow();
    await expect(bad('/a//double.html', H1)).rejects.toThrow();
    await expect(bad('/a/<script>.html', H1)).rejects.toThrow();
    await expect(bad('/', H1)).rejects.toThrow();
    await expect(bad('/a/ok.html', 'A'.repeat(64))).rejects.toThrow();
    await expect(bad('/a/ok.html', 'a'.repeat(63))).rejects.toThrow();
  });

  it('requires a valid named-site d tag', async () => {
    const add = [{ path: '/a/x.html', sha256: H1 }];
    await expect(rebuildNamedSiteManifest({ tags: [['path', '/index.html', H1]] }, add)).rejects.toThrow();
    await expect(rebuildNamedSiteManifest({ tags: [['d', 'UPPER']] }, add)).rejects.toThrow();
    await expect(rebuildNamedSiteManifest({ tags: [['d', 'ends-']] }, add)).rejects.toThrow();
    await expect(rebuildNamedSiteManifest({ tags: [['d', 'way-too-long-id']] }, add)).rejects.toThrow();
    await expect(rebuildNamedSiteManifest({ tags: [['d']] }, add)).rejects.toThrow();
  });

  it('drops malformed existing path tags instead of throwing', async () => {
    const template = await rebuildNamedSiteManifest(
      {
        tags: [
          ['d', 'nest1'],
          ['path', '/index.html', H1],
          ['path', '/missing-hash.html'],
          ['path', 'relative.html', H2],
          ['path', '/../escape.html', H2],
          ['path', '/bad-hash.html', 'nothex'],
        ],
      },
      [{ path: '/a/x.html', sha256: H3 }],
    );
    expect(template.tags.filter(([name]) => name === 'path')).toEqual([
      ['path', '/index.html', H1],
      ['path', '/a/x.html', H3],
    ]);
  });
});
