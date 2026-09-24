import { cn } from '@/lib/utils';

type PulseDotProps = {
  /** Length of one ping cycle. Share it with any animation that should beat in time with the dot. */
  cycleMs?: number;
  className?: string;
};

// A solid dot with a ping ring expanding out of it; flags something new (a live report, an unread
// announcement). Colour and size come from className — bg-* and size-* apply to both layers.
export function PulseDot({ cycleMs = 1000, className }: PulseDotProps) {
  return (
    <span className={cn('bg-destructive relative block size-2 shrink-0 rounded-full', className)}>
      <span
        className="absolute inset-0 animate-ping rounded-full bg-inherit opacity-75"
        style={{ animationDuration: `${cycleMs}ms` }}
      />
    </span>
  );
}
