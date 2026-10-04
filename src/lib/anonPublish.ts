import { NRelay1, type NostrEvent } from '@nostrify/nostrify';
import { finalizeEvent, generateSecretKey } from 'nostr-tools';
import { APP_RELAYS } from './appRelays';

/**
 * Publish an anonymous egg over fresh, dedicated relay connections.
 *
 * The app's shared pool answers NIP-42 AUTH with the logged-in user's signer,
 * so sending an egg through it would bind the "anonymous" egg to the user's
 * pubkey on AUTH-requiring relays. Here every connection is new and answers
 * AUTH with its own throwaway key. Resolves once any relay accepts the event;
 * the rest keep going in the background and the connections close when all
 * relays have answered (or `signal` fires).
 */
export async function publishAnonymously(
  event: NostrEvent,
  opts: { relays?: string[]; signal?: AbortSignal } = {},
): Promise<string[]> {
  const urls = opts.relays ?? APP_RELAYS.relays.filter((r) => r.write).map((r) => r.url);
  const signal = opts.signal ?? AbortSignal.timeout(8000);

  const relays = urls.map((url) => {
    const authKey = generateSecretKey();
    return {
      url,
      relay: new NRelay1(url, {
        auth: async (challenge) =>
          finalizeEvent(
            {
              kind: 22242,
              content: '',
              tags: [['relay', url], ['challenge', challenge]],
              created_at: Math.floor(Date.now() / 1000),
            },
            authKey,
          ),
      }),
    };
  });

  const accepted: string[] = [];
  const attempts = relays.map(async ({ url, relay }) => {
    await relay.event(event, { signal });
    accepted.push(url);
  });
  // Let every relay finish (each is bounded by `signal`) before closing, so the
  // egg lands on all of them — slow-to-connect relays used to be cut off.
  void Promise.allSettled(attempts).finally(() => {
    for (const { relay } of relays) relay.close().catch(() => {});
  });
  try {
    // Report success as soon as one relay has the egg.
    await Promise.any(attempts);
    return accepted;
  } catch {
    throw new Error('どのリレーも卵を受け取ってくれませんでした');
  }
}
