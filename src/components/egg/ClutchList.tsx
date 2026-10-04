import { Skeleton } from '@/components/ui/skeleton';
import { EggShape } from './EggShape';
import { Ostrich } from './Ostrich';

/** A list of egg cards with loading, error (retry) and empty states. */
export function ClutchList({
  loading,
  error,
  onRetry,
  empty,
  children,
}: {
  loading: boolean;
  error?: boolean;
  onRetry?: () => void;
  empty: string;
  children: React.ReactNode[];
}) {
  if (error && children.length === 0) {
    return (
      <div className="rounded-3xl border-[3px] border-dashed border-destructive px-6 py-10 text-center">
        <Ostrich className="mx-auto h-24 w-20" mood="shock" bobbing={false} />
        <p className="mt-3 font-bold">卵を探しに行ったダチョウが迷子になりました（リレーに届きませんでした）。</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-3 font-extrabold text-primary underline">
            もう一度探す
          </button>
        )}
      </div>
    );
  }
  if (loading) {
    return (
      <div className="grid gap-5">
        <Skeleton className="h-32 w-full rounded-3xl" />
        <Skeleton className="h-32 w-full rounded-3xl" />
      </div>
    );
  }
  if (children.length === 0) {
    return (
      <div className="rounded-3xl border-[3px] border-dashed border-border px-6 py-10 text-center">
        <EggShape className="mx-auto h-16 w-14 motion-safe:animate-wobble" />
        <p className="mt-3 font-bold text-muted-foreground">{empty}</p>
      </div>
    );
  }
  return <div className="grid gap-5">{children}</div>;
}
