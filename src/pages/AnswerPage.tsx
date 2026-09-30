import { Link, useParams } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { nip19 } from 'nostr-tools';
import { Skeleton } from '@/components/ui/skeleton';
import { AnswerLink } from '@/components/egg/EggCards';
import { EggShape } from '@/components/egg/EggShape';
import { Layout } from '@/components/egg/Layout';
import { Ostrich } from '@/components/egg/Ostrich';
import { ThrowEggForm } from '@/components/egg/ThrowEggForm';
import { useAuthor } from '@/hooks/useAuthor';
import { useClutch, useNest } from '@/hooks/useEggs';
import { decodeNpub, isValidNestId } from '@/lib/egg';
import { sanitizeUrl } from '@/lib/sanitizeUrl';
import { getNestSiteTarget, isAnswerSlug } from '@/lib/siteConfig';
import { timeAgo } from '@/lib/time';
import NotFound from './NotFound';

/**
 * One answered egg: the question big, the owner's answer, and a box to throw
 * your own egg. Served at `/a/<slug>.html` on a nest's nsite (the page the kind
 * 1 answer note links to) and at `/<npub>/<nest-id>/a/<slug>` in the app.
 */
export default function AnswerPage(props: { npub?: string; nestId?: string; slug?: string }) {
  const params = useParams<{ npub: string; nestId: string; slug: string }>();
  const npub = props.npub ?? params.npub;
  const nestId = props.nestId ?? params.nestId;
  const slug = props.slug ?? params.slug;
  const owner = decodeNpub(npub);

  if (!owner || !npub || !nestId || !isValidNestId(nestId) || !slug || !isAnswerSlug(slug)) return <NotFound />;
  return <Answer owner={owner} npub={npub} nestId={nestId} slug={slug} />;
}

function Answer({ owner, npub, nestId, slug }: { owner: string; npub: string; nestId: string; slug: string }) {
  const nest = useNest(owner, nestId);
  const clutch = useClutch(owner, nestId);
  const author = useAuthor(owner);
  const meta = author.data?.metadata;
  const ownerName = meta?.display_name || meta?.name || nip19.npubEncode(owner).slice(0, 12) + '…';
  const avatar = sanitizeUrl(meta?.picture);
  const nestTitle = nest.data?.title ?? `${ownerName}の巣`;
  const egg = clutch.data?.find((e) => e.id.startsWith(slug));

  // On the nest's own site the nest lives at "/".
  const target = getNestSiteTarget();
  const nestPath = target && target.npub === npub && target.nestId === nestId ? '/' : `/${npub}/${nestId}`;

  useSeoMeta({
    title: `${ownerName}の巣に届いた卵 | ${nestTitle} | Egg of Ostriches`,
    description: egg?.hatch?.content ?? egg?.content ?? `${ownerName}の巣に届いた匿名の卵（質問）と回答。`,
  });

  if (nest.isLoading || clutch.isLoading) {
    return (
      <Layout>
        <div className="space-y-4 pt-6">
          <Skeleton className="h-16 w-64 rounded-full" />
          <Skeleton className="h-56 w-full rounded-3xl" />
          <Skeleton className="h-32 w-full rounded-3xl" />
        </div>
      </Layout>
    );
  }

  if (!nest.data || !egg) {
    return (
      <Layout>
        <div className="sticker mx-auto mt-10 max-w-lg rounded-3xl bg-card p-8 text-center">
          <Ostrich className="mx-auto h-40 w-36" mood="shock" />
          <h1 className="mt-4 text-2xl font-extrabold">{nest.data ? '卵が見つからない！' : '巣が見つからない！'}</h1>
          <p className="mt-2 text-muted-foreground">
            {nest.data
              ? 'この卵は割られてしまったか、まだリレーに届いていないようです。'
              : 'ダチョウが砂に頭を突っこんで探していますが、この巣はまだリレーに届いていないようです。少し待ってから再読み込みしてみてください。'}
          </p>
          {nest.data ? (
            <Link to={nestPath} className="mt-6 inline-block font-extrabold text-primary underline">
              {nestTitle} へ行く →
            </Link>
          ) : (
            <Link to="/new" className="mt-6 inline-block font-extrabold text-primary underline">
              自分の巣をつくる →
            </Link>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="mt-4 space-y-6">
        <Link to={nestPath} className="inline-flex items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring">
          {avatar ? (
            <img src={avatar} alt="" className="sticker-sm size-12 rounded-full bg-muted object-cover" />
          ) : (
            <div className="sticker-sm grid size-12 place-items-center rounded-full bg-secondary text-xl">🐦</div>
          )}
          <span className="min-w-0">
            <span className="block text-lg font-extrabold hover:underline">{ownerName} の巣</span>
            <span className="block truncate text-sm font-bold text-muted-foreground">{nestTitle}</span>
          </span>
        </Link>

        {/* the question, egg style */}
        <article className="sticker relative -rotate-1 rounded-[3rem] bg-shell px-6 py-8 sm:px-10">
          <div className="flex items-start gap-4 sm:gap-6">
            <EggShape
              state={egg.hatch ? 'hatched' : 'whole'}
              className={egg.hatch ? 'h-24 w-20 shrink-0' : 'h-24 w-20 shrink-0 motion-safe:animate-wobble'}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-muted-foreground">匿名の卵 · {timeAgo(egg.createdAt)}</p>
              <h1 className="mt-2 whitespace-pre-wrap break-words text-3xl font-black leading-snug sm:text-4xl">
                {egg.content}
              </h1>
            </div>
          </div>
        </article>

        {egg.hatch ? (
          <article className="flex items-start gap-3 motion-safe:animate-hatch sm:gap-4">
            {avatar ? (
              <img src={avatar} alt="" className="sticker-sm size-12 shrink-0 rounded-full bg-muted object-cover" />
            ) : (
              <EggShape state="hatched" className="h-12 w-10 shrink-0" />
            )}
            <div className="sticker relative min-w-0 flex-1 rotate-[0.5deg] rounded-3xl bg-secondary px-5 py-4 text-secondary-foreground">
              <p className="text-sm font-bold opacity-80">
                {ownerName} が孵した · {timeAgo(egg.hatch.createdAt)}
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words text-lg">{egg.hatch.content}</p>
              <AnswerLink url={egg.hatch.url} className="mt-3" />
            </div>
          </article>
        ) : (
          <div className="rounded-3xl border-[3px] border-dashed border-border px-6 py-8 text-center">
            <Ostrich className="mx-auto h-24 w-20" bobbing={false} />
            <p className="mt-3 text-lg font-extrabold">まだ孵っていません</p>
            <p className="mt-1 font-bold text-muted-foreground">{ownerName} がこの卵をあたため中です。</p>
          </div>
        )}
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="text-2xl font-black">あなたも卵を投げてみる？</h2>
        <ThrowEggForm owner={owner} nestId={nestId} />
        <p className="text-center font-extrabold">
          <Link to={nestPath} className="text-primary underline underline-offset-4">
            🪺 {nestTitle} のほかの卵を見る
          </Link>
        </p>
      </section>
    </Layout>
  );
}
