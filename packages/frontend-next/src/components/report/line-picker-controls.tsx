import { useTranslation } from 'react-i18next';

import { LineBadge } from '@/components/transit/LineBadge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

import { NAMESPACE } from './ReportForm.i18n';
import { type LineFilter } from './ReportSelection.context';
import { LINE_FILTERS } from './line-picker-config';
import { SelectionButton } from './selection-button';

export function ClearSelectionButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  const { t } = useTranslation(NAMESPACE);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-muted-foreground hover:text-foreground py-1 text-sm outline-none focus-visible:underline',
        className,
      )}
    >
      {t('clearSelection')}
    </button>
  );
}

export function LineTypeTabs({
  value,
  onChange,
  className,
}: {
  value: LineFilter;
  onChange: (value: LineFilter) => void;
  className?: string;
}) {
  const { t } = useTranslation(NAMESPACE);

  return (
    <ToggleGroup
      type="single"
      size="sm"
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue) onChange(nextValue as LineFilter);
      }}
      className={cn('bg-surface-solid border-border max-w-full overflow-x-auto border', className)}
    >
      {LINE_FILTERS.map((option) => (
        <ToggleGroupItem
          key={option}
          value={option}
          className="text-muted-foreground data-[state=on]:bg-surface-elev data-[state=on]:text-foreground font-semibold tracking-wide uppercase"
        >
          {t(option)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function LineBadgePicker({
  lines,
  selectedLine,
  onSelect,
  wrap = false,
}: {
  lines: { name: string }[];
  selectedLine: string | null;
  onSelect: (lineName: string | null) => void;
  wrap?: boolean;
}) {
  const chips = lines.map((line) => (
    <SelectionButton
      key={line.name}
      value={line.name}
      selectedValue={selectedLine}
      onSelect={onSelect}
      className="shrink-0 rounded-sm transition-all focus-visible:ring-2 focus-visible:ring-white/50"
    >
      <LineBadge name={line.name} />
    </SelectionButton>
  ));

  return wrap ? (
    <div className="flex flex-wrap gap-2">{chips}</div>
  ) : (
    <div className="-mx-4 overflow-x-auto px-4 py-1.5">
      <div className="flex w-max gap-2">{chips}</div>
    </div>
  );
}
