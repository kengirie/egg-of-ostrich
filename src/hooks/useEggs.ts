import type { NostrEvent } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  APP_DATA_KIND,
  COMMENT_KIND,
  NEST_ID,
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
import { ANSWER_KIND, ANSWER_T } from '@/lib/answer';
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

export interface RecentHatch {
  owner: string;
  nestId: string;
  eggId: string;
  question: string;
  answer: string;
  /** Answer page link (sanitized https). */
  url: string;
  createdAt: number;
}

const HEX64 = /^[0-9a-f]{64}$/;

/**
 * `<owner>`/`<nest id>` from an answer note's `a` tag, or null if malformed.
 * Only the one-nest-per-user format (`d` = `nest`) counts.
 */
function answerTarget(event: NostrEvent): { owner: string; nestId: string } | null {
  const address = event.tags.find(([n]) => n === 'a')?.[1] ?? '';
  const [kind, owner, nestId, ...rest] = address.split(':');
  if (rest.length || kind !== String(NAMED_SITE_KIND) || !owner || !HEX64.test(owner)) return null;
  if (nestId !== NEST_ID || owner !== event.pubkey) return null;
  return { owner, nestId };
}

/**
 * The global "just hatched" feed: kind 1 answer notes tagged
 * `#eggofostriches`, paired with the egg they quote. Each pair is re-validated
 * with `sortClutch`, so only answers by the nest owner count.
 */
export function useRecentHatches() {
  const { nostr } = useNostr();
  return useQuery<RecentHatch[]>({
    queryKey: ['nostr', 'recent-hatches'],
    queryFn: async ({ signal }) => {
      const answers = (
        await nostr.query([{ kinds: [ANSWER_KIND], '#t': [ANSWER_T], limit: 60 }], { signal: timeout(signal) })
      ).filter((e) => e.kind === ANSWER_KIND && answerTarget(e) !== null);
      if (answers.length === 0) return [];

      const eggIds = Array.from(
        new Set(
          answers
            .map((e) => e.tags.find(([n]) => n === 'q')?.[1])
            .filter((id): id is string => typeof id === 'string' && HEX64.test(id)),
        ),
      );
      if (eggIds.length === 0) return [];
      const eggs = await nostr.query([{ kinds: [COMMENT_KIND], ids: eggIds, limit: eggIds.length }], {
        signal: timeout(signal),
      });

      const hatches: RecentHatch[] = [];
      const seen = new Set<string>();
      for (const answer of answers.sort((a, b) => b.created_at - a.created_at)) {
        const target = answerTarget(answer);
        const eggId = answer.tags.find(([n]) => n === 'q')?.[1];
        if (!target || !eggId || seen.has(eggId)) continue;
        const eggEvent = eggs.find((e) => e.id === eggId);
        if (!eggEvent) continue;
        // Re-run the full egg/answer validation (PoW, root, owner, link) on the pair.
        const [egg] = sortClutch([eggEvent, answer], target.owner, target.nestId);
        if (!egg?.hatch) continue;
        seen.add(eggId);
        hatches.push({
          ...target,
          eggId,
          question: egg.content,
          answer: egg.hatch.content,
          url: egg.hatch.url,
          createdAt: answer.created_at,
        });
      }
      return hatches.slice(0, 12);
    },
  });
}
