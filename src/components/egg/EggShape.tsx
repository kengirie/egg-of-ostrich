import { cn } from '@/lib/utils';

export type EggState = 'whole' | 'cracked' | 'hatched';

interface EggShapeProps {
  state?: EggState;
  className?: string;
  label?: string;
}

const SHELL = 'M50 6 C22 6 8 56 8 76 C8 101 27 116 50 116 C73 116 92 101 92 76 C92 56 78 6 50 6 Z';

/** Speckled ostrich egg, optionally cracked or hatched (a fuzzy chick pops out). */
export function EggShape({ state = 'whole', className, label }: EggShapeProps) {
  return (
    <svg
      viewBox="0 0 100 122"
      className={cn('overflow-visible', className)}
      role="img"
      aria-label={label ?? (state === 'hatched' ? '孵った卵' : state === 'cracked' ? 'ひびの入った卵' : '卵')}
    >
      {state === 'hatched' ? (
        <>
          {/* chick */}
          <g>
            <circle cx="50" cy="52" r="22" className="fill-muted stroke-border" strokeWidth="3" />
            <path d="M38 34 q3 -10 6 -1 q3 -11 6 0 q4 -9 5 2" className="stroke-foreground" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <circle cx="44" cy="50" r="3.5" className="fill-foreground" />
            <circle cx="58" cy="50" r="3.5" className="fill-foreground" />
            <path d="M47 58 L58 60 L48 64 Z" className="fill-primary stroke-border" strokeWidth="2" strokeLinejoin="round" />
          </g>
          {/* bottom half of the shell */}
          <path
            d="M8 76 L20 66 L30 76 L42 64 L54 76 L66 64 L78 76 L92 68 C92 101 73 116 50 116 C27 116 8 101 8 76 Z"
            className="fill-shell stroke-border"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          {/* the lid, flung off */}
          <path
            d="M30 20 C40 2 70 2 80 20 L70 26 L60 18 L50 28 L40 18 Z"
            className="fill-shell stroke-border"
            strokeWidth="4"
            strokeLinejoin="round"
            transform="translate(26 -22) rotate(28 55 15)"
          />
        </>
      ) : (
        <>
          <path d={SHELL} className="fill-shell stroke-border" strokeWidth="4" />
          <g className="fill-speckle">
            <circle cx="36" cy="40" r="3" />
            <circle cx="62" cy="32" r="2.5" />
            <circle cx="70" cy="70" r="3.5" />
            <circle cx="30" cy="82" r="2.5" />
            <circle cx="52" cy="96" r="3" />
            <circle cx="46" cy="62" r="2" />
          </g>
          <ellipse cx="34" cy="36" rx="6" ry="11" transform="rotate(25 34 36)" className="fill-card/80" />
          {state === 'cracked' && (
            <path
              d="M14 64 L28 58 L34 70 L48 60 L56 72 L68 60 L76 68 L88 62"
              className="stroke-border"
              strokeWidth="3.5"
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
        </>
      )}
    </svg>
  );
}
