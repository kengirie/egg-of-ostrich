import { useState } from 'react';
import { Loader2 } from 'lucide-react';
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
import { useCrackEgg, useHatchEgg } from '@/hooks/useEggs';
import { useToast } from '@/hooks/useToast';
import { HATCH_MAX_LENGTH, type Egg } from '@/lib/egg';
import { timeAgo } from '@/lib/time';
import { cn } from '@/lib/utils';
import { EggShape } from './EggShape';

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
          </div>
        </div>
      )}
    </article>
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

/** Owner's view of an unanswered egg: hatch it (answer) or crack it (hide). */
export function OwnerEggCard({ egg, nestId }: { egg: Egg; nestId: string }) {
  const [answer, setAnswer] = useState(egg.hatch?.content ?? '');
  const [open, setOpen] = useState(!egg.hatch);
  const hatch = useHatchEgg(nestId);
  const crack = useCrackEgg(nestId);
  const { toast } = useToast();

  const onHatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await hatch.mutateAsync({ egg, content: answer });
      setOpen(false);
      toast({ title: 'ピヨッ！卵が孵りました 🐣' });
    } catch (err) {
      toast({ title: '孵化に失敗…', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
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
          <button type="button" onClick={() => setOpen(true)} className="mt-2 text-sm font-bold underline">
            回答を書き直す
          </button>
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
            placeholder="あたためて、孵そう（回答はあなたの鍵で公開されます）"
            className="sticker-sm rounded-2xl bg-shell"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" className="sticker-sm rounded-full font-bold" disabled={crack.isPending}>
                  {crack.isPending ? <Loader2 className="size-4 animate-spin" /> : '🔨'} 割る
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
            <Button type="submit" disabled={!answer.trim() || hatch.isPending} className="sticker-sm rounded-full font-extrabold">
              {hatch.isPending ? <Loader2 className="size-4 animate-spin" /> : '🐣'} 孵化させる
            </Button>
          </div>
        </form>
      )}
    </article>
  );
}
