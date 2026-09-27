import * as React from 'react';

import { Backdrop } from '@/components/ui/backdrop';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type PopupCardProps = {
  /**
   * When provided, the card is dismissible: a backdrop is rendered that dims and blocks the map
   * behind the card and closes it on click. Omit it for a non-modal prompt that lets users keep
   * interacting with the map (no backdrop, no implicit dismiss).
   */
  onClose?: () => void;
  closeLabel?: string;
  cardClassName?: string;
  children: React.ReactNode;
};

export function PopupCard({ onClose, closeLabel, cardClassName, children }: PopupCardProps) {
  return (
    <>
      {onClose && (
        <Backdrop
          aria-label={closeLabel}
          onClose={onClose}
          // z-40 lifts the backdrop above the map controls (z-20), the search bar (z-30) and the
          // toasts (z-25) so it dims and blocks all of them, not just the map.
          className="animate-in fade-in z-40 duration-150"
        />
      )}
      {/* Offset the wrapper itself rather than padding it: iOS 26 Safari treats a wide fixed box
          that reaches within ~12px of the viewport bottom as a toolbar and stops drawing the map
          under its own toolbar. */}
      <div className="bottom-safe-6 pointer-events-none fixed inset-x-3 z-40 flex justify-center">
        <Card
          className={cn(
            'animate-in slide-in-from-bottom-4 fade-in pointer-events-auto w-full max-w-md gap-1 py-4 duration-200 ease-out',
            cardClassName,
          )}
        >
          {children}
        </Card>
      </div>
    </>
  );
}
