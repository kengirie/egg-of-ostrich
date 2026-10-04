import { useNostr } from "@nostrify/react";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";

import { useCurrentUser } from "./useCurrentUser";

import type { NostrEvent } from "@nostrify/nostrify";

/** Shown by Nostr clients as the posting app ("via …"). */
export const CLIENT_NAME = "Egg of Ostriches";

type EventTemplate = Pick<NostrEvent, 'kind' | 'content'> &
  Partial<Pick<NostrEvent, 'tags' | 'created_at'>>;

export function useNostrPublish(): UseMutationResult<
  NostrEvent,
  Error,
  EventTemplate
> {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (t: EventTemplate) => {
      if (user) {
        const tags = t.tags ?? [];

        // NIP-89 client tag: clients show it as "via Egg of Ostriches".
        if (!tags.some(([name]) => name === "client")) {
          tags.push(["client", CLIENT_NAME]);
        }

        const event = await user.signer.signEvent({
          kind: t.kind,
          content: t.content ?? "",
          tags,
          created_at: t.created_at ?? Math.floor(Date.now() / 1000),
        });

        await nostr.event(event, { signal: AbortSignal.timeout(5000) });
        return event;
      } else {
        throw new Error("User is not logged in");
      }
    },
    onError: (error) => {
      console.error("Failed to publish event:", error);
    },
    onSuccess: (data) => {
      console.log("Event published successfully:", data);
    },
  });
}