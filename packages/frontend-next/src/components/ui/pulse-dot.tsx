import { cn } from '@/lib/utils';

type PulseDotProps = {
  /** Length of one ping cycle. Share it with any animation that should beat in time with the dot. */
  cycleMs?: number;
  /** Whether the ping ring plays; off leaves a static dot. */
  pulse?: boolean;
  className?: string;
};

// A solid dot with a ping ring expanding out of it; flags something new (a live report, an unread
// announcement). Colour and size come from className — bg-* and size-* apply to both layers.
export function PulseDot({ cycleMs = 1000, pulse = true, className }: PulseDotProps) {
  return (
    <span className={cn('bg-destructive relative block size-2 shrink-0 rounded-full', className)}>
      {pulse && (
        <span
          className="absolute inset-0 rounded-full bg-inherit opacity-75 motion-safe:animate-ping"
          style={{ animationDuration: `${cycleMs}ms` }}
        />
      )}
    </span>
  );
}
