import { useCallback, useState } from 'react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQueryClient } from '@tanstack/react-query';
import { nip19 } from 'nostr-tools';
import { buildAnswerNoteTemplate } from '@/lib/answer';
import { getEffectiveBlossomServers } from '@/lib/appBlossom';
import { ensureAppAssets, fetchSiteAssets, isSiteAssets, type SiteAsset } from '@/lib/appMirror';
import { sha256Hex, uploadToServers, type BlossomServerResult } from '@/lib/blossomMulti';
import { parseNest, type Egg } from '@/lib/egg';
import { NAMED_SITE_KIND, rebuildNamedSiteManifest, type SitePath } from '@/lib/nsite';
import { renderAnswerOgImage } from '@/lib/ogImage';
import { LOOKUP_RELAYS, answerGatewayUrl, answerPaths, answerSlug, nestGatewayUrl } from '@/lib/siteConfig';
import { renderAnswerAppHtml } from '@/lib/staticAnswer';
import { useAppContext } from './useAppContext';
import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';

export type AnswerStep = 'idle' | 'drawing' | 'uploading' | 'announcing' | 'posting' | 'done' | 'error';

export interface PublishAnswerResult {
  answerUrl: string;
  note: NostrEvent;
}

interface AnswerState {
  step: AnswerStep;
  /** Servers that rejected at least one blob (the upload still landed elsewhere). */
  failedServers: string[];
  error: string | null;
  result: PublishAnswerResult | null;
}

const IDLE: AnswerState = { step: 'idle', failedServers: [], error: null, result: null };

interface AssetIndex {
  scripts: string[];
  styles: string[];
  /** Assets that must be added to the manifest (the live build's; empty for the pinned one). */
  extraPaths: SitePath[];
}

function newest(events: NostrEvent[]): NostrEvent | undefined {
  return events.reduce<NostrEvent | undefined>((best, e) => (!best || e.created_at > best.created_at ? e : best), undefined);
}

/** Server URLs from a manifest's `server` tags, followed by `extra`, deduped. */
function manifestServers(manifest: NostrEvent, extra: string[]): string[] {
  const urls = new Set<string>();
  for (const [name, value] of manifest.tags) {
    if (name !== 'server' || !value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === 'https:') urls.add(url.toString());
    } catch {
      // Ignore malformed server tags
    }
  }
  for (const server of extra) urls.add(server);
  return Array.from(urls);
}

/**
 * The app build the nest already pins: its `/site-assets.json` blob, fetched
 * straight from Blossom and verified against the manifest hash. Fallback for
 * when the live app's asset index can't be loaded; needs no new asset paths.
 */
async function pinnedAssetIndex(manifest: NostrEvent, servers: string[]): Promise<AssetIndex | null> {
  const sha = manifest.tags.find(([name, path]) => name === 'path' && path === '/site-assets.json')?.[2];
  if (!sha || !/^[0-9a-f]{64}$/.test(sha)) return null;
  for (const server of manifestServers(manifest, servers)) {
    try {
      const response = await fetch(new URL(`/${sha}`, server), { signal: AbortSignal.timeout(8000) });
      if (!response.ok) continue;
      const buffer = await response.arrayBuffer();
      if ((await sha256Hex(buffer)) !== sha) continue;
      const data: unknown = JSON.parse(new TextDecoder().decode(buffer));
      if (!isSiteAssets(data)) continue;
      return { scripts: data.scripts, styles: data.styles, extraPaths: [] };
    } catch {
      // Try the next server
    }
  }
  return null;
}

/**
 * Answers to one nest are published one at a time: each rebuilds the nest
 * manifest from the previous one, so two concurrent rebuilds would drop each
 * other's `/a/<slug>` paths.
 */
const nestLocks = new Map<string, Promise<unknown>>();
/** The manifest we last published per nest, in case a relay still serves an older one. */
const lastManifests = new Map<string, NostrEvent>();

function exclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const run = (nestLocks.get(key) ?? Promise.resolve()).catch(() => undefined).then(fn);
  nestLocks.set(key, run);
  run
    .finally(() => {
      if (nestLocks.get(key) === run) nestLocks.delete(key);
    })
    .catch(() => undefined);
  return run;
}

interface AnswerInput {
  egg: Egg;
  content: string;
  ownerName: string;
}

/**
 * The owner answers (hatches) an egg:
 *
 * 1. draw the answer OG card and bake `/a/<slug>.html` (the app + OG meta),
 * 2. add both to the nest's NIP-5A manifest so the gateway serves them,
 * 3. only then post the kind 1 answer note linking to that page, so the link
 *    unfurls as soon as anyone sees the note.
 */
