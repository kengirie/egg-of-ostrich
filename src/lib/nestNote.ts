import { ANSWER_HASHTAG, ANSWER_T } from './answer';
import { sanitizeUrl } from './sanitizeUrl';

/** Default text for the "I opened a question box" note; the link goes last. */
export function defaultNestNoteText(nestUrl: string): string {
  return `質問箱をつくりました。匿名で質問（卵）を投げてね！\n\n#${ANSWER_HASHTAG}\n${nestUrl}`;
}

/**
 * Kind 1 note announcing the owner's nest. The nest link is always included
 * (appended if missing) and carried in an `r` tag.
 */
export function buildNestNoteTemplate(text: string, nestUrl: string): { kind: number; content: string; tags: string[][] } {
  const url = sanitizeUrl(nestUrl);
  if (!url) throw new Error('The nest link must be an https URL');
  let content = text.trim();
  if (!content.includes(url)) content = content ? `${content}\n${url}` : url;
  const tags: string[][] = [['r', url]];
  if (content.toLowerCase().includes(`#${ANSWER_T}`)) tags.push(['t', ANSWER_T]);
  return { kind: 1, content, tags };
}
