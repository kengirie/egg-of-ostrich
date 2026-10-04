import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useThrowEgg } from '@/hooks/useEggs';
import { useToast } from '@/hooks/useToast';
import { EGG_MAX_LENGTH } from '@/lib/egg';
import { EggShape } from './EggShape';
import { Ostrich } from './Ostrich';

const PLACEHOLDERS = [
  'ダチョウに乗ったことありますか？',
  '最近いちばん笑ったことは？',
  '朝ごはんは何派？',
  '人生で一番大きい卵の話を聞かせて',
];

/** The anonymous question box. No login: every egg gets a brand-new throwaway key. */
export function ThrowEggForm({ owner, nestId }: { owner: string; nestId: string }) {
  const [content, setContent] = useState('');
  const [flying, setFlying] = useState(0);
  const [placeholder] = useState(() => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)]);
  const { mutateAsync: throwEgg, isPending, isSuccess, reset } = useThrowEgg(owner, nestId);
  const { toast } = useToast();

  const remaining = EGG_MAX_LENGTH - content.length;
  const canThrow = content.trim().length > 0 && remaining >= 0 && !isPending;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canThrow) return;
    setFlying((n) => n + 1);
    try {
      await throwEgg(content);
      setContent('');
    } catch (err) {
      toast({
        title: '卵が割れてしまいました…',
        description: err instanceof Error ? err.message : 'リレーに届きませんでした。もう一度投げてみてください。',
        variant: 'destructive',
      });
    }
  };

  return (
    <form onSubmit={onSubmit} className="sticker relative rounded-3xl bg-card p-5 sm:p-6">
      {/* the egg in flight */}
      {flying > 0 && (
        <EggShape
          key={flying}
          className="pointer-events-none fixed bottom-24 left-6 z-50 h-16 w-14 motion-safe:animate-throw"
          label="飛んでいく卵"
        />
      )}

      <div className="flex items-start gap-4">
        <div className="hidden shrink-0 sm:block">
          <Ostrich className="h-28 w-24" mood={isPending ? 'shock' : 'happy'} />
        </div>
        <div className="flex-1 space-y-3">
          <label htmlFor="egg-content" className="block text-lg font-extrabold">
            卵に質問を書いて、巣に投げこもう
          </label>
          <Textarea
            id="egg-content"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (isSuccess) reset();
            }}
            placeholder={placeholder}
            rows={4}
            maxLength={EGG_MAX_LENGTH + 50}
            className="sticker-sm min-h-28 resize-y rounded-2xl bg-shell text-base"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold text-muted-foreground">
              完全匿名：使い捨ての鍵で署名するので、誰が投げたかは誰にもわかりません。
              <span className={remaining < 0 ? 'text-destructive' : ''}> 残り{remaining}字</span>
            </p>
            <Button
              type="submit"
              disabled={!canThrow}
              className="sticker-sm h-12 rounded-full px-6 text-base font-extrabold transition-transform hover:-rotate-2 hover:scale-105 active:scale-95"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-5 animate-spin" /> 投げています…
                </>
              ) : (
                <>卵を投げる！</>
              )}
            </Button>
          </div>
          {isSuccess && (
            <p role="status" className="motion-safe:animate-land rounded-2xl bg-accent px-4 py-2 font-extrabold text-accent-foreground">
              ぽすっ。巣に着地しました！ダチョウが温めはじめています。
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            質問は暗号化されずNostrリレーに公開で保存されます。個人情報は書かないでね。
          </p>
        </div>
      </div>
    </form>
  );
}
