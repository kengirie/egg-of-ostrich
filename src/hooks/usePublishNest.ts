import { useCallback, useState } from 'react';
import { useNostr } from '@nostrify/react';
import { useQueryClient } from '@tanstack/react-query';
import { nip19 } from 'nostr-tools';
import { getEffectiveBlossomServers } from '@/lib/appBlossom';
import { ensureAppAssets, fetchSiteAssets } from '@/lib/appMirror';
import { uploadToServers, type BlossomServerResult } from '@/lib/blossomMulti';
import { NEST_TAG } from '@/lib/egg';
import { buildNamedSiteManifest, buildServerList, type SitePath } from '@/lib/nsite';
import { renderNestOgImage } from '@/lib/ogImage';
import { LOOKUP_RELAYS, nestGatewayUrl } from '@/lib/siteConfig';
import { renderNestAppHtml } from '@/lib/staticNest';
import { useAppContext } from './useAppContext';
import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';

export interface NestMeta {
  id: string;
  title: string;
  description: string;
  ownerName: string;
}

export interface PublishNestResult {
  nestId: string;
  npub: string;
  gatewayUrl: string;
}

export type PublishStep = 'idle' | 'drawing' | 'mirroring' | 'uploading' | 'announcing' | 'done' | 'error';

interface PublishState {
  step: PublishStep;
  /** Servers that rejected at least one blob (upload still succeeded elsewhere) */
  failedServers: string[];
  error: string | null;
  result: PublishNestResult | null;
}

const IDLE: PublishState = { step: 'idle', failedServers: [], error: null, result: null };

/**
 * Builds a nest entirely in the browser (Rostrum's publish flow, minus the PDF):
 * OG card → mirror app assets → bake index.html → NIP-5A named-site manifest.
 * The manifest IS the nest; eggs hang off its address as kind 1111 comments.
 */
export function usePublishNest() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { config } = useAppContext();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const [state, setState] = useState<PublishState>(IDLE);

  const reset = useCallback(() => setState(IDLE), []);

  const publish = useCallback(
    async (meta: NestMeta) => {
      if (!user) return;
      const servers = getEffectiveBlossomServers(config.blossomServerMetadata, config.useAppBlossomServers);
      const failed = new Set<string>();
      const track = (results: BlossomServerResult[]) => {
        for (const r of results) if (!r.ok) failed.add(r.server);
        setState((prev) => ({ ...prev, failedServers: Array.from(failed) }));
      };
      const upload = async (blob: Blob, name: string, type: string) => {
        const result = await uploadToServers({ blob, name, type, servers, signer: user.signer });
        track(result.results);
        return result;
      };

      try {
        const npub = nip19.npubEncode(user.pubkey);
        const gatewayUrl = nestGatewayUrl(user.pubkey, meta.id);

        setState({ ...IDLE, step: 'drawing' });
        const og = await upload(await renderNestOgImage({ title: meta.title, ownerName: meta.ownerName }), 'og.png', 'image/png');

        setState((prev) => ({ ...prev, step: 'mirroring' }));
        const siteAssets = await fetchSiteAssets();
        await ensureAppAssets({
          assets: siteAssets.assets,
          servers,
          signer: user.signer,
          assetBase: siteAssets.assetBase,
        });

        setState((prev) => ({ ...prev, step: 'uploading' }));
        const html = renderNestAppHtml({
          title: meta.title,
          description: meta.description,
          ownerName: meta.ownerName,
          canonicalUrl: gatewayUrl,
          ogImageUrl: `${gatewayUrl}og.png`,
          npub,
          nestId: meta.id,
          scripts: siteAssets.scripts,
          styles: siteAssets.styles,
        });
        const htmlUpload = await upload(new Blob([html], { type: 'text/html' }), 'index.html', 'text/html');
        // Ship the asset index too, so anyone can hatch a new nest from this one.
        const assetIndex = JSON.stringify({
          scripts: siteAssets.scripts,
          styles: siteAssets.styles,
          assets: siteAssets.assets,
        });
        const indexUpload = await upload(
          new Blob([assetIndex], { type: 'application/json' }),
          'site-assets.json',
          'application/json',
        );

        setState((prev) => ({ ...prev, step: 'announcing' }));
        const paths: SitePath[] = [
          { path: '/index.html', sha256: htmlUpload.sha256 },
          // In-app routes (/new, /home, /<npub>/<id>) ride the gateway's
          // /404.html fallback — see Rostrum's note on MIME types per gateway.
          { path: '/404.html', sha256: htmlUpload.sha256 },
          { path: '/og.png', sha256: og.sha256 },
          { path: '/site-assets.json', sha256: indexUpload.sha256 },
          ...siteAssets.assets.map((asset) => ({ path: asset.path, sha256: asset.sha256 })),
        ];
        const template = await buildNamedSiteManifest({
          identifier: meta.id,
          paths,
          servers,
          title: meta.title,
          description: meta.description || undefined,
        });
        template.tags.push(['t', NEST_TAG]);
        const manifest = await publishEvent(template);

        // Gateways discover the user's Blossom servers via kind 10063.
        let serverList = null;
        if (config.blossomServerMetadata.updatedAt === 0) {
          serverList = await publishEvent(buildServerList(servers));
        }
        for (const event of [manifest, serverList]) {
          if (!event) continue;
          try {
            await nostr.event(event, { relays: LOOKUP_RELAYS, signal: AbortSignal.timeout(5000) });
          } catch {
            // Lookup relays are an optimization only
          }
        }

        queryClient.invalidateQueries({ queryKey: ['nostr', 'my-nests', user.pubkey] });
        queryClient.invalidateQueries({ queryKey: ['nostr', 'nest', user.pubkey, meta.id] });
        setState((prev) => ({ ...prev, step: 'done', result: { nestId: meta.id, npub, gatewayUrl } }));
      } catch (err) {
        console.error('Nest publish failed:', err);
        setState((prev) => ({
          ...prev,
          step: 'error',
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    },
    [user, config.blossomServerMetadata, config.useAppBlossomServers, nostr, publishEvent, queryClient],
  );

  return { ...state, publish, reset };
}
