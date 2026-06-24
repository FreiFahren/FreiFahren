import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { ChevronRight, MapPin, Search, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type SubmitReportResponse, useSubmitReport } from '@/api/reports';
import { type Station } from '@/api/transit';
import { FeedbackButton } from '@/components/feedback/FeedbackButton';
import { PageHeader } from '@/components/templates/PageHeader';
import { LineBadge } from '@/components/transit/LineBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionHeading } from '@/components/ui/section-heading';
import { Separator } from '@/components/ui/separator';
import { ToastPill } from '@/components/ui/toast-pill';
import { Toaster } from '@/components/ui/toaster';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useGeolocation } from '@/contexts/Geolocation.context';
import { isContributeDismissed, openContributeModal } from '@/lib/contribute-modal';
import { track } from '@/lib/analytics';
import { distanceMeters } from '@/lib/geo';
import { notifySuccess, selectionTap } from '@/lib/haptics';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

import { NAMESPACE } from './ReportForm.i18n';
import { type LineFilter, useReportSelection } from './ReportSelection.context';
import { ReportSelectionProvider } from './ReportSelectionProvider';
import { ReportSuccess } from './ReportSuccess';
import { type ReportRejection, useReportVerification } from './useReportVerification';

const routeApi = getRouteApi('/report');

const FILTERS: LineFilter[] = ['all', 'subway', 'light_rail', 'tram'];

/** Diacritic-insensitive match so "moritzplatz" finds "Möritzplatz" and "strasse" finds "Straße". */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ß/g, 'ss')
    .toLowerCase();
}

const NEARBY_COUNT = 3;

const REJECTION_MESSAGE: Record<ReportRejection, string> = {
  too_soon: 'errorTooSoon',
  too_far: 'errorTooFar',
};

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
  const { lineName, lineFilter, setLineFilter, selectLine, visibleLines, stationId } =
    useReportSelection();

  const chips = visibleLines.map((line) => {
    const isSelected = lineName === line.name;
    return (
      <button
        key={line.name}
        type="button"
        aria-pressed={isSelected}
        onClick={() => {
          selectionTap();
          selectLine(isSelected ? null : line.name);
        }}
        className={cn(
          'shrink-0 rounded-sm transition-opacity outline-none focus-visible:ring-2 focus-visible:ring-white/50',
          lineName && !isSelected && 'opacity-40',
        )}
      >
        <LineBadge name={line.name} />
      </button>
    );
  });

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

      {stationId ? (
        <div className="flex flex-wrap gap-2">{chips}</div>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-1">
          <div className="flex w-max gap-2">{chips}</div>
        </div>
      )}
    </section>
  );
}

