import type { NostrEvent } from '@nostrify/nostrify';
import { verifyEvent } from 'nostr-tools';
import { NEST_ID, sortClutch, type Egg } from './egg';

export interface BakedAnswer {
  egg: Egg;
  nestTitle?: string;
}

function readMetaJson(name: string): NostrEvent | undefined {
  const raw = document.querySelector(`meta[name="${name}"]`)?.getAttribute('content');
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as NostrEvent) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The egg + answer an answer site baked into its HTML (see renderAnswerAppHtml),
 * re-validated exactly like relay data: signatures checked, then paired by
 * `sortClutch` (PoW, nest root, owner-signed answer). Null off answer sites or
 * when anything doesn't check out.
 */
export function readBakedAnswer(owner: string, eggId: string): BakedAnswer | null {
  if (typeof document === 'undefined') return null;
  const eggEvent = readMetaJson('egg:event');
  if (!eggEvent || eggEvent.id !== eggId) return null;
  const hatchEvent = readMetaJson('egg:hatch');
  const events = [eggEvent, hatchEvent].filter((e): e is NostrEvent => {
    try {
      return Boolean(e) && verifyEvent(e as NostrEvent);
    } catch {
      return false;
    }
  });
  const [egg] = sortClutch(events, owner, NEST_ID);
  if (!egg || egg.id !== eggId) return null;
  const nestTitle = document.querySelector('meta[name="egg:nest-title"]')?.getAttribute('content') || undefined;
  return { egg, nestTitle };
}
