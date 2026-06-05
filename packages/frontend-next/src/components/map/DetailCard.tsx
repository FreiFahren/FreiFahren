import { X } from 'lucide-react';
import * as React from 'react';

import { Backdrop } from '@/components/ui/backdrop';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type DetailCardProps = {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: React.ReactNode;
};

export function DetailCard({ title, closeLabel, onClose, children }: DetailCardProps) {
  return (
    <>
      <Backdrop
        aria-label={closeLabel}
        onClose={onClose}
        // z-40 lifts the backdrop above the map controls (z-20), the search bar (z-30) and the
        // toasts (z-25) so it dims and blocks all of them, not just the map.
        className="animate-in fade-in z-40 duration-150"
      />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-3">
        <Card className="animate-in slide-in-from-bottom-4 fade-in pointer-events-auto w-full max-w-md gap-1 py-4 duration-200 ease-out">
          <CardContent className="flex items-start justify-between">
            <h2 className="font-heading text-lg font-semibold">{title}</h2>
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={closeLabel}>
              <X />
            </Button>
          </CardContent>
          {children}
        </Card>
      </div>
    </>
  );
}
