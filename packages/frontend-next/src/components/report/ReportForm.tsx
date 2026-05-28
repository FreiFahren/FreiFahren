import { useNavigate } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/templates/PageHeader';
import { LineBadge } from '@/components/transit/LineBadge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

import { NAMESPACE } from './ReportForm.i18n';
import { type LineFilter, useReportSelection } from './ReportSelection.context';
import { ReportSelectionProvider } from './ReportSelectionProvider';

const FILTERS: LineFilter[] = ['all', 'subway', 'light_rail', 'tram'];

function ClearSelectionButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation(NAMESPACE);
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-muted-foreground hover:text-foreground text-xs outline-none focus-visible:underline"
    >
      {t('clearSelection')}
    </button>
  );
}

function LinePicker() {
  const { t } = useTranslation(NAMESPACE);
  const { lineName, lineFilter, setLineFilter, selectLine, visibleLines } = useReportSelection();

  return (
    <section className="px-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1 tracking-wide uppercase">
          <h2 className="text-sm font-semibold">{t('line')}</h2>
          <p className="text-muted-foreground text-[0.625rem] tracking-wide">{t('optional')}</p>
        </div>
        <ToggleGroup
          type="single"
          size="sm"
          value={lineFilter}
          onValueChange={(value) => {
            if (value) setLineFilter(value as LineFilter);
          }}
          className="bg-surface-solid border-border border"
        >
          {FILTERS.map((option) => (
            <ToggleGroupItem
              key={option}
              value={option}
              className="text-muted-foreground data-[state=on]:bg-surface-elev data-[state=on]:text-foreground font-semibold tracking-wide uppercase"
            >
              {t(option)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {lineName && (
        <div className="mb-1 flex justify-end">
          <ClearSelectionButton onClick={() => selectLine(null)} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {visibleLines.map((line) => {
          const isSelected = lineName === line.name;
          return (
            <button
              key={line.name}
              type="button"
              aria-pressed={isSelected}
              onClick={() => selectLine(isSelected ? null : line.name)}
              className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              <LineBadge name={line.name} className={cn(isSelected && 'ring-2 ring-white')} />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function StationPicker() {
  const { t } = useTranslation(NAMESPACE);
  const { stationId, selectStation, visibleStations } = useReportSelection();

  return (
    <section
      className={cn(
        'mt-6 flex flex-col px-4',
        // While the user is still browsing, the list fills the form and scrolls inside.
        // Once a station is picked the list collapses to a single row so the direction
        // picker (and the future submit button) stay visible.
        !stationId && 'min-h-0 flex-1',
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1 tracking-wide uppercase">
          <h2 className="text-sm font-semibold">{t('station')}</h2>
          <p className="text-destructive text-[0.625rem] tracking-wide">{t('required')}</p>
        </div>
        {stationId && <ClearSelectionButton onClick={() => selectStation(null)} />}
      </div>
      <ul className={cn(!stationId && 'min-h-0 flex-1 overflow-y-auto')}>
        {visibleStations.map((station) => {
          const isSelected = stationId === station.id;
          return (
            <li key={station.id} className="border-border/60 border-b last:border-b-0">
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => selectStation(isSelected ? null : station.id)}
                className={cn(
                  'hover:bg-muted focus-visible:bg-muted flex w-full items-center rounded-md px-2 py-2 text-left text-xs outline-none',
                  isSelected && 'ring-2 ring-white ring-inset',
                )}
              >
                {station.name}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DirectionPicker() {
  const { t } = useTranslation(NAMESPACE);
  const { directionStationId, selectDirection, directionOptions } = useReportSelection();

  if (directionOptions.length === 0) return null;

  return (
    <section className="mt-6 px-4">
      <div className="mb-3 flex items-center gap-1 tracking-wide uppercase">
        <h2 className="text-sm font-semibold">{t('direction')}</h2>
        <p className="text-muted-foreground text-[0.625rem] tracking-wide">{t('optional')}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {directionOptions.map((station) => {
          const isSelected = directionStationId === station.id;
          return (
            <button
              key={station.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => selectDirection(isSelected ? null : station.id)}
              className={cn(
                'border-border bg-surface-solid hover:bg-muted flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm outline-none',
                isSelected && 'ring-2 ring-white ring-inset',
              )}
            >
              <ChevronRight className="text-muted-foreground size-4 shrink-0" />
              <span className="truncate">{station.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function ReportForm() {
  const { t } = useTranslation(NAMESPACE);
  const navigate = useNavigate();

  return (
    <ReportSelectionProvider>
      <div className="bg-card animate-in fade-in fixed inset-0 z-30 duration-150">
        <div className="mx-auto flex h-full w-full max-w-md flex-col">
          <PageHeader title={t('title')} onBack={() => navigate({ to: '/' })} />
          <LinePicker />
          <StationPicker />
          <DirectionPicker />
        </div>
      </div>
    </ReportSelectionProvider>
  );
}
