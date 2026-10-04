import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { buildNestNoteTemplate, defaultNestNoteText } from '@/lib/nestNote';

/** One tap: post a fixed kind 1 note that shares the nest link. */
export function NestNoteForm({ nestUrl }: { nestUrl: string }) {
  const text = defaultNestNoteText(nestUrl);
  const { mutateAsync: publish, isPending, isSuccess } = useNostrPublish();
  const { toast } = useToast();

  const onPost = async () => {
    try {
      await publish(buildNestNoteTemplate(text, nestUrl));
      toast({ title: 'Nostrに投稿しました', description: '質問箱のリンクつきの kind 1 ノートです。' });
    } catch (err) {
      toast({ title: '投稿に失敗…', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-3 text-left">
      <p className="font-extrabold">Nostrで質問箱を知らせる</p>
      <p className="sticker-sm whitespace-pre-wrap break-all rounded-2xl bg-shell px-4 py-3 text-sm">{text}</p>
      <div className="flex justify-end">
        <Button type="button" onClick={onPost} disabled={isPending || isSuccess} className="sticker-sm rounded-full font-extrabold">
          {isPending ? <Loader2 className="size-4 animate-spin" /> : isSuccess ? <Check className="size-4" /> : null}
          {isSuccess ? '投稿しました' : 'Nostrに投稿する'}
        </Button>
      </div>
    </div>
  );
}
