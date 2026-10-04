import { useCallback, useState } from 'react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQueryClient } from '@tanstack/react-query';
import { nip19 } from 'nostr-tools';
import { buildAnswerNoteTemplate } from '@/lib/answer';
import { getEffectiveBlossomServers } from '@/lib/appBlossom';
import { ensureAppAssets, fetchSiteAssets, isSiteAssets, type SiteAssets } from '@/lib/appMirror';
import { sha256Hex, uploadToServers } from '@/lib/blossomMulti';
import { ANSWER_SITE_TAG, NEST_ID, answerSiteId, nestAddress, parseNest, type Egg } from '@/lib/egg';
import { NAMED_SITE_KIND, buildNamedSiteManifest, type SitePath } from '@/lib/nsite';
import { pickAnswerCardVariant, renderAnswerOgImage } from '@/lib/ogImage';
import { LOOKUP_RELAYS, answerGatewayUrl, nestGatewayUrl } from '@/lib/siteConfig';
import { isAnswerPageLive, renderAnswerAppHtml } from '@/lib/staticAnswer';
import { useAppContext } from './useAppContext';
import { useCurrentUser } from './useCurrentUser';
import { CLIENT_NAME, useNostrPublish } from './useNostrPublish';

export type AnswerStep =
  | 'idle'
  | 'drawing'
  | 'uploading'
  | 'announcing'
  | 'waiting'
  | 'posting'
  | 'done'
  /** The answer site is published but the gateway hasn't served it yet; the note is on hold. */
  | 'stalled'
  | 'error';

export interface PublishAnswerResult {
  answerUrl: string;
  note: NostrEvent;
}

interface PendingNote {
  egg: Egg;
  answer: string;
  answerUrl: string;
  /** Signed before the answer site is built (it's baked in), published after. */
  note: NostrEvent;
}

interface AnswerState {
  step: AnswerStep;
  /** Servers that rejected at least one blob (the upload still landed elsewhere). */
  failedServers: string[];
  error: string | null;
  result: PublishAnswerResult | null;
  /** Set while `step === 'stalled'`: the note that still needs posting. */
  pending: PendingNote | null;
}

const IDLE: AnswerState = { step: 'idle', failedServers: [], error: null, result: null, pending: null };

/** How long to wait for the gateway to serve a fresh answer site before holding the note. */
const LIVE_TIMEOUT_MS = 120_000;
const LIVE_RETRY_TIMEOUT_MS = 30_000;

function newest(events: NostrEvent[]): NostrEvent | undefined {
  return events.reduce<NostrEvent | undefined>((best, e) => (!best || e.created_at > best.created_at ? e : best), undefined);
}

function truncate(value: string, max: number): string {
  const chars = Array.from(value.replace(/\s+/g, ' ').trim());
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : chars.join('');
}

/**
 * Poll the gateway until it serves this answer's baked page. Clients unfurl a
 * link the moment they see the note and cache the result, so the note must not
 * go out while the gateway would still answer with a 404/fallback page. The
 * first check waits a few seconds so the gateway doesn't look the brand-new
 * site up before the relays have the manifest.
 */
async function waitForAnswerPage(url: string, eggId: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let delay = 3000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
      if (response.ok && isAnswerPageLive(await response.text(), eggId)) return true;
    } catch {
      // Gateway hiccup — keep polling
    }
    delay = Math.min(delay + 2000, 10_000);
  }
  return false;
}

/**
 * The app build the nest pins: its `/site-assets.json` blob, fetched straight
 * from Blossom and verified against the manifest hash. Fallback for when the
 * live app's asset index can't be loaded (e.g. publishing from a non-root host).
 */
async function pinnedSiteAssets(nestManifest: NostrEvent, servers: string[], owner: string): Promise<SiteAssets | null> {
  const sha = nestManifest.tags.find(([name, path]) => name === 'path' && path === '/site-assets.json')?.[2];
  if (!sha || !/^[0-9a-f]{64}$/.test(sha)) return null;
  const candidates = new Set(servers);
  for (const [name, value] of nestManifest.tags) if (name === 'server' && value?.startsWith('https://')) candidates.add(value);
  for (const server of candidates) {
    try {
      const response = await fetch(new URL(`/${sha}`, server), { signal: AbortSignal.timeout(8000) });
      if (!response.ok) continue;
      const buffer = await response.arrayBuffer();
      if ((await sha256Hex(buffer)) !== sha) continue;
      const data: unknown = JSON.parse(new TextDecoder().decode(buffer));
      if (isSiteAssets(data)) return { ...data, assetBase: nestGatewayUrl(owner) };
    } catch {
      // Try the next server
    }
  }
  return null;
}

