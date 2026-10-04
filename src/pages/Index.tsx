import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { nip19 } from 'nostr-tools';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EggShape } from '@/components/egg/EggShape';
import { Layout } from '@/components/egg/Layout';
import { Ostrich } from '@/components/egg/Ostrich';
import { OwnerInbox } from '@/components/egg/OwnerInbox';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNest } from '@/hooks/useEggs';
import { NEST_ID } from '@/lib/egg';

const Index = () => {
  useSeoMeta({
    title: 'Egg of Ostriches — 匿名の卵を投げ合おう',
    description: 'ログイン不要・完全匿名で、質問（卵）を投げられる質問箱。',
  });
  const { user } = useCurrentUser();
  const myNest = useNest(user?.pubkey, NEST_ID);
  // One nest per user: once it exists the "open" button gives way to its inbox.
  const canOpenNest = !user || (!myNest.isLoading && !myNest.data);

  return (
    <Layout>
      {/* hero */}
      <section className="relative grid items-center gap-8 pt-6 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <h1 className="text-4xl font-black leading-[1.15] sm:text-5xl">
            ダチョウの巣に、
            <br />
            <span className="relative inline-block -rotate-2 bg-primary px-2 text-primary-foreground">匿名の卵</span>
            を
            <br />
            投げつけ合おう。
          </h1>
          <p className="max-w-xl text-lg">ログイン不要・完全匿名で、質問（卵）を投げられる質問箱。</p>
          {canOpenNest && (
            <div className="flex flex-wrap gap-3">
              <Button asChild className="sticker h-14 rounded-full px-8 text-lg font-black transition-transform hover:-rotate-2 hover:scale-105">
                <Link to="/new">質問箱を開く</Link>
              </Button>
            </div>
          )}
        </div>
        <div className="relative mx-auto h-72 w-72 sm:h-80 sm:w-80">
          <Ostrich className="absolute inset-0 h-full w-full" />
          <EggShape className="absolute -bottom-2 left-2 h-20 w-16 motion-safe:animate-wobble" />
          <EggShape className="absolute right-0 bottom-6 h-14 w-12 rotate-12 motion-safe:animate-float" />
          <EggShape state="cracked" className="absolute -top-2 left-10 h-12 w-10 -rotate-12 motion-safe:animate-float" />
        </div>
      </section>

      {user && myNest.isLoading && <Skeleton className="mt-16 h-48 rounded-3xl" />}
      {user && myNest.data && <MyNestInbox pubkey={user.pubkey} title={myNest.data.title} />}
    </Layout>
  );
};

/** Your nest's eggs right on the home page: answer or crack them without leaving. */
function MyNestInbox({ pubkey, title }: { pubkey: string; title: string }) {
  const author = useAuthor(pubkey);
  const meta = author.data?.metadata;
  const npub = nip19.npubEncode(pubkey);
  const ownerName = meta?.display_name || meta?.name || npub.slice(0, 12) + '…';
  return (
    <section className="mt-16 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-muted-foreground">あなたの質問箱</p>
          <h2 className="truncate text-3xl font-black">
            <Link to={`/${npub}`} className="hover:underline">
              {title}
            </Link>
          </h2>
        </div>
      </div>
      <OwnerInbox owner={pubkey} nestId={NEST_ID} ownerName={ownerName} />
    </section>
  );
}

export default Index;
