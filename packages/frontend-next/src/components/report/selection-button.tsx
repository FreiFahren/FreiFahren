import { type ReactNode } from 'react';

import { selectionTap } from '@/lib/haptics';
import { cn } from '@/lib/utils';

export function SelectionButton({
  value,
  selectedValue,
  onSelect,
  className,
  selectedClassName,
  children,
}: {
  value: string;
  selectedValue: string | null;
  onSelect: (value: string | null) => void;
  className?: string;
  selectedClassName?: string;
  children: ReactNode;
}) {
  const isSelected = selectedValue === value;

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={() => {
        selectionTap();
        onSelect(isSelected ? null : value);
      }}
      className={cn(
        'outline-none',
        className,
        isSelected && 'ring-2 ring-white',
        isSelected && selectedClassName,
        selectedValue && !isSelected && 'opacity-40',
      )}
    >
      {children}
    </button>
  );
}
