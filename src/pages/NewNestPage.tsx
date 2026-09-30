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
import { usePublishNest, type PublishStep } from '@/hooks/usePublishNest';
import { isValidNestId } from '@/lib/egg';
import { renderNestOgImage } from '@/lib/ogImage';
import { cn } from '@/lib/utils';

function randomNestId(): string {
  return `egg-${Math.random().toString(36).slice(2, 7)}`;
}

const STEPS: { key: PublishStep; label: string }[] = [
  { key: 'drawing', label: '巣の看板（OG画像）を描いています' },
  { key: 'mirroring', label: '巣材（アプリ本体）を運んでいます' },
  { key: 'uploading', label: '巣をBlossomに設置しています' },
  { key: 'announcing', label: 'サバンナ中（リレー）に知らせています' },
];

export default function NewNestPage() {
  useSeoMeta({ title: '巣をつくる | Egg of Ostriches' });
  const { user } = useCurrentUser();
  const author = useAuthor(user?.pubkey);
  const ownerName = author.data?.metadata?.display_name || author.data?.metadata?.name || '名無しのダチョウ';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [nestId, setNestId] = useState(randomNestId);
  const [preview, setPreview] = useState<string>();
  const { step, error, result, failedServers, publish, reset } = usePublishNest();

  const effectiveTitle = title.trim() || `${ownerName}の巣`;
  const idValid = isValidNestId(nestId);
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
          <h1 className="mt-4 text-2xl font-extrabold">巣をつくるにはログイン</h1>
          <p className="mt-2 text-muted-foreground">
            巣はあなたのNostrの鍵で公開されます。卵を投げる側はログイン不要・完全匿名です。
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
          <h1 className="text-3xl font-black">巣ができた！</h1>
          <p className="text-muted-foreground">
            このリンクをシェアすれば、誰でも匿名で卵（質問）を投げこめます。ゲートウェイへの反映に少し時間がかかることがあります。
          </p>
          <ShareLink url={result.gatewayUrl} />
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild className="sticker-sm rounded-full font-extrabold">
              <Link to={`/${result.npub}/${result.nestId}`}>巣をのぞく（回答はここから）</Link>
            </Button>
            <Button variant="outline" className="sticker-sm rounded-full font-bold" onClick={() => { reset(); setNestId(randomNestId()); }}>
              もうひとつつくる
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!idValid || busy) return;
    publish({ id: nestId, title: effectiveTitle, description: description.trim(), ownerName });
  };

  return (
    <Layout>
      <h1 className="mt-4 -rotate-1 text-4xl font-black sm:text-5xl">巣をつくる 🪺</h1>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1fr]">
        <form onSubmit={onSubmit} className="sticker space-y-5 rounded-3xl bg-card p-6">
          <div className="space-y-2">
            <label htmlFor="nest-title" className="block font-extrabold">巣の名前</label>
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
          <div className="space-y-2">
            <label htmlFor="nest-id" className="block font-extrabold">巣ID（リンクの一部）</label>
            <Input
              id="nest-id"
              value={nestId}
              onChange={(e) => setNestId(e.target.value.toLowerCase())}
              aria-invalid={!idValid}
              maxLength={13}
              className="sticker-sm h-12 rounded-2xl bg-shell font-mono"
            />
            <p className={cn('text-sm', idValid ? 'text-muted-foreground' : 'font-bold text-destructive')}>
              小文字英数字とハイフン、13文字まで（末尾ハイフン不可）。同じIDで作り直すと巣が上書きされ、卵はそのまま残ります。
            </p>
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
            disabled={!idValid || busy}
            className="sticker-sm h-12 w-full rounded-full text-lg font-extrabold transition-transform hover:-rotate-1 hover:scale-[1.02]"
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : '🪺'} 巣を公開する
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
            巣はNIP-5Aのnsiteとして公開され、<code>https://〈あなた〉{nestId}.nwb.tf/</code> がそのまま質問箱のリンクになります。
          </p>
        </div>
      </div>
    </Layout>
  );
}
