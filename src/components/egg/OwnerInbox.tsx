import { useMemo, useState } from 'react';
import { useClutch } from '@/hooks/useEggs';
import { nestGatewayUrl } from '@/lib/siteConfig';
import { cn } from '@/lib/utils';
import { ClutchList } from './ClutchList';
import { OwnerEggCard } from './EggCards';
import { ShareLink } from './ShareLink';

/**
 * The nest owner's inbox: the share link, then the eggs split into
 * 温め中 (unanswered — answer or crack them here) and 孵った (answered).
 * Shown on the owner's own nest page and on the home page.
 */
export function OwnerInbox({ owner, nestId, ownerName }: { owner: string; nestId: string; ownerName: string }) {
  const clutch = useClutch(owner, nestId);
  const [tab, setTab] = useState<'warm' | 'hatched'>('warm');
  const eggs = useMemo(() => clutch.data ?? [], [clutch.data]);
  const hatched = eggs.filter((e) => e.hatch);
  const warm = eggs.filter((e) => !e.hatch);

  return (
    <div className="space-y-6">
      <ShareLink url={nestGatewayUrl(owner)} label="この巣のリンク（シェアして卵を集めよう）" />
      <div role="tablist" className="flex flex-wrap gap-2">
        {(['warm', 'hatched'] as const).map((key) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'sticker-sm rounded-full px-4 py-2 font-extrabold transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring',
              tab === key ? 'bg-primary text-primary-foreground -rotate-2' : 'bg-card hover:-rotate-1',
            )}
          >
            {key === 'warm' ? `温め中の卵 (${warm.length})` : `孵った卵 (${hatched.length})`}
          </button>
        ))}
      </div>
      <ClutchList
        loading={clutch.isLoading}
        error={clutch.isError}
        onRetry={() => clutch.refetch()}
        empty={tab === 'warm' ? 'まだ卵がありません。リンクをシェアして投げてもらおう！' : 'まだ孵った卵はありません。'}
      >
        {(tab === 'warm' ? warm : hatched).map((egg) => (
          <OwnerEggCard key={egg.id} egg={egg} nestId={nestId} ownerName={ownerName} onHatched={() => setTab('hatched')} />
        ))}
      </ClutchList>
    </div>
  );
}
