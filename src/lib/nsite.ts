import { sha256Hex } from './blossomMulti';

/**
 * NIP-5A named site manifest (kind 35128, addressable by `d`).
 *
 * Each deck is its own named site: the `d` tag is the deck identifier and the
 * site is served at `https://<pubkeyB36><d>.<gateway>/`. This keeps the user's
 * root nsite (kind 15128) untouched and makes a deck's mirror independently
 * replaceable.
 */
export const NAMED_SITE_KIND = 35128;
/** BUD-03 Blossom server list — nsite gateways use it to locate blobs. */
export const BLOSSOM_SERVER_LIST_KIND = 10063;

export interface SitePath {
  /** Absolute path within the site, e.g. "/index.html" */
  path: string;
  sha256: string;
}

/** NIP-5A aggregate hash: sorted "<hash> <path>\n" lines, SHA-256, lowercase hex. */
export async function aggregateHash(paths: SitePath[]): Promise<string> {
  const bytes = new TextEncoder().encode(
    paths
      .map(({ path, sha256 }) => `${sha256} ${path}\n`)
      .sort()
      .join(''),
  );
  return sha256Hex(bytes.buffer as ArrayBuffer);
}

/**
 * Base36 (lowercase, no padding beyond the fixed width) encoding of a 32-byte
 * hex pubkey. NIP-5A: "always exactly 50 characters".
 */
export function pubkeyToBase36(pubkeyHex: string): string {
  if (!/^[0-9a-f]{64}$/.test(pubkeyHex)) {
    throw new Error(`Invalid pubkey hex: ${pubkeyHex}`);
  }
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
  let n = BigInt('0x' + pubkeyHex);
  let out = '';
  while (n > 0n) {
    out = digits[Number(n % 36n)] + out;
    n /= 36n;
  }
  return out.padStart(50, '0');
}

export interface SiteManifestTemplate {
  kind: number;
  content: string;
  tags: string[][];
}

/** Named-site `d` rule: ^[a-z0-9-]{1,13}$ and must not end with '-'. */
function isNamedSiteIdentifier(identifier: string): boolean {
  return /^[a-z0-9-]{1,13}$/.test(identifier) && !identifier.endsWith('-');
}

function assertNamedSiteIdentifier(identifier: string): void {
  if (!isNamedSiteIdentifier(identifier)) {
    throw new Error(`Invalid named-site identifier: ${identifier}`);
  }
}

/**
 * A site path must be absolute, made of URL-safe characters, and free of
 * empty, "." or ".." segments so a gateway can't be steered outside the site.
 */
function isValidSitePath(path: string): boolean {
  if (!/^\/[A-Za-z0-9._~-]+(\/[A-Za-z0-9._~-]+)*$/.test(path)) return false;
  return path.split('/').slice(1).every((segment) => segment !== '.' && segment !== '..');
}

function isValidSha256(sha256: string): boolean {
  return /^[0-9a-f]{64}$/.test(sha256);
}

/** Build a named-site manifest for a deck. Replaces any previous site with the same `d`. */
export async function buildNamedSiteManifest(opts: {
  identifier: string;
  paths: SitePath[];
  servers: string[];
  title?: string;
  description?: string;
}): Promise<SiteManifestTemplate> {
  const { identifier, paths, servers, title, description } = opts;
  assertNamedSiteIdentifier(identifier);
  if (paths.length === 0) throw new Error('A site manifest needs at least one path');

  const tags: string[][] = [
    ['d', identifier],
    ...paths.map(({ path, sha256 }) => ['path', path, sha256]),
    ['x', await aggregateHash(paths), 'aggregate'],
    ...servers.map((url) => ['server', url]),
  ];
  if (title) tags.push(['title', title]);
  if (description) tags.push(['description', description]);

  return { kind: NAMED_SITE_KIND, content: '', tags };
}

/**
 * Rebuild an existing named-site manifest with extra (or replaced) paths.
 *
 * Existing well-formed `path` tags are kept; an added path with the same
 * `path` replaces the old hash. The aggregate `x` tag is recomputed over the
 * final path set, and every other tag (`server`, `title`, unknown…) is kept in
 * its original order. Output ordering matches `buildNamedSiteManifest`:
 * `d`, paths, aggregate `x`, then the rest.
 */
export async function rebuildNamedSiteManifest(
  existing: { tags: string[][] },
  addPaths: SitePath[],
): Promise<SiteManifestTemplate> {
  for (const { path, sha256 } of addPaths) {
    if (!isValidSitePath(path)) throw new Error(`Invalid site path: ${path}`);
    if (!isValidSha256(sha256)) throw new Error(`Invalid sha256 for ${path}: ${sha256}`);
  }

  const dTag = existing.tags.find(([name]) => name === 'd');
  const identifier = dTag?.[1] ?? '';
  assertNamedSiteIdentifier(identifier);

  // Map preserves first-insertion order, so overrides stay in place and new paths append.
  const pathMap = new Map<string, string>();
  const rest: string[][] = [];
  for (const tag of existing.tags) {
    const [name, value, extra] = tag;
    if (name === 'd') continue;
    if (name === 'path') {
      // Malformed existing entries are dropped rather than failing the whole rebuild.
      if (typeof value === 'string' && typeof extra === 'string' && isValidSitePath(value) && isValidSha256(extra)) {
        pathMap.set(value, extra);
      }
      continue;
    }
    if (name === 'x' && tag[2] === 'aggregate') continue;
    rest.push([...tag]);
  }
  for (const { path, sha256 } of addPaths) pathMap.set(path, sha256);

  const paths: SitePath[] = [...pathMap].map(([path, sha256]) => ({ path, sha256 }));
  if (paths.length === 0) throw new Error('A site manifest needs at least one path');

  const tags: string[][] = [
    ['d', identifier],
    ...paths.map(({ path, sha256 }) => ['path', path, sha256]),
    ['x', await aggregateHash(paths), 'aggregate'],
    ...rest,
  ];

  return { kind: NAMED_SITE_KIND, content: '', tags };
}

/** BUD-03 server list template for users who don't have one yet. */
export function buildServerList(servers: string[]): SiteManifestTemplate {
  return {
    kind: BLOSSOM_SERVER_LIST_KIND,
    content: '',
    tags: servers.map((url) => ['server', url]),
  };
}
