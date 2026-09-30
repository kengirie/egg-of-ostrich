import type { NostrEvent } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  APP_DATA_KIND,
  COMMENT_KIND,
  NEST_TAG,
  buildCrackedTemplate,
  buildHatchTemplate,
  crackedListId,
  isEggNest,
  isValidNestId,
  layAnonymousEgg,
  nestAddress,
  parseCrackedIds,
  parseNest,
  sortClutch,
  type Egg,
  type Nest,
} from '@/lib/egg';
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
      const events = await nostr.query(
        [{ kinds: [NAMED_SITE_KIND], authors: [owner!], '#d': [nestId!], limit: 1 }],
        { signal: timeout(signal) },
      );
      const event = newest(events);
      return event ? parseNest(event) : null;
    },
  });
}

/** Nests created with this app by `owner` (tagged `t: egg-of-ostriches`). */
export function useMyNests(owner: string | undefined) {
  const { nostr } = useNostr();
  return useQuery<Nest[]>({
    queryKey: ['nostr', 'my-nests', owner],
    enabled: Boolean(owner),
    queryFn: async ({ signal }) => {
      const events = await nostr.query(
        [{ kinds: [NAMED_SITE_KIND], authors: [owner!], '#t': [NEST_TAG], limit: 50 }],
        { signal: timeout(signal) },
      );
      const latest = new Map<string, NostrEvent>();
      for (const e of events) {
        if (!isEggNest(e)) continue;
        const d = e.tags.find(([n]) => n === 'd')?.[1] ?? '';
        const prev = latest.get(d);
        if (!prev || e.created_at > prev.created_at) latest.set(d, e);
      }
      return Array.from(latest.values())
        .map(parseNest)
        .filter((n): n is Nest => n !== null)
        .sort((a, b) => b.createdAt - a.createdAt);
    },
  });
}

/**
 * Every egg in a nest with its hatch. One round-trip: all kind 1111s under the
 * nest's `A` root, plus the owner's cracked list (author-filtered).
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
          { kinds: [APP_DATA_KIND], authors: [owner!], '#d': [crackedListId(nestId!)], limit: 1 },
        ],
        { signal: timeout(signal) },
      );
      const cracked = parseCrackedIds(newest(events.filter((e) => e.kind === APP_DATA_KIND && e.pubkey === owner)));
      return sortClutch(events, owner!, nestId!, { cracked });
    },
  });
}

/** Throw an anonymous egg. No login: a throwaway key signs it. */
export function useThrowEgg(owner: string | undefined, nestId: string | undefined) {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      if (!owner || !nestId) throw new Error('No nest to throw at');
      // Let the throw animation start before the (synchronous) PoW mining.
      await new Promise((resolve) => setTimeout(resolve, 50));
      const event = layAnonymousEgg({ owner, nestId, content });
      await nostr.event(event, { signal: AbortSignal.timeout(8000) });
      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nostr', 'clutch', owner, nestId] });
    },
  });
}

/** Owner answers an egg. */
export function useHatchEgg(nestId: string | undefined) {
  const { user } = useCurrentUser();
  const { mutateAsync: publish } = useNostrPublish();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ egg, content }: { egg: Egg; content: string }) => {
      if (!user || !nestId) throw new Error('Only the nest owner can hatch eggs');
      return publish(buildHatchTemplate({ owner: user.pubkey, nestId, egg, content }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nostr', 'clutch', user?.pubkey, nestId] });
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

export interface RecentHatch {
  owner: string;
  nestId: string;
  question: string;
  answer: string;
  createdAt: number;
}

/**
 * The global "just hatched" feed: owner answers on any nest, paired with the
 * egg they answer. Only answers whose author is the nest owner count.
 */
export function useRecentHatches() {
  const { nostr } = useNostr();
  return useQuery<RecentHatch[]>({
    queryKey: ['nostr', 'recent-hatches'],
    queryFn: async ({ signal }) => {
      const answers = (
        await nostr.query([{ kinds: [COMMENT_KIND], '#K': [String(NAMED_SITE_KIND)], '#k': [String(COMMENT_KIND)], limit: 60 }], {
          signal: timeout(signal),
        })
      ).filter((e) => {
        const root = e.tags.find(([n]) => n === 'A')?.[1] ?? '';
        const [kind, owner] = root.split(':');
        return kind === String(NAMED_SITE_KIND) && owner === e.pubkey && e.tags.some(([n]) => n === 'e');
      });
      if (answers.length === 0) return [];

      const eggIds = answers.map((e) => e.tags.find(([n]) => n === 'e')![1]);
      const eggs = await nostr.query([{ kinds: [COMMENT_KIND], ids: eggIds }], { signal: timeout(signal) });

      const hatches: RecentHatch[] = [];
      const seen = new Set<string>();
      for (const answer of answers.sort((a, b) => b.created_at - a.created_at)) {
        const root = answer.tags.find(([n]) => n === 'A')![1];
        const [, owner, nestId] = root.split(':');
        const eggId = answer.tags.find(([n]) => n === 'e')![1];
        if (seen.has(eggId) || !isValidNestId(nestId ?? '')) continue;
        const eggEvent = eggs.find((e) => e.id === eggId);
        if (!eggEvent) continue;
        // Re-run the full egg/hatch validation (PoW, root, parent) on the pair.
        const [egg] = sortClutch([eggEvent, answer], owner, nestId);
        if (!egg?.hatch) continue;
        seen.add(eggId);
        hatches.push({ owner, nestId, question: egg.content, answer: egg.hatch.content, createdAt: answer.created_at });
      }
      return hatches.slice(0, 12);
    },
  });
}