function StationPicker() {
  const { t } = useTranslation(NAMESPACE);
  const { stationId, lineName, selectStation, visibleStations } = useReportSelection();
  const { position } = useGeolocation();
  const [query, setQuery] = useState('');

  const needle = normalize(query.trim());
  const filtered = needle
    ? visibleStations.filter((s) => normalize(s.name).includes(needle))
    : visibleStations;

  // Closest stations, only while sharing location, not searching, and not browsing a line.
  const nearby =
    position && !needle && !lineName
      ? visibleStations
          .map((station) => ({
            station,
            distance: distanceMeters(
              position.lat,
              position.lng,
              station.coordinates.latitude,
              station.coordinates.longitude,
            ),
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, NEARBY_COUNT)
          .map((n) => n.station)
      : [];
  const nearbyIds = new Set(nearby.map((s) => s.id));
  const rest = filtered.filter((s) => !nearbyIds.has(s.id));

  const renderStation = (station: Station) => (
    <li key={station.id} className="border-border/60 border-b last:border-b-0">
      <button
        type="button"
        onClick={() => {
          selectionTap();
          selectStation(station.id);
        }}
        className="hover:bg-muted focus-visible:bg-muted flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm outline-none"
      >
        <span className="truncate">{station.name}</span>
      </button>
    </li>
  );

  const clear = () => {
    selectStation(null);
    setQuery('');
  };

  return (
    <section className={cn('mt-6 flex flex-col px-4', !stationId && 'min-h-0 flex-1')}>
      <div className="mb-3 flex items-center justify-between">
        <SectionHeading hint={t('required')} hintTone="destructive">
          {t('station')}
        </SectionHeading>
        {stationId && <ClearSelectionButton onClick={clear} />}
      </div>

      {stationId ? (
        <div className="bg-muted flex items-center rounded-md px-3 py-2.5 text-sm font-semibold">
          {visibleStations[0]?.name}
        </div>
      ) : (
        <>
          <div className="relative mb-2">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchStation')}
              className="h-10 pl-9 text-base"
              autoComplete="off"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto mask-b-from-[calc(100%-2.5rem)] mask-b-to-100% pb-2">
            {nearby.length > 0 && (
              <>
                <div className="text-muted-foreground flex items-center gap-1.5 px-3 py-2 text-[0.625rem] font-semibold tracking-wide uppercase">
                  <MapPin className="size-3.5" />
                  {t('nearby')}
                </div>
                <ul>{nearby.map(renderStation)}</ul>
                {rest.length > 0 && <Separator className="bg-border my-2 data-horizontal:h-0.5" />}
              </>
            )}
            <ul>
              {rest.map(renderStation)}
              {needle && filtered.length === 0 && (
                <li className="text-muted-foreground px-3 py-6 text-center text-sm">
                  {t('noMatch', { query })}
                </li>
              )}
            </ul>
          </div>
        </>
      )}
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
                onClick={() => {
                  selectionTap();
                  selectDirection(isSelected ? null : station.id);
                }}
                className={cn(
                  'hover:bg-muted focus-visible:bg-muted flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm outline-none',
                  isSelected && 'bg-muted font-semibold',
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

function SubmitFooter({ onSubmitted }: { onSubmitted: (result: SubmitReportResponse) => void }) {
  const { t } = useTranslation(NAMESPACE);
  const { stationId, lineName, directionStationId } = useReportSelection();
  const submitReport = useSubmitReport();
  const { verify, recordSubmission } = useReportVerification();

  const canSubmit = stationId !== null;
  const disabled = !canSubmit || submitReport.isPending;

  const handleSubmit = () => {
    if (!stationId) return;
    const rejection = verify(stationId);
    if (rejection) {
      toast.custom(
        () => (
          <ToastPill className="text-destructive flex w-fit items-center gap-2 text-sm font-semibold">
            <TriangleAlert className="size-4" />
            {t(REJECTION_MESSAGE[rejection])}
          </ToastPill>
        ),
        { id: 'report-verification' },
      );
      return;
    }
    submitReport.mutate(
      { stationId, lineName, directionStationId },
      {
        onSuccess: (result) => {
          notifySuccess();
          recordSubmission();
          track('report_submitted', {
            stationId: result.stationId,
            lineId: result.lineId,
            directionId: result.directionId,
          });
          onSubmitted(result);
        },
      },
    );
  };

  return (
    <footer className="pb-safe-4 mt-auto px-4 pt-6">
      <Button
        type="button"
        size="lg"
        disabled={disabled}
        onClick={handleSubmit}
        className={cn(
          'h-12 w-full rounded-lg text-base font-semibold',
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
  const { stationId: initialStationId } = routeApi.useSearch();
  const [result, setResult] = useState<SubmitReportResponse | null>(null);

  const handleSuccessClose = () => {
    navigate({ to: '/' });
    // Invite a contribution after a successful report, unless the user opted out.
    if (!isContributeDismissed()) openContributeModal('report_success');
  };

  return (
    <ReportSelectionProvider initialStationId={initialStationId}>
      <div className="bg-card animate-in fade-in fixed inset-0 z-30 duration-150">
        <div className="mx-auto flex h-full w-full max-w-md flex-col">
          {result ? (
            <ReportSuccess result={result} onClose={handleSuccessClose} />
          ) : (
            <>
              <PageHeader
                title={t('title')}
                onBack={() => navigate({ to: '/' })}
                action={
                  <FeedbackButton
                    source="report_form"
                    size="xs"
                    className="text-muted-foreground hover:text-foreground"
                  />
                }
              />
              <LinePicker />
              <StationPicker />
              <DirectionPicker />
              <SubmitFooter onSubmitted={setResult} />
            </>
          )}
        </div>
        {/* /report is outside the _map layout that hosts the app's Toaster, so mount one here. */}
        <Toaster />
      </div>
    </ReportSelectionProvider>
  );
}
