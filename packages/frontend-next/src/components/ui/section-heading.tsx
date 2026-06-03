import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type SectionHeadingProps = {
  children: ReactNode;
  /** Optional secondary label shown after the title, e.g. "optional" / "required". */
  hint?: string;
  hintTone?: 'muted' | 'destructive';
  className?: string;
};

export function SectionHeading({
  children,
  hint,
  hintTone = 'muted',
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn('flex items-center gap-1 tracking-wide uppercase', className)}>
      <h2 className="text-sm font-semibold">{children}</h2>
      {hint && (
        <p
          className={cn(
            'text-[0.625rem] tracking-wide',
            hintTone === 'destructive' ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
