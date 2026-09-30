import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { nip19 } from 'nostr-tools';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EggShape } from '@/components/egg/EggShape';
import { Layout } from '@/components/egg/Layout';
import { Ostrich } from '@/components/egg/Ostrich';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useMyNests, useRecentHatches, type RecentHatch } from '@/hooks/useEggs';
import { nestGatewayUrl } from '@/lib/siteConfig';
import { timeAgo } from '@/lib/time';

const Index = () => {
  useSeoMeta({
    title: 'Egg of Ostriches — 匿名の卵を投げ合おう',
    description: 'ダチョウの巣に、匿名の卵（質問）を投げ合うNostrの質問箱。巣のリンクはNIP-5Aのnsiteとして発行されます。',
  });
  const { user } = useCurrentUser();

  return (
    <Layout>
      {/* hero */}
      <section className="relative grid items-center gap-8 pt-6 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <p className="sticker-sm inline-block -rotate-3 rounded-full bg-secondary px-4 py-1 font-extrabold text-secondary-foreground">
            完全匿名 × Nostr × nsite
          </p>
          <h1 className="text-5xl font-black leading-[1.1] sm:text-6xl">
            ダチョウの巣に、
            <br />
            <span className="relative inline-block -rotate-2 bg-primary px-2 text-primary-foreground">匿名の卵</span>
            を
            <br />
            投げつけ合おう。
          </h1>
          <p className="max-w-xl text-lg">
            卵＝質問。投げる人はログイン不要、使い捨ての鍵で完全匿名。巣の主があたためて回答すると、卵が孵ります。
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="sticker h-14 rounded-full px-8 text-lg font-black transition-transform hover:-rotate-2 hover:scale-105">
              <Link to="/new">🪺 巣をつくる</Link>
            </Button>
          </div>
        </div>
        <div className="relative mx-auto h-72 w-72 sm:h-80 sm:w-80">
          <Ostrich className="absolute inset-0 h-full w-full" />
          <EggShape className="absolute -bottom-2 left-2 h-20 w-16 motion-safe:animate-wobble" />
          <EggShape className="absolute right-0 bottom-6 h-14 w-12 rotate-12 motion-safe:animate-float" />
          <EggShape state="cracked" className="absolute -top-2 left-10 h-12 w-10 -rotate-12 motion-safe:animate-float" />
        </div>
      </section>

      {/* how */}
      <section className="mt-16 grid gap-5 sm:grid-cols-3">
        {[
          { icon: <span className="text-4xl">🪺</span>, title: '巣をつくる', body: 'Nostrでログインして巣を公開。巣はそのままnsiteになり、専用リンクが発行されます。' },
          { icon: <EggShape className="h-12 w-10" />, title: '卵を投げる', body: 'リンクを開いた人が質問を書いて投げるだけ。ログイン不要・完全匿名。' },
          { icon: <EggShape state="hatched" className="h-12 w-10" />, title: '孵す', body: '巣の主が回答すると卵が孵って、みんなに見えるようになります。' },
        ].map((c, i) => (
          <div key={c.title} className={`sticker rounded-3xl bg-card p-5 ${i % 2 ? 'rotate-1' : '-rotate-1'}`}>
            <div className="flex h-12 items-center">{c.icon}</div>
            <h2 className="mt-3 text-xl font-black">
              {i + 1}. {c.title}
            </h2>
            <p className="mt-1">{c.body}</p>
          </div>
        ))}
      </section>

      {user && <MyNests pubkey={user.pubkey} />}
      <RecentHatches />
    </Layout>
  );
};

function MyNests({ pubkey }: { pubkey: string }) {
  const nests = useMyNests(pubkey);
  const npub = nip19.npubEncode(pubkey);
  return (
    <section className="mt-16">
      <h2 className="text-2xl font-black">あなたの巣</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {nests.isLoading && <Skeleton className="h-24 rounded-3xl" />}
        {nests.data?.length === 0 && (
          <div className="rounded-3xl border-[3px] border-dashed border-border p-6 text-center font-bold text-muted-foreground sm:col-span-2">
            まだ巣がありません。<Link to="/new" className="text-primary underline">ひとつつくろう</Link>
          </div>
        )}
        {nests.data?.map((nest) => (
          <div key={nest.id} className="sticker flex items-center gap-4 rounded-3xl bg-card p-4">
            <EggShape className="h-14 w-12 shrink-0" />
            <div className="min-w-0 flex-1">
              <Link to={`/${npub}/${nest.id}`} className="block truncate text-lg font-extrabold hover:underline">
                {nest.title}
              </Link>
              <a
                href={nestGatewayUrl(pubkey, nest.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-sm text-muted-foreground hover:underline"
              >
                nsiteで開く ↗
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentHatches() {
  const hatches = useRecentHatches();
  if (!hatches.isLoading && !hatches.data?.length) return null;
  return (
    <section className="mt-16">
      <h2 className="text-2xl font-black">さいきん孵った卵 🐣</h2>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        {hatches.isLoading
          ? [0, 1].map((i) => <Skeleton key={i} className="h-36 rounded-3xl" />)
          : hatches.data!.map((h, i) => <RecentHatchCard key={`${h.owner}${h.nestId}${h.createdAt}`} hatch={h} index={i} />)}
      </div>
    </section>
  );
}

function RecentHatchCard({ hatch, index }: { hatch: RecentHatch; index: number }) {
  const author = useAuthor(hatch.owner);
  const name = author.data?.metadata?.display_name || author.data?.metadata?.name || 'ダチョウ';
  return (
    <Link
      to={`/${nip19.npubEncode(hatch.owner)}/${hatch.nestId}`}
      className={`sticker block rounded-3xl bg-card p-5 transition-transform hover:rotate-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring ${index % 2 ? 'rotate-1' : '-rotate-1'}`}
    >
      <p className="line-clamp-3 font-extrabold break-words">🥚 {hatch.question}</p>
      <p className="mt-3 line-clamp-3 rounded-2xl bg-secondary px-3 py-2 break-words text-secondary-foreground">🐣 {hatch.answer}</p>
      <p className="mt-2 text-xs font-bold text-muted-foreground">
        {name} の巣 · {timeAgo(hatch.createdAt)}
      </p>
    </Link>
  );
}

export default Index;
