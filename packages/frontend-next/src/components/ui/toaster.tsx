import { useSyncExternalStore } from 'react';

import { cn } from '@/lib/utils';
import { getToasts, subscribeToasts } from '@/lib/toast';

/**
 * Renders the toast stack (see `@/lib/toast`) top-center, below the floating search bar.
 * Replaces sonner's <Toaster>: the app only ever showed fully custom pills, so all this
 * needs to do is stack them, keep the page interactive around them, and animate exits.
 */
export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts);

  if (toasts.length === 0) return null;

  return (
    // top-18 clears the search bar (the 4.5rem offset the sonner setup used). z-25 keeps
    // toasts below the search results (z-30) but above the map controls (z-20).
    <div className="pointer-events-none fixed inset-x-4 top-18 z-25 flex flex-col items-center gap-2">
      {toasts.map((item) => (
        <div
          key={item.id}
          role="status"
          className={cn(
            'pointer-events-auto flex w-full justify-center',
            // Duration must match EXIT_MS in @/lib/toast, which unmounts after the animation.
            item.leaving && 'animate-out fade-out zoom-out-95 fill-mode-forwards duration-200',
          )}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
