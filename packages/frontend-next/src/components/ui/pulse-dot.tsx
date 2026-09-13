import { cn } from '@/lib/utils';

import './pulse-dot.css';

type PulseDotProps = {
  /** Cycle length; pass the same value as any animation this should stay in step with. */
  cycleMs?: number;
  className?: string;
};

export function PulseDot({ cycleMs, className }: PulseDotProps) {
  return (
    <span className={cn('relative block size-2 shrink-0', className)}>
      <span
        className={cn(
          'bg-destructive absolute inset-0 rounded-full',
          cycleMs === undefined ? 'animate-ping opacity-75' : 'pulse-dot-ring-cycle',
        )}
        style={cycleMs === undefined ? undefined : { animationDuration: `${cycleMs}ms` }}
      />
      <span className="bg-destructive relative block size-full rounded-full" />
    </span>
  );
}
