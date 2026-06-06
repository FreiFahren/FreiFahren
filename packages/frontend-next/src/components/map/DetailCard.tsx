import { X } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';

import { PopupCard } from './PopupCard';

type DetailCardProps = {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: React.ReactNode;
};

export function DetailCard({ title, closeLabel, onClose, children }: DetailCardProps) {
  return (
    <PopupCard onClose={onClose} closeLabel={closeLabel}>
      <CardContent className="flex items-start justify-between">
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={closeLabel}>
          <X />
        </Button>
      </CardContent>
      {children}
    </PopupCard>
  );
}
