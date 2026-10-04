import { useState } from 'react';
import { Check, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useCrackEgg } from '@/hooks/useEggs';
import { usePublishAnswer, type AnswerStep, type PublishAnswerResult } from '@/hooks/usePublishAnswer';
import { useToast } from '@/hooks/useToast';
import { HATCH_MAX_LENGTH, type Egg } from '@/lib/egg';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';
import { EggShape } from './EggShape';
import { ShareLink } from './ShareLink';

const TILTS = ['rotate-1', '-rotate-1', 'rotate-[0.5deg]', '-rotate-[1.5deg]'];

/** A hatched egg: the anonymous question, and the owner's answer popping out. */
export function HatchedEggCard({ egg, ownerName, index = 0 }: { egg: Egg; ownerName: string; index?: number }) {
  return (
    <article className={cn('sticker rounded-3xl bg-card p-5 transition-transform hover:rotate-0', TILTS[index % TILTS.length])}>
      <div className="flex items-start gap-3">
        <EggShape state="whole" className="h-12 w-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-muted-foreground">匿名の卵 · {timeAgo(egg.createdAt)}</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-lg font-extrabold">{egg.content}</p>
        </div>
      </div>
      {egg.hatch && (
        <div className="mt-4 flex items-start gap-3 motion-safe:animate-hatch">
          <EggShape state="hatched" className="h-12 w-10 shrink-0" />
          <div className="sticker-sm relative min-w-0 flex-1 rounded-2xl bg-secondary px-4 py-3 text-secondary-foreground">
            <p className="text-xs font-bold opacity-80">{ownerName} が孵した · {timeAgo(egg.hatch.createdAt)}</p>
            <p className="mt-1 whitespace-pre-wrap break-words">{egg.hatch.content}</p>
            <AnswerLink url={egg.hatch.url} className="mt-2" />
          </div>
        </div>
      )}
    </article>
  );
}

/** "回答リンク": the answer's own nsite (its OGP card shows the question). `url` is already sanitized. */
export function AnswerLink({ url, className }: { url: string; className?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('inline-flex items-center gap-1 text-sm font-extrabold underline underline-offset-4', className)}
    >
      <ExternalLink className="size-3.5" /> 回答リンク
    </a>
  );
}

/** A still-warm egg as a visitor sees it: sealed. */
export function SealedEgg({ index }: { index: number }) {
  return (
    <div className="flex flex-col items-center gap-1" title="まだ温め中">
      <EggShape
        className="h-16 w-14 motion-safe:animate-wobble"
        label="温め中の卵"
      />
      <span className="sr-only">温め中の卵 {index + 1}</span>
    </div>
  );
}

const ANSWER_STEPS: { step: AnswerStep; label: string }[] = [
  { step: 'drawing', label: '質問の卵の絵を描いています' },
  { step: 'uploading', label: '回答ページをこしらえています' },
  { step: 'announcing', label: '回答ページをnsiteとして公開しています' },
  { step: 'waiting', label: 'ゲートウェイに回答ページが届くのを待っています' },
  { step: 'posting', label: 'タイムラインに孵しています' },
];

/** Playful checklist of the answer publish steps. */
function AnswerProgress({ step }: { step: AnswerStep }) {
  const current = ANSWER_STEPS.findIndex((s) => s.step === step);
  return (
    <ol className="sticker-sm space-y-1.5 rounded-2xl bg-shell px-4 py-3 text-sm font-bold" aria-live="polite">
      {ANSWER_STEPS.map(({ step: key, label }, i) => (
        <li
          key={key}
          className={cn('flex items-center gap-2', i > current && 'text-muted-foreground opacity-60')}
        >
          {i < current ? (
            <Check className="size-4 text-primary" />
          ) : i === current ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <span className="inline-block size-4 text-center">·</span>
          )}
          {label}
          {i === current && '…'}
        </li>
      ))}
    </ol>
  );
}

/**
 * Owner's view of an egg: hatch it (answer), re-answer it, or crack it (hide).
 * Hatching publishes the answer as its own nsite and posts a kind 1 note linking to it.
 */
