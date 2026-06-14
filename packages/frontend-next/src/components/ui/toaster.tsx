import { useEffect, useSyncExternalStore } from 'react';

import { cn } from '@/lib/utils';
import { clearToasts, getToasts, subscribeToasts } from '@/lib/toast';

/**
 * Renders the toast stack (see `@/lib/toast`) top-center, below the floating search bar.
 * Replaces sonner's <Toaster>: the app only ever showed fully custom pills, so all this
 * needs to do is stack them, keep the page interactive around them, and animate exits.
 */
export function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts);

  // The toast store is a module global that outlives this route-scoped component. Drop any
  // lingering toasts when leaving the map layout so a pill fired here (e.g. the stats popup)
  // can't survive the route transition and stay painted on a non-map route like /report (FRE-653).
  useEffect(() => clearToasts, []);

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
            'pointer-events-auto flex w-fit max-w-full',
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
