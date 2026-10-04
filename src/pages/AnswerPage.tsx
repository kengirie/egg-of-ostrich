import type { ReactNode } from 'react';
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
import { NEST_ID, decodeNpub, isAnswerSiteId } from '@/lib/egg';
import { sanitizeUrl } from '@/lib/sanitizeUrl';
import { getSiteTarget, nestGatewayUrl } from '@/lib/siteConfig';
import { timeAgo } from '@/lib/time';
import NotFound from './NotFound';

/**
 * One answered egg: the question big, the owner's answer, and a box to throw
 * your own egg. Served at "/" on the answer's own nsite (the link in the kind 1
 * answer note) and at `/<npub>/q<12 hex>` in the app.
 */
export default function AnswerPage(props: { npub?: string; eggId?: string }) {
  const params = useParams<{ npub: string; answerId: string }>();
  const npub = props.npub ?? params.npub;
  const owner = decodeNpub(npub);
  // The full egg id on an answer site; the 12-hex prefix from an in-app URL.
  const prefix = props.eggId ?? (params.answerId && isAnswerSiteId(params.answerId) ? params.answerId.slice(1) : undefined);

  if (!owner || !npub || !prefix || !/^[0-9a-f]{12,64}$/.test(prefix)) return <NotFound />;
  return <Answer owner={owner} npub={npub} prefix={prefix} />;
}

/** Link to the owner's nest: same-origin route in the app/nest site, the nest's nsite from an answer site. */
function NestLink({ owner, npub, className, children }: { owner: string; npub: string; className?: string; children: ReactNode }) {
  const target = getSiteTarget();
  if (target?.kind === 'answer') {
    return <a href={nestGatewayUrl(owner)} className={className}>{children}</a>;
  }
  const to = target?.kind === 'nest' && target.npub === npub ? '/' : `/${npub}`;
  return <Link to={to} className={className}>{children}</Link>;
}

function Answer({ owner, npub, prefix }: { owner: string; npub: string; prefix: string }) {
  const nestId = NEST_ID;
  const nest = useNest(owner, nestId);
  const clutch = useClutch(owner, nestId);
  const author = useAuthor(owner);
  const meta = author.data?.metadata;
  const ownerName = meta?.display_name || meta?.name || nip19.npubEncode(owner).slice(0, 12) + '…';
  const avatar = sanitizeUrl(meta?.picture);
  const nestTitle = nest.data?.title ?? `${ownerName}の巣`;
  const egg = clutch.data?.find((e) => e.id.startsWith(prefix));

  useSeoMeta({
    title: egg ? `${egg.content} | Egg of Ostriches` : `${nestTitle} | Egg of Ostriches`,
    description: egg?.hatch ? `${ownerName}さんの回答「${egg.hatch.content}」` : `${ownerName}の巣に届いた匿名の卵（質問）。`,
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
          <h1 className="mt-4 text-2xl font-extrabold">{nest.data ? '卵が見つからない！' : '質問箱が見つからない！'}</h1>
          <p className="mt-2 text-muted-foreground">
            {nest.data
              ? 'この卵は割られてしまったか、まだリレーに届いていないようです。'
              : 'ダチョウが砂に頭を突っこんで探していますが、この質問箱はまだリレーに届いていないようです。少し待ってから再読み込みしてみてください。'}
          </p>
          {nest.data ? (
            <NestLink owner={owner} npub={npub} className="mt-6 inline-block font-extrabold text-primary underline">
              {nestTitle} へ行く →
            </NestLink>
          ) : (
            <Link to="/new" className="mt-6 inline-block font-extrabold text-primary underline">
              自分の質問箱を開く →
            </Link>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="mt-4 space-y-6">
        <NestLink
          owner={owner}
          npub={npub}
          className="inline-flex items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
        >
          {avatar ? (
            <img src={avatar} alt="" className="sticker-sm size-12 rounded-full bg-muted object-cover" />
          ) : (
            <div className="sticker-sm grid size-12 place-items-center rounded-full bg-secondary text-xl">🐦</div>
          )}
          <span className="min-w-0">
            <span className="block text-lg font-extrabold hover:underline">{ownerName} の巣</span>
            <span className="block truncate text-sm font-bold text-muted-foreground">{nestTitle}</span>
          </span>
        </NestLink>

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
          <NestLink owner={owner} npub={npub} className="text-primary underline underline-offset-4">
            🪺 {nestTitle} のほかの卵を見る
          </NestLink>
        </p>
      </section>
    </Layout>
  );
}
