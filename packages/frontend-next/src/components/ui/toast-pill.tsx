import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

export function ToastPill({
  asChild = false,
  className,
  ...props
}: ComponentProps<'div'> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'div';
  return (
    <Comp
      className={cn(
        'bg-card text-card-foreground animate-in fade-in zoom-in-95 mx-auto rounded-full px-4 py-1.5 shadow-[0_6px_16px_rgba(0,0,0,0.28)] duration-500',
        className,
      )}
      {...props}
    />
  );
}
