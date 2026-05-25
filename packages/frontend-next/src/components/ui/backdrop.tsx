import * as React from 'react';

import { cn } from '@/lib/utils';

type BackdropProps = Omit<React.ComponentProps<'button'>, 'type'> & {
  onClose?: () => void;
};

function Backdrop({ className, onClose, onClick, ...props }: BackdropProps) {
  return (
    <button
      type="button"
      data-slot="backdrop"
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onClose?.();
      }}
      className={cn('fixed inset-0 z-10 bg-black/40', className)}
      {...props}
    />
  );
}

export { Backdrop };
