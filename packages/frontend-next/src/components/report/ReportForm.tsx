import { useNavigate } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useSubmitReport } from '@/api/reports';
import { PageHeader } from '@/components/templates/PageHeader';
import { LineBadge } from '@/components/transit/LineBadge';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/ui/section-heading';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

import { NAMESPACE } from './ReportForm.i18n';
import { type LineFilter, useReportSelection } from './ReportSelection.context';
import { ReportSelectionProvider } from './ReportSelectionProvider';

const FILTERS: LineFilter[] = ['all', 'subway', 'light_rail', 'tram'];

function ClearSelectionButton({ onClick, className }: { onClick: () => void; className?: string }) {
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

function LinePicker() {
  const { t } = useTranslation(NAMESPACE);
  const { lineName, lineFilter, setLineFilter, selectLine, visibleLines } = useReportSelection();

  return (
    <section className="px-4">
      <div className="mb-3 flex items-center justify-between">
        <SectionHeading hint={t('optional')}>{t('line')}</SectionHeading>
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

      {/* Always render the row so reserving the clear button's height avoids layout shift. */}
      <div className="mb-1 flex justify-end">
        <ClearSelectionButton
          onClick={() => selectLine(null)}
          className={cn(!lineName && 'invisible')}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {visibleLines.map((line) => {
          const isSelected = lineName === line.name;
          return (
            <button
              key={line.name}
              type="button"
              aria-pressed={isSelected}
              onClick={() => selectLine(isSelected ? null : line.name)}
              className={cn(
                'rounded-sm outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-white/50',
                // No selection-ring: once a line is picked, the others dim so the choice stands out.
                lineName && !isSelected && 'opacity-40',
              )}
            >
              <LineBadge name={line.name} />
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
        <SectionHeading hint={t('required')} hintTone="destructive">
          {t('station')}
        </SectionHeading>
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
                  'hover:bg-muted focus-visible:bg-muted flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm outline-none',
                  isSelected && 'bg-muted font-medium',
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
      <div className="mb-3 flex items-center justify-between">
        <SectionHeading hint={t('optional')}>{t('direction')}</SectionHeading>
        {/* Rendered unconditionally and hidden when nothing is selected to reserve its height. */}
        <ClearSelectionButton
          onClick={() => selectDirection(null)}
          className={cn(!directionStationId && 'invisible')}
        />
      </div>
      <ul>
        {directionOptions.map((station) => {
          const isSelected = directionStationId === station.id;
          return (
            <li key={station.id} className="border-border/60 border-b last:border-b-0">
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => selectDirection(isSelected ? null : station.id)}
                className={cn(
                  'hover:bg-muted focus-visible:bg-muted flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm outline-none',
                  isSelected && 'bg-muted font-medium',
                )}
              >
                <ChevronRight className="text-muted-foreground size-5 shrink-0" />
                <span className="truncate">{station.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SubmitFooter() {
  const { t } = useTranslation(NAMESPACE);
  const { stationId, lineName, directionStationId } = useReportSelection();
  const submitReport = useSubmitReport();

  const canSubmit = stationId !== null;
  const disabled = !canSubmit || submitReport.isPending;

  const handleSubmit = () => {
    if (!stationId) return;
    submitReport.mutate({ stationId, lineName, directionStationId });
  };

  return (
    <footer className="mt-auto px-4 pt-6 pb-4">
      <Button
        type="button"
        size="lg"
        disabled={disabled}
        onClick={handleSubmit}
        className={cn(
          'h-12 w-full rounded-lg text-base font-medium',
          canSubmit
            ? 'bg-accent-bright text-primary-foreground hover:bg-accent-press shadow-[0_6px_16px_rgba(214,59,59,0.28)]'
            : 'bg-surface-solid text-muted-foreground border-border border',
        )}
      >
        {t('submit')}
      </Button>
      <p className="text-muted-foreground mt-2 text-center text-[0.6875rem]">{t('disclaimer')}</p>
    </footer>
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
          <SubmitFooter />
        </div>
      </div>
    </ReportSelectionProvider>
  );
}
