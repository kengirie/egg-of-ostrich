import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** The nest's nsite URL with copy + open buttons. */
export function ShareLink({ url, label = 'あなたの巣のリンク' }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — the URL is still selectable below.
    }
  };
  return (
    <div className="sticker-sm rounded-2xl bg-shell p-3">
      <p className="text-xs font-extrabold text-muted-foreground">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all text-sm font-bold">{url}</code>
        <Button type="button" size="sm" onClick={copy} className="rounded-full font-bold">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'コピーした' : 'コピー'}
        </Button>
        <Button asChild size="sm" variant="outline" className="rounded-full font-bold">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" /> 開く
          </a>
        </Button>
      </div>
    </div>
  );
}