interface AnswerInput {
  egg: Egg;
  content: string;
  ownerName: string;
}

/**
 * The owner answers (hatches) an egg — like マシュマロ, the answer link shows
 * the question as its card:
 *
 * 1. draw the question card (PNG) and upload it to Blossom,
 * 2. bake the answer page and publish it as the answer's own NIP-5A named site
 *    (`d` = `q` + 12 hex of the egg id) — a brand-new site, so no gateway holds
 *    a stale copy of it,
 * 3. wait until the gateway actually serves it, then post the kind 1 answer
 *    note linking to it. If the gateway is slow the note is held (`stalled`)
 *    and can be posted later with `postNote`.
 */
export function usePublishAnswer(nestId: string = NEST_ID) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { config } = useAppContext();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const [state, setState] = useState<AnswerState>(IDLE);

  const reset = useCallback(() => setState(IDLE), []);

  const fail = useCallback((err: unknown) => {
    console.error('Answer publish failed:', err);
    setState((prev) => ({ ...prev, step: 'error', error: err instanceof Error ? err.message : String(err) }));
  }, []);

  /** Post the kind 1 note for an answer site that is (or is assumed to be) live. */
  const sendNote = useCallback(
    async ({ egg, answer, answerUrl, note }: PendingNote): Promise<PublishAnswerResult> => {
      if (!user) throw new Error('Only the nest owner can hatch eggs');
      const owner = user.pubkey;
      setState((prev) => ({ ...prev, step: 'posting' }));
      await nostr.event(note, { signal: AbortSignal.timeout(8000) });

      queryClient.setQueryData<Egg[]>(['nostr', 'clutch', owner, nestId], (eggs) =>
        eggs?.map((e) =>
          e.id === egg.id ? { ...e, hatch: { id: note.id, content: answer, url: answerUrl, createdAt: note.created_at } } : e,
        ),
      );
      queryClient.invalidateQueries({ queryKey: ['nostr', 'clutch', owner, nestId] });
      queryClient.invalidateQueries({ queryKey: ['nostr', 'recent-hatches'] });

      const result = { answerUrl, note };
      setState((prev) => ({ ...prev, step: 'done', result, pending: null }));
      return result;
    },
    [user, nestId, nostr, queryClient],
  );

  const publish = useCallback(
    async ({ egg, content, ownerName }: AnswerInput): Promise<PublishAnswerResult | null> => {
      try {
        if (!user) throw new Error('Only the nest owner can hatch eggs');
        const owner = user.pubkey;
        const answer = content.trim();
        if (!answer) throw new Error('An answer cannot be empty');

        const servers = getEffectiveBlossomServers(config.blossomServerMetadata, config.useAppBlossomServers);
        const failed = new Set<string>();
        const upload = async (blob: Blob, name: string, type: string) => {
          const result = await uploadToServers({ blob, name, type, servers, signer: user.signer });
          for (const r of result.results) if (!r.ok) failed.add(r.server);
          setState((prev) => ({ ...prev, failedServers: Array.from(failed) }));
          return result;
        };

        setState({ ...IDLE, step: 'drawing' });
        const nestEvents = await nostr.query(
          [{ kinds: [NAMED_SITE_KIND], authors: [owner], '#d': [nestId], limit: 1 }],
          { signal: AbortSignal.timeout(8000) },
        );
        const nestManifest = newest(nestEvents);
        const nest = nestManifest ? parseNest(nestManifest) : null;
        if (!nestManifest || !nest) throw new Error('質問箱が見つかりませんでした');

        const siteId = answerSiteId(egg.id);
        const answerUrl = answerGatewayUrl(owner, egg.id);

        // The question card. Its Blossom URL becomes og:image: immutable, and
        // independent of any gateway being up or holding a fresh manifest.
        // 1 in 10 answers rolls the rare golden-egg card.
        const { golden } = pickAnswerCardVariant();
        const og = await upload(
          await renderAnswerOgImage({ question: egg.content, golden }),
          `${siteId}.png`,
          'image/png',
        );

        setState((prev) => ({ ...prev, step: 'uploading' }));
        // Prefer the live app build; fall back to the build the nest pins.
        let siteAssets: SiteAssets | null = null;
        try {
          siteAssets = await fetchSiteAssets();
        } catch (err) {
          console.warn("Live app assets unavailable, using the nest's pinned build:", err);
          siteAssets = await pinnedSiteAssets(nestManifest, servers, owner);
        }
        if (!siteAssets) throw new Error('アプリ本体の資産が見つかりませんでした');
        await ensureAppAssets({
          assets: siteAssets.assets,
          servers,
          signer: user.signer,
          assetBase: siteAssets.assetBase,
        });

        // Sign the answer note now so the answer site can bake it in; it is
        // only published once the gateway serves that site.
        const noteTemplate = buildAnswerNoteTemplate({
          owner,
          nestId,
          egg: { id: egg.id, pubkey: egg.pubkey },
          content: answer,
          answerUrl,
        });
        const note = await user.signer.signEvent({
          ...noteTemplate,
          tags: [...noteTemplate.tags, ['client', CLIENT_NAME]],
          created_at: Math.floor(Date.now() / 1000),
        });

        const html = renderAnswerAppHtml({
          ownerName,
          nestTitle: nest.title,
          question: egg.content,
          answer,
          canonicalUrl: answerUrl,
          ogImageUrl: og.url,
          npub: nip19.npubEncode(owner),
          eggId: egg.id,
          eggEvent: egg.event,
          hatchEvent: note,
          scripts: siteAssets.scripts,
          styles: siteAssets.styles,
        });
        const page = await upload(new Blob([html], { type: 'text/html' }), 'index.html', 'text/html');
        const assetIndex = await upload(
          new Blob(
            [JSON.stringify({ scripts: siteAssets.scripts, styles: siteAssets.styles, assets: siteAssets.assets })],
            { type: 'application/json' },
          ),
          'site-assets.json',
          'application/json',
        );

        setState((prev) => ({ ...prev, step: 'announcing' }));
        const paths: SitePath[] = [
          { path: '/index.html', sha256: page.sha256 },
          // Unknown paths ride the gateway's /404.html fallback (see usePublishNest).
          { path: '/404.html', sha256: page.sha256 },
          { path: '/og.png', sha256: og.sha256 },
          { path: '/site-assets.json', sha256: assetIndex.sha256 },
          ...siteAssets.assets.map((asset) => ({ path: asset.path, sha256: asset.sha256 })),
        ];
        const template = await buildNamedSiteManifest({
          identifier: siteId,
          paths,
          servers,
          title: `${ownerName}の巣に届いた卵`,
          description: truncate(egg.content, 120),
        });
        template.tags.push(['t', ANSWER_SITE_TAG], ['a', nestAddress(owner, nestId)]);
        const manifest = await publishEvent(template);
        try {
          await nostr.event(manifest, { relays: LOOKUP_RELAYS, signal: AbortSignal.timeout(5000) });
        } catch {
          // Lookup relays are an optimization only
        }

        setState((prev) => ({ ...prev, step: 'waiting' }));
        const pending: PendingNote = { egg, answer, answerUrl, note };
        if (!(await waitForAnswerPage(answerUrl, egg.id, LIVE_TIMEOUT_MS))) {
          setState((prev) => ({ ...prev, step: 'stalled', pending }));
          return null;
        }
        return await sendNote(pending);
      } catch (err) {
        fail(err);
        throw err;
      }
    },
    [user, nestId, config.blossomServerMetadata, config.useAppBlossomServers, nostr, publishEvent, sendNote, fail],
  );

  /**
   * Post the held note. By default re-check the gateway briefly first; with
   * `force` post right away (the card may not unfurl until the gateway catches up).
   */
  const postNote = useCallback(
    async (opts: { force?: boolean } = {}): Promise<PublishAnswerResult | null> => {
      const pending = state.pending;
      if (!pending) return null;
      try {
        if (!opts.force) {
          setState((prev) => ({ ...prev, step: 'waiting' }));
          if (!(await waitForAnswerPage(pending.answerUrl, pending.egg.id, LIVE_RETRY_TIMEOUT_MS))) {
            setState((prev) => ({ ...prev, step: 'stalled' }));
            return null;
          }
        }
        return await sendNote(pending);
      } catch (err) {
        fail(err);
        throw err;
      }
    },
    [state.pending, sendNote, fail],
  );

  const isPending = !['idle', 'done', 'stalled', 'error'].includes(state.step);
  return { ...state, isPending, publish, postNote, reset };
}