export function usePublishAnswer(nestId: string | undefined) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { config } = useAppContext();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const [state, setState] = useState<AnswerState>(IDLE);

  const reset = useCallback(() => setState(IDLE), []);

  const publishNow = useCallback(
    async ({ egg, content, ownerName }: AnswerInput): Promise<PublishAnswerResult> => {
      try {
        if (!user || !nestId) throw new Error('Only the nest owner can hatch eggs');
        const owner = user.pubkey;
        const answer = content.trim();
        if (!answer) throw new Error('An answer cannot be empty');

        const servers = getEffectiveBlossomServers(config.blossomServerMetadata, config.useAppBlossomServers);
        const failed = new Set<string>();
        const upload = async (blob: Blob, name: string, type: string) => {
          const result = await uploadToServers({ blob, name, type, servers, signer: user.signer });
          const rejected: BlossomServerResult[] = result.results.filter((r) => !r.ok);
          for (const r of rejected) failed.add(r.server);
          setState((prev) => ({ ...prev, failedServers: Array.from(failed) }));
          return result;
        };

        setState({ ...IDLE, step: 'drawing' });
        const lockKey = `${owner}:${nestId}`;
        const fetched = await nostr.query([{ kinds: [NAMED_SITE_KIND], authors: [owner], '#d': [nestId], limit: 1 }], {
          signal: AbortSignal.timeout(8000),
        });
        const known = lastManifests.get(lockKey);
        const manifest = newest(known ? [...fetched, known] : fetched);
        const nest = manifest ? parseNest(manifest) : null;
        if (!manifest || !nest || manifest.pubkey !== owner) throw new Error('巣のマニフェストが見つかりませんでした');

        const slug = answerSlug(egg.id);
        const paths = answerPaths(slug);
        const nestUrl = nestGatewayUrl(owner, nestId);
        const answerUrl = answerGatewayUrl(owner, nestId, egg.id);

        const og = await upload(
          await renderAnswerOgImage({ question: egg.content, ownerName, nestTitle: nest.title }),
          `${slug}.png`,
          'image/png',
        );

        setState((prev) => ({ ...prev, step: 'uploading' }));
        // Prefer the live app build: a nest published before answer pages
        // existed pins an app that has no /a/<slug>.html route. Hashed asset
        // names let both builds live side by side in one manifest. Fall back to
        // the nest's pinned build when the live index is unreachable.
        let assets: AssetIndex | null = null;
        try {
          const live = await fetchSiteAssets();
          await ensureAppAssets({ assets: live.assets, servers, signer: user.signer, assetBase: live.assetBase });
          assets = {
            scripts: live.scripts,
            styles: live.styles,
            extraPaths: live.assets.map((a: SiteAsset) => ({ path: a.path, sha256: a.sha256 })),
          };
        } catch (err) {
          console.warn('Live app assets unavailable, using the nest\'s pinned build:', err);
          assets = await pinnedAssetIndex(manifest, servers);
        }
        if (!assets) throw new Error('アプリ本体の資産が見つかりませんでした');
        const html = renderAnswerAppHtml({
          ownerName,
          nestTitle: nest.title,
          question: egg.content,
          answer,
          canonicalUrl: answerUrl,
          ogImageUrl: new URL(paths.png, nestUrl).toString(),
          npub: nip19.npubEncode(owner),
          nestId,
          answerSlug: slug,
          scripts: assets.scripts,
          styles: assets.styles,
        });
        const page = await upload(new Blob([html], { type: 'text/html' }), `${slug}.html`, 'text/html');

        setState((prev) => ({ ...prev, step: 'announcing' }));
        const template = await rebuildNamedSiteManifest(manifest, [
          { path: paths.html, sha256: page.sha256 },
          { path: paths.png, sha256: og.sha256 },
          ...assets.extraPaths,
        ]);
        // The gateway must find the new blobs: list every server that took both.
        const listed = new Set(template.tags.filter(([name]) => name === 'server').map(([, url]) => url));
        const tookBoth = page.results
          .filter((r) => r.ok && og.results.some((o) => o.ok && o.server === r.server))
          .map((r) => r.server);
        for (const server of tookBoth) if (!listed.has(server)) template.tags.push(['server', server]);
        // A replaceable event must be strictly newer than the one it replaces.
        const createdAt = Math.max(Math.floor(Date.now() / 1000), manifest.created_at + 1);
        const newManifest = await publishEvent({ ...template, created_at: createdAt });
        lastManifests.set(lockKey, newManifest);
        try {
          await nostr.event(newManifest, { relays: LOOKUP_RELAYS, signal: AbortSignal.timeout(5000) });
        } catch {
          // Lookup relays are an optimization only
        }

        setState((prev) => ({ ...prev, step: 'posting' }));
        const note = await publishEvent(
          buildAnswerNoteTemplate({ owner, nestId, egg: { id: egg.id, pubkey: egg.pubkey }, content: answer, answerUrl }),
        );

        queryClient.setQueryData<Egg[]>(['nostr', 'clutch', owner, nestId], (eggs) =>
          eggs?.map((e) =>
            e.id === egg.id ? { ...e, hatch: { id: note.id, content: answer, url: answerUrl, createdAt: note.created_at } } : e,
          ),
        );
        queryClient.invalidateQueries({ queryKey: ['nostr', 'clutch', owner, nestId] });
        queryClient.invalidateQueries({ queryKey: ['nostr', 'nest', owner, nestId] });
        queryClient.invalidateQueries({ queryKey: ['nostr', 'recent-hatches'] });

        const result = { answerUrl, note };
        setState((prev) => ({ ...prev, step: 'done', result }));
        return result;
      } catch (err) {
        console.error('Answer publish failed:', err);
        setState((prev) => ({ ...prev, step: 'error', error: err instanceof Error ? err.message : String(err) }));
        throw err;
      }
    },
    [user, nestId, config.blossomServerMetadata, config.useAppBlossomServers, nostr, publishEvent, queryClient],
  );

  const publish = useCallback(
    (input: AnswerInput): Promise<PublishAnswerResult> => {
      setState({ ...IDLE, step: 'drawing' });
      return exclusive(`${user?.pubkey ?? ''}:${nestId ?? ''}`, () => publishNow(input));
    },
    [publishNow, user?.pubkey, nestId],
  );

  const isPending = state.step !== 'idle' && state.step !== 'done' && state.step !== 'error';
  return { ...state, isPending, publish, reset };
}
