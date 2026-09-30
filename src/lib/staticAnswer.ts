/**
 * Answer-time HTML baked into the nest's nsite at `/a/<slug>.html`. The kind 1
 * note announcing an answer links here, so the link unfurls as an OG card with
 * the answer (like マシュマロ) — and opening it boots the full app, same as the
 * nest page, which reads `<meta name="egg:answer">` to show that answer.
 */

import {
  assertAssetRef,
  assertHttpUrl,
  escapeHtml,
  FAVICON_HREF,
  NEST_SITE_CSP,
} from './staticNest';
import { isAnswerSlug } from './siteConfig';

/** Max characters of the answer shown in og:description before truncating. */
const DESCRIPTION_MAX = 120;

export interface AnswerAppHtmlInput {
  ownerName: string;
  nestTitle: string;
  /** The egg (question) text. */
  question: string;
  /** The owner's answer text. */
  answer: string;
  /** Absolute canonical URL of this answer page on its gateway. */
  canonicalUrl: string;
  /** Absolute URL of the 1200x630 OG image. */
  ogImageUrl: string;
  /** npub of the nest owner. */
  npub: string;
  nestId: string;
  /** `^[0-9a-f]{16}$`, see `answerSlug()` in siteConfig. */
  answerSlug: string;
  /** App entry module scripts from site-assets.json. */
  scripts: string[];
  /** App entry stylesheets from site-assets.json. */
  styles: string[];
}

/** Collapse whitespace and cut to `max` code points, adding an ellipsis. */
function truncate(value: string, max: number): string {
  const chars = Array.from(value.replace(/\s+/g, ' ').trim());
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : chars.join('');
}

export function renderAnswerAppHtml(input: AnswerAppHtmlInput): string {
  const owner = escapeHtml(input.ownerName);
  const nestTitle = escapeHtml(input.nestTitle);
  const ogTitle = escapeHtml(`${input.ownerName}の巣に届いた卵`);
  const description = escapeHtml(truncate(input.answer, DESCRIPTION_MAX));
  const question = escapeHtml(input.question);
  const answer = escapeHtml(input.answer);
  const canonical = escapeHtml(assertHttpUrl(input.canonicalUrl));
  const ogImage = escapeHtml(assertHttpUrl(input.ogImageUrl));
  const scripts = input.scripts.map(assertAssetRef);
  const styles = input.styles.map(assertAssetRef);

  if (!/^npub1[a-z0-9]+$/.test(input.npub)) throw new Error(`Refusing bad npub: ${input.npub}`);
  if (!/^[a-z0-9-]{1,13}$/.test(input.nestId)) throw new Error(`Refusing bad nest id: ${input.nestId}`);
  if (!isAnswerSlug(input.answerSlug)) throw new Error(`Refusing bad answer slug: ${input.answerSlug}`);

  const styleTags = styles
    .map((href) => `<link rel="stylesheet" crossorigin href="${escapeHtml(href)}">`)
    .join('\n');
  const scriptTags = scripts
    .map((src) => `<script type="module" crossorigin src="${escapeHtml(src)}"></script>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="content-security-policy" content="${NEST_SITE_CSP}">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="${FAVICON_HREF}">
<title>${ogTitle} | ${nestTitle} | Egg of Ostriches</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Egg of Ostriches">
<meta property="og:title" content="${ogTitle}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${ogTitle}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${ogImage}">
<meta name="egg:npub" content="${escapeHtml(input.npub)}">
<meta name="egg:id" content="${escapeHtml(input.nestId)}">
<meta name="egg:answer" content="${escapeHtml(input.answerSlug)}">
${styleTags}
${scriptTags}
</head>
<body>
<div id="root"></div>
<noscript>
  <div style="max-width:40rem;margin:0 auto;padding:1.5rem;font-family:system-ui,sans-serif">
    <h1>${ogTitle}</h1>
    <h2>卵（質問）</h2>
    <p style="white-space:pre-wrap">${question}</p>
    <h2>${owner}の回答</h2>
    <p style="white-space:pre-wrap">${answer}</p>
  </div>
</noscript>
</body>
</html>
`;
}
