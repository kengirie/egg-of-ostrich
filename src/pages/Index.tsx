import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { nip19 } from 'nostr-tools';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EggShape } from '@/components/egg/EggShape';
import { Layout } from '@/components/egg/Layout';
import { Ostrich } from '@/components/egg/Ostrich';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNest } from '@/hooks/useEggs';
import { NEST_ID } from '@/lib/egg';
import { nestGatewayUrl } from '@/lib/siteConfig';

const Index = () => {
  useSeoMeta({
    title: 'Egg of Ostriches — 匿名の卵を投げ合おう',
    description: 'ログイン不要・完全匿名で、質問（卵）を投げられる質問箱。',
  });
  const { user } = useCurrentUser();

  return (
    <Layout>
      {/* hero */}
      <section className="relative grid items-center gap-8 pt-6 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <h1 className="text-5xl font-black leading-[1.1] sm:text-6xl">
            ダチョウの巣に、
            <br />
            <span className="relative inline-block -rotate-2 bg-primary px-2 text-primary-foreground">匿名の卵</span>
            を
            <br />
            投げつけ合おう。
          </h1>
          <p className="max-w-xl text-lg">ログイン不要・完全匿名で、質問（卵）を投げられる質問箱。</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="sticker h-14 rounded-full px-8 text-lg font-black transition-transform hover:-rotate-2 hover:scale-105">
              <Link to="/new">質問箱を開く</Link>
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

      {user && <MyNest pubkey={user.pubkey} />}
    </Layout>
  );
};

function MyNest({ pubkey }: { pubkey: string }) {
  const nest = useNest(pubkey, NEST_ID);
  const npub = nip19.npubEncode(pubkey);
  return (
    <section className="mt-16">
      <h2 className="text-2xl font-black">あなたの質問箱</h2>
      <div className="mt-4">
        {nest.isLoading ? (
          <Skeleton className="h-24 rounded-3xl" />
        ) : !nest.data ? (
          <div className="rounded-3xl border-[3px] border-dashed border-border p-6 text-center font-bold text-muted-foreground">
            まだ質問箱がありません。<Link to="/new" className="text-primary underline">開いてみよう</Link>
          </div>
        ) : (
          <div className="sticker flex flex-wrap items-center gap-4 rounded-3xl bg-card p-4">
            <EggShape className="h-14 w-12 shrink-0" />
            <div className="min-w-0 flex-1">
              <Link to={`/${npub}`} className="block truncate text-lg font-extrabold hover:underline">
                {nest.data.title}
              </Link>
              <a
                href={nestGatewayUrl(pubkey)}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-sm text-muted-foreground hover:underline"
              >
                nsiteで開く ↗
              </a>
            </div>
            <Link to="/new" className="text-sm font-extrabold text-primary underline">
              編集
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

export default Index;
