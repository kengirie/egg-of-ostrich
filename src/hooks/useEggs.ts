import type { NostrEvent } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  APP_DATA_KIND,
  COMMENT_KIND,
  buildCrackedTemplate,
  crackedListId,
  layAnonymousEgg,
  nestAddress,
  parseCrackedIds,
  parseNest,
  sortClutch,
  type Egg,
  type Nest,
} from '@/lib/egg';
import { publishAnonymously } from '@/lib/anonPublish';
import { ANSWER_KIND } from '@/lib/answer';
import { NAMED_SITE_KIND } from '@/lib/nsite';
import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';

function timeout(signal: AbortSignal, ms = 5000): AbortSignal {
  return AbortSignal.any([signal, AbortSignal.timeout(ms)]);
}

function newest(events: NostrEvent[]): NostrEvent | undefined {
  return events.reduce<NostrEvent | undefined>((best, e) => (!best || e.created_at > best.created_at ? e : best), undefined);
}

/** A nest = the owner's named-site manifest (kind 35128). Filtered by author. */
export function useNest(owner: string | undefined, nestId: string | undefined) {
  const { nostr } = useNostr();
  return useQuery<Nest | null>({
    queryKey: ['nostr', 'nest', owner, nestId],
    enabled: Boolean(owner && nestId),
    queryFn: async ({ signal }) => {
      // Freshly opened relay connections (TLS + NIP-42 AUTH) sometimes answer
      // with an empty EOSE before they are ready, so look once more before
      // telling the visitor the nest doesn't exist.
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1500));
        const events = await nostr.query(
          [{ kinds: [NAMED_SITE_KIND], authors: [owner!], '#d': [nestId!], limit: 1 }],
          { signal: timeout(signal) },
        );
        const event = newest(events);
        if (event) return parseNest(event);
      }
      return null;
    },
  });
}

/**
 * Every egg in a nest with its hatch. One round-trip: all kind 1111s under the
 * nest's `A` root, the owner's kind 1 answer notes pointing at the nest, and
 * the owner's cracked list (both author-filtered).
 */
export function useClutch(owner: string | undefined, nestId: string | undefined) {
  const { nostr } = useNostr();
  return useQuery<Egg[]>({
    queryKey: ['nostr', 'clutch', owner, nestId],
    enabled: Boolean(owner && nestId),
    refetchInterval: 30_000,
    queryFn: async ({ signal }) => {
      const events = await nostr.query(
        [
          { kinds: [COMMENT_KIND], '#A': [nestAddress(owner!, nestId!)], limit: 500 },
          { kinds: [ANSWER_KIND], authors: [owner!], '#a': [nestAddress(owner!, nestId!)], limit: 500 },
          { kinds: [APP_DATA_KIND], authors: [owner!], '#d': [crackedListId(nestId!)], limit: 1 },
        ],
        { signal: timeout(signal) },
      );
      const cracked = parseCrackedIds(newest(events.filter((e) => e.kind === APP_DATA_KIND && e.pubkey === owner)));
      return sortClutch(events, owner!, nestId!, { cracked });
    },
  });
}

/**
 * Throw an anonymous egg. No login: a throwaway key signs it, and it travels
 * over dedicated connections that never AUTH as the logged-in user.
 */
export function useThrowEgg(owner: string | undefined, nestId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      if (!owner || !nestId) throw new Error('No nest to throw at');
      // Let the throw animation start before the (synchronous) PoW mining.
      await new Promise((resolve) => setTimeout(resolve, 50));
      const event = layAnonymousEgg({ owner, nestId, content });
      await publishAnonymously(event);
      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nostr', 'clutch', owner, nestId] });
    },
  });
}

/** Owner hides an egg: re-publish the NIP-78 cracked list with one more id. */
export function useCrackEgg(nestId: string | undefined) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publish } = useNostrPublish();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (eggId: string) => {
      if (!user || !nestId) throw new Error('Only the nest owner can crack eggs');
      const events = await nostr.query(
        [{ kinds: [APP_DATA_KIND], authors: [user.pubkey], '#d': [crackedListId(nestId)], limit: 1 }],
        { signal: AbortSignal.timeout(5000) },
      );
      const ids = parseCrackedIds(newest(events));
      ids.add(eggId);
      return publish(buildCrackedTemplate(nestId, Array.from(ids)));
    },
    onSuccess: (_, eggId) => {
      queryClient.setQueryData<Egg[]>(['nostr', 'clutch', user?.pubkey, nestId], (eggs) =>
        eggs?.filter((e) => e.id !== eggId),
      );
    },
  });
}
