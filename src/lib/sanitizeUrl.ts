/** Returns canonical href for valid https:// URLs, undefined otherwise (nostr-security skill). */
export function sanitizeUrl(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}
