import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { Check, Loader2 } from 'lucide-react';
import { LoginArea } from '@/components/auth/LoginArea';
import { Button } from '@/components/ui/button';
import { EggShape } from '@/components/egg/EggShape';
import { Layout } from '@/components/egg/Layout';
import { NestNoteForm } from '@/components/egg/NestNoteForm';
import { Ostrich } from '@/components/egg/Ostrich';
import { ShareLink } from '@/components/egg/ShareLink';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNest } from '@/hooks/useEggs';
import { usePublishNest, type PublishStep } from '@/hooks/usePublishNest';
import { NEST_ID } from '@/lib/egg';
import { cn } from '@/lib/utils';

const STEPS: { key: PublishStep; label: string }[] = [
  { key: 'drawing', label: '巣の看板（OG画像）を描いています' },
  { key: 'mirroring', label: '巣材（アプリ本体）を運んでいます' },
  { key: 'uploading', label: '巣をBlossomに設置しています' },
  { key: 'announcing', label: 'サバンナ中（リレー）に知らせています' },
];

/** How long to wait for the user's profile name before naming the nest with the fallback. */
const NAME_WAIT_MS = 3000;

/**
 * "質問箱を開く": no form. Log in, and the user's one nest is built right away,
 * titled `<name>の巣`. Users who already have a nest are sent back home, where
 * their questions are listed.
 */
export default function NewNestPage() {
  useSeoMeta({ title: '質問箱を開く | Egg of Ostriches' });
  const { user } = useCurrentUser();
  const author = useAuthor(user?.pubkey);
  const existing = useNest(user?.pubkey, NEST_ID);
  const { step, error, result, failedServers, publish, reset } = usePublishNest();

  // Give the profile (kind 0) a moment to arrive so the nest gets a real name;
  // useAuthor retries for a while when there is no profile at all.
  const [nameWaitOver, setNameWaitOver] = useState(false);
  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => setNameWaitOver(true), NAME_WAIT_MS);
    return () => clearTimeout(timer);
  }, [user]);
  const nameReady = author.isSuccess || author.isError || nameWaitOver;
  const ownerName = author.data?.metadata?.display_name || author.data?.metadata?.name || '名無しのダチョウ';

  // Build the nest exactly once, as soon as we know there isn't one yet.
  const started = useRef(false);
  const needsNest = Boolean(user) && existing.isSuccess && !existing.data;
  useEffect(() => {
    if (!needsNest || !nameReady || started.current) return;
    started.current = true;
    publish({ title: `${ownerName}の巣`, description: '', ownerName });
  }, [needsNest, nameReady, ownerName, publish]);

  if (!user) {
    return (
      <Layout>
        <div className="sticker mx-auto mt-10 max-w-lg rounded-3xl bg-card p-8 text-center">
          <Ostrich className="mx-auto h-40 w-36" />
          <h1 className="mt-4 text-2xl font-extrabold">質問箱を開くにはログイン</h1>
          <p className="mt-2 text-muted-foreground">
            ログインすると、すぐにあなたの質問箱ができます。卵を投げる側はログイン不要・完全匿名です。
          </p>
          <LoginArea className="mt-6" />
        </div>
      </Layout>
    );
  }

  if (step === 'done' && result) {
    return (
      <Layout>
        <div className="sticker mx-auto mt-6 max-w-2xl space-y-5 rounded-3xl bg-card p-6 text-center sm:p-8">
          <div className="flex items-end justify-center gap-2">
            <Ostrich className="h-40 w-36" />
            <EggShape className="h-20 w-16 motion-safe:animate-wobble" />
          </div>
          <h1 className="text-3xl font-black">質問箱ができた！</h1>
          <p className="text-muted-foreground">
            このリンクをシェアすれば、誰でも匿名で卵（質問）を投げこめます。ゲートウェイへの反映に少し時間がかかることがあります。
          </p>
          <ShareLink url={result.gatewayUrl} label="あなたの質問箱のリンク" />
          <NestNoteForm nestUrl={result.gatewayUrl} />
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild className="sticker-sm rounded-full font-extrabold">
              <Link to="/">質問一覧へ（回答はここから）</Link>
            </Button>
            <Button asChild variant="outline" className="sticker-sm rounded-full font-bold">
              <Link to={`/${result.npub}`}>訪問者から見た質問箱</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  // One nest per user: someone who already has one has nothing to open here.
  if (existing.data && step === 'idle') return <Navigate to="/" replace />;

  const current = STEPS.findIndex((s) => s.key === step);
  return (
    <Layout>
      <div className="sticker mx-auto mt-10 max-w-lg space-y-5 rounded-3xl bg-card p-8">
        <div className="text-center">
          <Ostrich className="mx-auto h-36 w-32" mood={step === 'error' ? 'shock' : 'happy'} />
          <h1 className="mt-4 text-2xl font-extrabold">
            {step === 'error' ? '巣づくりに失敗しました' : 'あなたの質問箱をつくっています…'}
          </h1>
        </div>

        {step === 'error' ? (
          <div className="space-y-4 text-center">
            <p role="alert" className="rounded-2xl bg-destructive/10 p-3 font-bold text-destructive break-words">
              {error}
            </p>
            <Button
              className="sticker-sm rounded-full font-extrabold"
              onClick={() => {
                reset();
                publish({ title: `${ownerName}の巣`, description: '', ownerName });
              }}
            >
              もう一度つくる
            </Button>
          </div>
        ) : (
          <ol className="space-y-2 rounded-2xl bg-muted p-4" aria-live="polite">
            {STEPS.map((s, i) => (
              <li key={s.key} className={cn('flex items-center gap-2 font-bold', i > current && current >= 0 && 'opacity-40', current < 0 && i > 0 && 'opacity-40')}>
                {i < current ? (
                  <Check className="size-4 text-primary" />
                ) : i === current || (current < 0 && i === 0) ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <span className="inline-block size-4 text-center">·</span>
                )}{' '}
                {s.label}
              </li>
            ))}
          </ol>
        )}
        {failedServers.length > 0 && (
          <p className="text-sm text-muted-foreground">一部のBlossomサーバーが受け付けませんでした: {failedServers.join(', ')}</p>
        )}
      </div>
    </Layout>
  );
}
