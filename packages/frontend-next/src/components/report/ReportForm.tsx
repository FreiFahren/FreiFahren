import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import {
  compareLineOrder,
  type LineType,
  resolveStationLineNames,
  type Station,
  useLines,
  useStations,
} from '@/api/transit';
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
  const { lineName, setLineName, lineFilter, setLineFilter, stationId } = useReportSelection();
  const { data: lines } = useLines();
  const { data: stations } = useStations();

  // One badge per line name (collapsing per-direction variants).
  const allLines = () => {
    const typeByName = new Map<string, LineType>();
    for (const line of lines ?? []) {
      if (!typeByName.has(line.name)) typeByName.set(line.name, line.type);
    }
    return [...typeByName].map(([name, type]) => ({ name, type })).sort(compareLineOrder);
  };

  const station = stationId ? stations?.[stationId] : undefined;
  const stationLineNames = station ? new Set(resolveStationLineNames(station.lines, lines)) : null;
  const visibleLines = allLines()
    .filter((l) => lineFilter === 'all' || l.type === lineFilter)
    .filter((l) => !stationLineNames || stationLineNames.has(l.name));

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
          <ClearSelectionButton onClick={() => setLineName(null)} />
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
              onClick={() => {
                if (isSelected) {
                  setLineName(null);
                  return;
                }
                setLineName(line.name);
                setLineFilter(line.type);
              }}
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
  const { lineName, lineFilter, stationId, setStationId } = useReportSelection();
  const { data: stations } = useStations();
  const { data: lines } = useLines();

  const typeByName = new Map<string, LineType>();
  for (const line of lines ?? []) typeByName.set(line.name, line.type);

  const selectedStation = stationId ? stations?.[stationId] : undefined;

  const stationsAlongLine = () => {
    // Walk every variant of the selected line and emit stations in their stored order,
    // deduplicating across direction variants.
    const seen = new Set<string>();
    const ordered: Station[] = [];
    for (const line of lines ?? []) {
      if (line.name !== lineName) continue;
      for (const id of line.stations) {
        if (seen.has(id)) continue;
        seen.add(id);
        const station = stations?.[id];
        if (station) ordered.push(station);
      }
    }
    return ordered;
  };

  const stationsByType = () =>
    Object.values(stations ?? {})
      .filter((station) => {
        if (lineFilter === 'all') return true;
        const names = resolveStationLineNames(station.lines, lines);
        return names.some((name) => typeByName.get(name) === lineFilter);
      })
      .sort((a, b) => a.name.localeCompare(b.name));

  let visibleStations: Station[];
  if (selectedStation) visibleStations = [selectedStation];
  else if (lineName) visibleStations = stationsAlongLine();
  else visibleStations = stationsByType();

  return (
    <section className="mt-6 flex min-h-0 flex-1 flex-col px-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1 tracking-wide uppercase">
          <h2 className="text-sm font-semibold">{t('station')}</h2>
          <p className="text-destructive text-[0.625rem] tracking-wide">{t('required')}</p>
        </div>
        {stationId && <ClearSelectionButton onClick={() => setStationId(null)} />}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {visibleStations.map((station) => {
          const isSelected = stationId === station.id;
          return (
            <li key={station.id} className="border-border/60 border-b last:border-b-0">
              <button
                type="button"
                aria-pressed={isSelected}
                onClick={() => setStationId(isSelected ? null : station.id)}
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
        </div>
      </div>
    </ReportSelectionProvider>
  );
}
