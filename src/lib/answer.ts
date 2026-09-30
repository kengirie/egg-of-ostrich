import type { NostrEvent } from '@nostrify/nostrify';
import { NAMED_SITE_KIND } from './nsite';
import { sanitizeUrl } from './sanitizeUrl';

/**
 * Answer notes — how an owner hatches an egg in public.
 *
 * An answer is a plain kind 1 note by the nest owner that quotes the egg
 * (NIP-18 `q`), points at the nest (`a`), and ends with a hashtag plus the
 * answer link so clients unfurl it as an OGP card:
 *
 *     <answer text>\n\n#EggOfOstriches\n<answer link>
 *
 * This module deliberately does not import `./egg` at runtime: `egg.ts` uses
 * `parseAnswerNote`, and keeping the dependency one-way avoids an import cycle.
 */

export const ANSWER_KIND = 1;
/** Hashtag written into the answer note content. */
export const ANSWER_HASHTAG = 'EggOfOstriches';
/** Lowercase `t` tag matching `ANSWER_HASHTAG` (NIP-24). */
export const ANSWER_T = 'eggofostriches';

/** Maximum hatch (answer) length in characters. Re-exported by `./egg`. */
export const HATCH_MAX_LENGTH = 2000;

export interface AnswerNote {
  id: string;
  /** The egg (question) this note answers. */
  eggId: string;
  /** Answer text with the hashtag + link trailer stripped. */
  content: string;
  /** Sanitized https answer link from the `r` tag. */
  url: string;
  createdAt: number;
}

const HEX64 = /^[0-9a-f]{64}$/;
const TRAILER = new RegExp(`(?:^|\\n\\n)#${ANSWER_HASHTAG}\\n\\S+$`);

/** Same as `nestAddress` in `./egg`, duplicated to keep this module cycle-free. */
function address(owner: string, nestId: string): string {
  return `${NAMED_SITE_KIND}:${owner}:${nestId}`;
}

function tagValue(event: NostrEvent, name: string): string | undefined {
  return event.tags.find(([n]) => n === name)?.[1];
}

/** Build the owner's kind 1 answer note for an egg. Throws on invalid input. */
export function buildAnswerNoteTemplate(opts: {
  owner: string;
  nestId: string;
  egg: { id: string; pubkey: string };
  content: string;
  answerUrl: string;
}): { kind: number; content: string; tags: string[][] } {
  const text = opts.content.trim();
  if (!text) throw new Error('An answer cannot be empty');
  if (text.length > HATCH_MAX_LENGTH) throw new Error(`Answers hold at most ${HATCH_MAX_LENGTH} characters`);
  if (!HEX64.test(opts.egg.id)) throw new Error('Invalid egg id');
  const url = sanitizeUrl(opts.answerUrl);
  if (!url) throw new Error('The answer link must be an https URL');
  return {
    kind: ANSWER_KIND,
    content: `${text}\n\n#${ANSWER_HASHTAG}\n${url}`,
    tags: [
      ['q', opts.egg.id, '', opts.egg.pubkey],
      ['a', address(opts.owner, opts.nestId)],
      ['t', ANSWER_T],
      ['r', url],
    ],
  };
}

/**
 * Parse a kind 1 answer note for a nest. Events are untrusted: returns null
 * unless it is signed by the owner, points at this nest, quotes a valid egg id
 * and carries an https answer link.
 */
export function parseAnswerNote(event: NostrEvent, owner: string, nestId: string): AnswerNote | null {
  try {
    if (event.kind !== ANSWER_KIND || event.pubkey !== owner) return null;
    if (tagValue(event, 'a') !== address(owner, nestId)) return null;
    const eggId = tagValue(event, 'q');
    if (!eggId || !HEX64.test(eggId)) return null;
    const url = sanitizeUrl(tagValue(event, 'r'));
    if (!url) return null;
    // Without the trailer this is a no-op, leaving the full trimmed content.
    const content = event.content.trim().replace(TRAILER, '').trim();
    if (!content) return null;
    return { id: event.id, eggId, content: content.slice(0, HATCH_MAX_LENGTH), url, createdAt: event.created_at };
  } catch {
    return null;
  }
}