export function OwnerEggCard({
  egg,
  nestId,
  ownerName,
  onHatched,
}: {
  egg: Egg;
  nestId: string;
  ownerName: string;
  /** Called after a successful answer (e.g. to jump to the hatched tab). */
  onHatched?: () => void;
}) {
  const [answer, setAnswer] = useState(egg.hatch?.content ?? '');
  const [open, setOpen] = useState(!egg.hatch);
  const hatch = usePublishAnswer(nestId);
  const crack = useCrackEgg(nestId);
  const { toast } = useToast();

  const onHatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await hatch.publish({ egg, content: answer, ownerName });
      // null = the answer site is up but the gateway is slow; the note is held.
      if (result) onPosted(result);
    } catch (err) {
      toast({ title: '孵化に失敗…', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    }
  };

  const onPosted = ({ variant }: PublishAnswerResult) => {
    setOpen(false);
    onHatched?.();
    toast({
      title: variant.golden ? 'レア！金色の卵のカードが出ました' : 'ピヨッ！卵が孵りました',
      description: '回答リンクつきの kind 1 ノートをタイムラインに投稿しました。',
    });
  };

  const onPostHeld = async (force: boolean) => {
    try {
      const result = await hatch.postNote({ force });
      if (result) onPosted(result);
    } catch (err) {
      toast({ title: '投稿に失敗…', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    }
  };

  const onCrack = async () => {
    try {
      await crack.mutateAsync(egg.id);
      toast({ title: 'グシャッ。卵を割りました（非表示）' });
    } catch (err) {
      toast({ title: '割れませんでした', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    }
  };

  const answerUrl = hatch.result?.answerUrl ?? egg.hatch?.url;

  const reopen = () => {
    hatch.reset();
    setOpen(true);
  };

  return (
    <article className="sticker rounded-3xl bg-card p-5">
      <div className="flex items-start gap-3">
        <EggShape state={egg.hatch ? 'hatched' : 'cracked'} className="h-12 w-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-muted-foreground">匿名の卵 · {timeAgo(egg.createdAt)}</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-lg font-extrabold">{egg.content}</p>
        </div>
      </div>

      {egg.hatch && !open && (
        <div className="mt-3 rounded-2xl bg-secondary px-4 py-3 text-secondary-foreground">
          <p className="whitespace-pre-wrap break-words">{egg.hatch.content}</p>
          <button type="button" onClick={reopen} className="mt-2 text-sm font-bold underline">
            回答を書き直す
          </button>
        </div>
      )}

      {answerUrl && !open && (
        <div className="mt-3 space-y-2">
          <ShareLink url={answerUrl} label="回答リンク（シェアすると回答カードが表示されます）" />
          {hatch.result && (
            <p className="text-sm font-bold text-muted-foreground motion-safe:animate-hatch">
              回答をこのリンクつきの kind 1 ノートとしてタイムラインに投稿しました。
            </p>
          )}
        </div>
      )}

      {open && (
        <form onSubmit={onHatch} className="mt-4 space-y-3">
          <Textarea
            aria-label="回答"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            maxLength={HATCH_MAX_LENGTH}
            rows={3}
            disabled={hatch.isPending}
            placeholder="あたためて、孵そう（回答はあなたの鍵で kind 1 のノートとして公開されます）"
            className="sticker-sm rounded-2xl bg-shell"
          />
          {hatch.isPending && <AnswerProgress step={hatch.step} />}
          {hatch.step === 'stalled' && hatch.pending && (
            <div className="sticker-sm space-y-2 rounded-2xl bg-shell px-4 py-3 text-sm font-bold" role="status">
              <p>
                回答ページは公開できましたが、ゲートウェイにまだ届いていません。今投稿すると、リンクのカードが質問の画像にならないことがあります。
              </p>
              <p className="break-all text-xs text-muted-foreground">{hatch.pending.answerUrl}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" className="rounded-full font-bold" onClick={() => onPostHeld(false)}>
                  もう一度確かめて投稿
                </Button>
                <Button type="button" size="sm" variant="outline" className="rounded-full font-bold" onClick={() => onPostHeld(true)}>
                  このまま投稿する
                </Button>
              </div>
            </div>
          )}
          {hatch.step === 'error' && hatch.error && (
            <p className="text-sm font-bold text-destructive">うまく孵りませんでした：{hatch.error}</p>
          )}
          {hatch.failedServers.length > 0 && (
            <p className="text-xs font-bold text-muted-foreground">
              一部のBlossomサーバーには置けませんでした：{hatch.failedServers.join(', ')}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {egg.hatch && (
              <Button
                type="button"
                variant="ghost"
                className="rounded-full font-bold"
                disabled={hatch.isPending}
                onClick={() => setOpen(false)}
              >
                やめる
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" className="sticker-sm rounded-full font-bold" disabled={crack.isPending || hatch.isPending}>
                  {crack.isPending && <Loader2 className="size-4 animate-spin" />} 割る
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>この卵を割りますか？</AlertDialogTitle>
                  <AlertDialogDescription>
                    巣から非表示になります（あなたの非表示リストに追加されます）。リレー上の元の質問は消えません。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>やめる</AlertDialogCancel>
                  <AlertDialogAction onClick={onCrack}>割る</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              type="submit"
              disabled={!answer.trim() || hatch.isPending || hatch.step === 'stalled'}
              className="sticker-sm rounded-full font-extrabold"
            >
              {hatch.isPending && <Loader2 className="size-4 animate-spin" />} 孵化させる
            </Button>
          </div>
        </form>
      )}
    </article>
  );
}
