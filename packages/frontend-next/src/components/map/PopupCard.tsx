import * as React from 'react';

import { Backdrop } from '@/components/ui/backdrop';
import { Card } from '@/components/ui/card';

type PopupCardProps = {
  /**
   * When provided, the card is dismissible: a backdrop is rendered that dims and blocks the map
   * behind the card and closes it on click. Omit it for a non-modal prompt that lets users keep
   * interacting with the map (no backdrop, no implicit dismiss).
   */
  onClose?: () => void;
  closeLabel?: string;
  children: React.ReactNode;
};

export function PopupCard({ onClose, closeLabel, children }: PopupCardProps) {
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
      <div className="pb-safe-3 pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pt-3">
        <Card className="animate-in slide-in-from-bottom-4 fade-in pointer-events-auto w-full max-w-md gap-1 py-4 duration-200 ease-out">
          {children}
        </Card>
      </div>
    </>
  );
}
