import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import { Loader2 } from 'lucide-react';
import { LoginArea } from '@/components/auth/LoginArea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EggShape } from '@/components/egg/EggShape';
import { Layout } from '@/components/egg/Layout';
import { Ostrich } from '@/components/egg/Ostrich';
import { ShareLink } from '@/components/egg/ShareLink';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNest } from '@/hooks/useEggs';
import { usePublishNest, type PublishStep } from '@/hooks/usePublishNest';
import { NEST_ID } from '@/lib/egg';
import { renderNestOgImage } from '@/lib/ogImage';
import { nestGatewayUrl } from '@/lib/siteConfig';
import { cn } from '@/lib/utils';

const STEPS: { key: PublishStep; label: string }[] = [
  { key: 'drawing', label: '巣の看板（OG画像）を描いています' },
  { key: 'mirroring', label: '巣材（アプリ本体）を運んでいます' },
  { key: 'uploading', label: '巣をBlossomに設置しています' },
  { key: 'announcing', label: 'サバンナ中（リレー）に知らせています' },
];

/**
 * Open (or edit) the user's one question box. Re-publishing keeps the same
 * `d` (`nest`), so the link and every egg stay where they are.
 */
export default function NewNestPage() {
  const { user } = useCurrentUser();
  const author = useAuthor(user?.pubkey);
  const ownerName = author.data?.metadata?.display_name || author.data?.metadata?.name || '名無しのダチョウ';
  const existing = useNest(user?.pubkey, NEST_ID);
  const hasNest = Boolean(existing.data);
  useSeoMeta({ title: `${hasNest ? '質問箱を編集' : '質問箱を開く'} | Egg of Ostriches` });

  // null = untouched: show the current nest's values until the user types.
  const [titleInput, setTitle] = useState<string | null>(null);
  const [descriptionInput, setDescription] = useState<string | null>(null);
  const title = titleInput ?? existing.data?.title ?? '';
  const description = descriptionInput ?? existing.data?.description ?? '';
  const [preview, setPreview] = useState<string>();
  const { step, error, result, failedServers, publish, reset } = usePublishNest();
  // Whether this publish replaced an existing nest — captured at submit, since
  // the nest query refetches (and finds the new nest) right after publishing.
  const [wasUpdate, setWasUpdate] = useState(false);

  const effectiveTitle = title.trim() || `${ownerName}の巣`;
  const busy = STEPS.some((s) => s.key === step);

  // Live preview of the share card, debounced.
  useEffect(() => {
    let url: string | undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const blob = await renderNestOgImage({ title: effectiveTitle, ownerName });
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPreview(url);
      } catch {
        // Preview is cosmetic
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [effectiveTitle, ownerName]);

  if (!user) {
    return (
      <Layout>
        <div className="sticker mx-auto mt-10 max-w-lg rounded-3xl bg-card p-8 text-center">
          <Ostrich className="mx-auto h-40 w-36" />
          <h1 className="mt-4 text-2xl font-extrabold">質問箱を開くにはログイン</h1>
          <p className="mt-2 text-muted-foreground">
            質問箱はあなたのNostrの鍵で公開されます。卵を投げる側はログイン不要・完全匿名です。
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
          <h1 className="text-3xl font-black">{wasUpdate ? '質問箱を更新した！' : '質問箱ができた！'}</h1>
          <p className="text-muted-foreground">
            このリンクをシェアすれば、誰でも匿名で卵（質問）を投げこめます。ゲートウェイへの反映に少し時間がかかることがあります。
          </p>
          <ShareLink url={result.gatewayUrl} label="あなたの質問箱のリンク" />
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild className="sticker-sm rounded-full font-extrabold">
              <Link to={`/${result.npub}`}>質問箱をのぞく（回答はここから）</Link>
            </Button>
            <Button variant="outline" className="sticker-sm rounded-full font-bold" onClick={reset}>
              もう一度編集する
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setWasUpdate(hasNest);
    publish({ title: effectiveTitle, description: description.trim(), ownerName });
  };

  return (
    <Layout>
      <h1 className="mt-4 -rotate-1 text-4xl font-black sm:text-5xl">{hasNest ? '質問箱を編集 🪺' : '質問箱を開く 🪺'}</h1>
      {hasNest && (
        <p className="mt-3 font-bold text-muted-foreground">
          質問箱はひとり1つ。更新してもリンクと届いた卵はそのままです。
        </p>
      )}
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1fr]">
        <form onSubmit={onSubmit} className="sticker space-y-5 rounded-3xl bg-card p-6">
          <div className="space-y-2">
            <label htmlFor="nest-title" className="block font-extrabold">質問箱の名前</label>
            <Input
              id="nest-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`${ownerName}の巣`}
              maxLength={60}
              className="sticker-sm h-12 rounded-2xl bg-shell text-base"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="nest-desc" className="block font-extrabold">ひとこと</label>
            <Textarea
              id="nest-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="なんでも聞いてね。ダチョウが代わりに温めます。"
              maxLength={200}
              rows={3}
              className="sticker-sm rounded-2xl bg-shell"
            />
          </div>
          {busy && (
            <ol className="space-y-2 rounded-2xl bg-muted p-4" aria-live="polite">
              {STEPS.map((s, i) => {
                const current = STEPS.findIndex((x) => x.key === step);
                return (
                  <li key={s.key} className={cn('flex items-center gap-2 font-bold', i > current && 'opacity-40')}>
                    {i < current ? '✅' : i === current ? <Loader2 className="size-4 animate-spin" /> : '🥚'} {s.label}
                  </li>
                );
              })}
            </ol>
          )}
          {step === 'error' && (
            <p role="alert" className="rounded-2xl bg-destructive/10 p-3 font-bold text-destructive break-words">
              巣づくりに失敗しました：{error}
            </p>
          )}
          {failedServers.length > 0 && (
            <p className="text-sm text-muted-foreground">一部のBlossomサーバーが受け付けませんでした: {failedServers.join(', ')}</p>
          )}

          <Button
            type="submit"
            disabled={busy || existing.isLoading}
            className="sticker-sm h-12 w-full rounded-full text-lg font-extrabold transition-transform hover:-rotate-1 hover:scale-[1.02]"
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : '🪺'} {hasNest ? '質問箱を更新する' : '質問箱を公開する'}
          </Button>
        </form>

        <div className="space-y-3">
          <p className="font-extrabold">シェアしたときのカード</p>
          <div className="sticker overflow-hidden rounded-3xl bg-muted">
            {preview ? (
              <img src={preview} alt="シェアカードのプレビュー" className="aspect-[1200/630] w-full" />
            ) : (
              <div className="aspect-[1200/630] w-full animate-pulse" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            質問箱はNIP-5Aのnsiteとして公開され、<code className="break-all">{nestGatewayUrl(user.pubkey)}</code> がそのまま質問箱のリンクになります。
          </p>
        </div>
      </div>
    </Layout>
  );
}
