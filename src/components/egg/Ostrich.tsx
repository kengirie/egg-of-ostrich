import { cn } from '@/lib/utils';

interface OstrichProps {
  className?: string;
  /** "shock" gives it the googly, wide-open stare. */
  mood?: 'happy' | 'shock';
  /** Bob the head/neck like it is pecking at nothing. */
  bobbing?: boolean;
}

/** A hand-rolled, slightly unhinged cartoon ostrich. Pure SVG, theme-aware. */
export function Ostrich({ className, mood = 'happy', bobbing = true }: OstrichProps) {
  return (
    <svg
      viewBox="0 0 200 240"
      className={cn('overflow-visible', className)}
      role="img"
      aria-label="ダチョウ"
    >
      {/* legs */}
      <g className="stroke-neck" strokeWidth="7" strokeLinecap="round" fill="none">
        <path d="M88 165 L80 200 L86 228" />
        <path d="M112 165 L122 200 L116 228" />
        <path d="M86 228 L72 232 M86 228 L96 234" />
        <path d="M116 228 L104 233 M116 228 L130 232" />
      </g>

      {/* tail tuft */}
      <g className="fill-shell stroke-border" strokeWidth="3">
        <circle cx="42" cy="118" r="14" />
        <circle cx="34" cy="132" r="12" />
        <circle cx="46" cy="138" r="11" />
      </g>

      {/* fluffy body */}
      <g className="fill-foreground">
        <ellipse cx="100" cy="140" rx="60" ry="38" />
        <circle cx="58" cy="150" r="14" />
        <circle cx="76" cy="168" r="14" />
        <circle cx="100" cy="174" r="14" />
        <circle cx="124" cy="168" r="14" />
        <circle cx="144" cy="152" r="14" />
      </g>
      {/* wing highlight */}
      <path
        d="M70 128 Q100 108 132 128 Q104 142 70 128 Z"
        className="fill-shell/90"
      />

      <g className={cn('origin-[140px_125px]', bobbing && 'motion-safe:animate-bob')}>
        {/* neck */}
        <path
          d="M130 128 C140 100 128 70 142 44"
          className="stroke-neck"
          strokeWidth="16"
          strokeLinecap="round"
          fill="none"
        />
        {/* head */}
        <circle cx="146" cy="38" r="20" className="fill-neck stroke-border" strokeWidth="3" />
        {/* bad hair day */}
        <path
          d="M134 22 q4 -14 8 -2 q4 -16 8 -1 q6 -12 7 3"
          className="stroke-foreground"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        {/* beak */}
        <path
          d="M162 36 Q186 38 190 46 Q176 52 160 46 Z"
          className="fill-primary stroke-border"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {/* googly eye */}
        <circle
          cx="150"
          cy="34"
          r={mood === 'shock' ? 11 : 9}
          className="fill-shell stroke-border"
          strokeWidth="3"
        />
        <circle cx={mood === 'shock' ? 150 : 153} cy={mood === 'shock' ? 34 : 36} r="4" className="fill-foreground" />
        {mood === 'happy' && (
          <path d="M140 22 L158 26" className="stroke-foreground" strokeWidth="3" strokeLinecap="round" />
        )}
      </g>
    </svg>
  );
}
