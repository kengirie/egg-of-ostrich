/**
 * Publish-time HTML baked into a nest's own nsite (ported from Rostrum's
 * `renderDeckAppHtml`). The nest site serves the full interactive app, so the
 * share link and the app are one URL — but crawlers don't run JavaScript, so
 * nest-specific OG meta is baked into index.html here.
 */

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function assertHttpUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Refusing non-http URL in static nest: ${value}`);
  }
  return url.toString();
}

/** Root-relative same-origin app asset, e.g. "/assets/index-abc.js". */
export function assertAssetRef(value: string): string {
  if (!/^\/[A-Za-z0-9/._-]+\.(js|css)$/.test(value)) {
    throw new Error(`Refusing suspicious asset ref: ${value}`);
  }
  return value;
}

/** Same policy as the app's own index.html: scripts only from same-origin. */
export const NEST_SITE_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "frame-src 'self' https:; font-src 'self'; base-uri 'self'; manifest-src 'self'; " +
  "connect-src 'self' blob: https: wss:; img-src 'self' data: blob: https:; media-src 'self' https:";

/** An egg emoji favicon, inline so every nest site gets it without an extra blob. */
export const FAVICON_HREF =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%A5%9A%3C/text%3E%3C/svg%3E";

export interface NestAppHtmlInput {
  title: string;
  description: string;
  ownerName: string;
  /** Absolute canonical URL of this nest on its gateway. */
  canonicalUrl: string;
  /** Absolute URL of the 1200x630 OG image. */
  ogImageUrl: string;
  /** npub of the nest owner; the app boots into this nest at "/". */
  npub: string;
  nestId: string;
  /** App entry module scripts from site-assets.json. */
  scripts: string[];
  /** App entry stylesheets from site-assets.json. */
  styles: string[];
}

export function renderNestAppHtml(input: NestAppHtmlInput): string {
  const title = escapeHtml(input.title);
  const description = escapeHtml(
    input.description || `${input.ownerName}の巣に、匿名で卵（質問）を投げよう。`,
  );
  const owner = escapeHtml(input.ownerName);
  const canonical = escapeHtml(assertHttpUrl(input.canonicalUrl));
  const ogImage = escapeHtml(assertHttpUrl(input.ogImageUrl));
  const scripts = input.scripts.map(assertAssetRef);
  const styles = input.styles.map(assertAssetRef);

  if (!/^npub1[a-z0-9]+$/.test(input.npub)) throw new Error(`Refusing bad npub: ${input.npub}`);
  if (!/^[a-z0-9-]{1,13}$/.test(input.nestId)) throw new Error(`Refusing bad nest id: ${input.nestId}`);

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
<title>${title} | Egg of Ostriches</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Egg of Ostriches">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${ogImage}">
<meta name="egg:npub" content="${escapeHtml(input.npub)}">
<meta name="egg:id" content="${escapeHtml(input.nestId)}">
${styleTags}
${scriptTags}
</head>
<body>
<div id="root"></div>
<noscript>
  <div style="max-width:40rem;margin:0 auto;padding:1.5rem;font-family:system-ui,sans-serif">
    <h1>${title}</h1>
    <p>${owner}の巣です。卵を投げるにはJavaScriptを有効にしてください。</p>
  </div>
</noscript>
</body>
</html>
`;
}
