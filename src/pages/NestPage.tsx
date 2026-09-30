import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { nip19 } from 'nostr-tools';
import { Skeleton } from '@/components/ui/skeleton';
import { EggShape } from '@/components/egg/EggShape';
import { HatchedEggCard, OwnerEggCard, SealedEgg } from '@/components/egg/EggCards';
import { Layout } from '@/components/egg/Layout';
import { Ostrich } from '@/components/egg/Ostrich';
import { ShareLink } from '@/components/egg/ShareLink';
import { ThrowEggForm } from '@/components/egg/ThrowEggForm';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useClutch, useNest } from '@/hooks/useEggs';
import { decodeNpub, isValidNestId } from '@/lib/egg';
import { sanitizeUrl } from '@/lib/sanitizeUrl';
import { nestGatewayUrl } from '@/lib/siteConfig';
import { cn } from '@/lib/utils';
import NotFound from './NotFound';

export default function NestPage(props: { npub?: string; nestId?: string }) {
  const params = useParams<{ npub: string; nestId: string }>();
  const npub = props.npub ?? params.npub;
  const nestId = props.nestId ?? params.nestId;
  const owner = decodeNpub(npub);

  if (!owner || !nestId || !isValidNestId(nestId)) return <NotFound />;
  return <Nest owner={owner} nestId={nestId} />;
}

function Nest({ owner, nestId }: { owner: string; nestId: string }) {
  const { user } = useCurrentUser();
  const nest = useNest(owner, nestId);
  const clutch = useClutch(owner, nestId);
  const author = useAuthor(owner);
  const meta = author.data?.metadata;
  const ownerName = meta?.display_name || meta?.name || nip19.npubEncode(owner).slice(0, 12) + '…';
  const avatar = sanitizeUrl(meta?.picture);
  const isOwner = user?.pubkey === owner;
  const [tab, setTab] = useState<'warm' | 'hatched'>('warm');

  const eggs = useMemo(() => clutch.data ?? [], [clutch.data]);
  const hatched = eggs.filter((e) => e.hatch);
  const warm = eggs.filter((e) => !e.hatch);
  const title = nest.data?.title ?? `${ownerName}の巣`;

  useSeoMeta({
    title: `${title} | Egg of Ostriches`,
    description: nest.data?.description || `${ownerName}の巣に、匿名で卵（質問）を投げよう。`,
  });

  if (nest.isLoading) {
    return (
      <Layout>
        <div className="space-y-4 pt-6">
          <Skeleton className="h-40 w-full rounded-3xl" />
          <Skeleton className="h-48 w-full rounded-3xl" />
        </div>
      </Layout>
    );
  }

  if (!nest.data) {
    return (
      <Layout>
        <div className="sticker mx-auto mt-10 max-w-lg rounded-3xl bg-card p-8 text-center">
          <Ostrich className="mx-auto h-40 w-36" mood="shock" />
          <h1 className="mt-4 text-2xl font-extrabold">巣が見つからない！</h1>
          <p className="mt-2 text-muted-foreground">
            ダチョウが砂に頭を突っこんで探していますが、この巣はまだリレーに届いていないようです。少し待ってから再読み込みしてみてください。
          </p>
          <Link to="/new" className="mt-6 inline-block font-extrabold text-primary underline">
            自分の巣をつくる →
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* nest header */}
      <section className="relative mt-4 grid items-end gap-6 sm:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {avatar ? (
              <img src={avatar} alt="" className="sticker-sm size-14 rounded-full bg-muted object-cover" />
            ) : (
              <div className="sticker-sm grid size-14 place-items-center rounded-full bg-secondary text-2xl">🐦</div>
            )}
            <p className="text-lg font-extrabold">{ownerName} の巣</p>
          </div>
          <h1 className="-rotate-1 text-4xl font-black leading-tight break-words sm:text-5xl">{title}</h1>
          {nest.data.description && (
            <p className="max-w-2xl whitespace-pre-wrap break-words text-lg">{nest.data.description}</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1 text-sm font-extrabold">
            <span className="sticker-sm rounded-full bg-shell px-3 py-1">🥚 温め中 {warm.length}</span>
            <span className="sticker-sm rounded-full bg-secondary px-3 py-1">🐣 孵化 {hatched.length}</span>
          </div>
        </div>
        <Ostrich className="mx-auto hidden h-52 w-44 sm:block" />
      </section>

      {isOwner ? (
        <section className="mt-8 space-y-6">
          <ShareLink url={nestGatewayUrl(owner, nestId)} label="この巣のリンク（シェアして卵を集めよう）" />
          <div role="tablist" className="flex gap-2">
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
                {key === 'warm' ? `🥚 温め中の卵 (${warm.length})` : `🐣 孵った卵 (${hatched.length})`}
              </button>
            ))}
          </div>
          <ClutchList loading={clutch.isLoading} error={clutch.isError} onRetry={() => clutch.refetch()} empty={tab === 'warm' ? 'まだ卵がありません。リンクをシェアして投げてもらおう！' : 'まだ孵った卵はありません。'}>
            {(tab === 'warm' ? warm : hatched).map((egg) => (
              <OwnerEggCard key={egg.id} egg={egg} nestId={nestId} ownerName={ownerName} onHatched={() => setTab('hatched')} />
            ))}
          </ClutchList>
        </section>
      ) : (
        <section className="mt-8 space-y-8">
          <ThrowEggForm owner={owner} nestId={nestId} />

          {warm.length > 0 && (
            <div>
              <h2 className="text-xl font-extrabold">温め中の卵</h2>
              <div className="mt-3 flex flex-wrap gap-3">
                {warm.slice(0, 24).map((egg, i) => (
                  <SealedEgg key={egg.id} index={i} />
                ))}
                {warm.length > 24 && <span className="self-center font-extrabold">+{warm.length - 24}</span>}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-xl font-extrabold">孵った卵</h2>
            <div className="mt-4">
              <ClutchList loading={clutch.isLoading} error={clutch.isError} onRetry={() => clutch.refetch()} empty="まだ孵った卵はありません。最初の卵を投げてみよう！">
                {hatched.map((egg, i) => (
                  <HatchedEggCard key={egg.id} egg={egg} ownerName={ownerName} index={i} />
                ))}
              </ClutchList>
            </div>
          </div>

          <p className="text-center font-extrabold">
            <Link to="/new" className="text-primary underline underline-offset-4">
              🪺 自分の巣もつくる
            </Link>
          </p>
        </section>
      )}
    </Layout>
  );
}

function ClutchList({
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
