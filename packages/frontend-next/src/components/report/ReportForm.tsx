import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronRight, MapPin, Search, Send, TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useReportingEnabled } from '@/api/config';
import {
  isReportingDisabledError,
  SubmitReportError,
  type SubmitReportResponse,
  useSubmitReport,
} from '@/api/reports';
import { LINE_TYPE_PRIORITY, type LineType, type Station } from '@/api/transit';
import { FeedbackButton } from '@/components/feedback/FeedbackButton';
import { ReportLocationStep } from '@/components/map/UserLocationControl';
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
import { currentCity } from '@/lib/city';
import { captureIssue } from '@/lib/error-monitoring';
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

const LINE_TYPES = new Set<string>(Object.keys(LINE_TYPE_PRIORITY));

const FILTERS: LineFilter[] = [
  'all',
  ...currentCity.seed.routeTypePriority
    .filter((type): type is LineType => LINE_TYPES.has(type))
    .sort((a, b) => LINE_TYPE_PRIORITY[a] - LINE_TYPE_PRIORITY[b]),
];

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
          'shrink-0 rounded-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-white/50',
          isSelected && 'ring-2 ring-white',
          lineName && !isSelected && 'opacity-40',
        )}
      >
        <LineBadge name={line.name} />
      </button>
    );
  });

  return (
    <section className="px-4">
      {/* Stacked on phones: with enough route types (Berlin adds bus) the filters need ~420px
          beside the heading, so sharing a row cuts off the last one. */}
      <div className="mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeading hint={t('optional')}>{t('line')}</SectionHeading>
        <ToggleGroup
          type="single"
          size="sm"
          value={lineFilter}
          onValueChange={(value) => {
            if (value) setLineFilter(value as LineFilter);
          }}
          className="bg-surface-solid border-border max-w-full overflow-x-auto border"
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
        <div className="-mx-4 overflow-x-auto px-4 py-1.5">
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

  // The full station list is hundreds of rows. Virtualize it so only the visible rows mount.
  // `nearby` (≤3) renders in normal flow above the list, so scrollMargin offsets the virtualizer
  // past it (the scroll container is `relative` so listRef.offsetTop is measured against it).
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const virtualizer = useVirtualizer({
    count: rest.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 45,
    overscan: 10,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });

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
        <div className="bg-muted flex items-center rounded-md px-3 py-2.5 text-sm ring-2 ring-white">
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
          <div
            ref={scrollRef}
            className="relative min-h-0 flex-1 overflow-y-auto mask-b-from-[calc(100%-2.5rem)] mask-b-to-100% pb-2"
          >
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
            {needle && filtered.length === 0 ? (
              <p className="text-muted-foreground px-3 py-6 text-center text-sm">
                {t('noMatch', { query })}
              </p>
            ) : (
              <ul
                ref={listRef}
                style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const station = rest[virtualRow.index];
                  return (
                    <li
                      key={station.id}
                      ref={virtualizer.measureElement}
                      data-index={virtualRow.index}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
                      }}
                      className="border-border/60 border-b"
                    >
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
                })}
              </ul>
            )}
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
                  'hover:bg-muted focus-visible:bg-muted flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-opacity outline-none',
                  isSelected && 'bg-muted ring-2 ring-white',
                  directionStationId && !isSelected && 'opacity-40',
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

function TelegramFallbackNotice({ title, body }: { title: string; body: string }) {
  const { t } = useTranslation(NAMESPACE);
  const telegramHandle = currentCity.community.telegramHandle;
  const telegramUrl = telegramHandle
    ? `https://t.me/${telegramHandle.replace(/^@/, '')}`
    : undefined;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <TriangleAlert className="text-muted-foreground size-8" />
      <div className="space-y-2">
        <p className="font-heading text-base font-semibold">{title}</p>
        <p className="text-muted-foreground text-sm">{body}</p>
      </div>
      {telegramUrl && (
        <Button
          asChild
          size="lg"
          className="bg-accent-bright text-primary-foreground hover:bg-accent-press h-12 rounded-lg px-6 text-base font-semibold shadow-[0_6px_16px_rgba(214,59,59,0.28)]"
        >
          <a href={telegramUrl} target="_blank" rel="noopener noreferrer">
            <Send data-icon="inline-start" />
            {t('disabledTelegramCta')}
          </a>
        </Button>
      )}
    </div>
  );
}

const REPEATED_FAILURE_THRESHOLD = 3;

function SubmitFooter({
  onSubmitted,
  onReportingDisabled,
  onRepeatedFailure,
}: {
  onSubmitted: (result: SubmitReportResponse) => void;
  onReportingDisabled: () => void;
  onRepeatedFailure: () => void;
}) {
  const { t } = useTranslation(NAMESPACE);
  const { stationId, lineName, directionStationId } = useReportSelection();
  const submitReport = useSubmitReport();
  const { verify, recordSubmission } = useReportVerification();
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  const canSubmit = stationId !== null;

  const handleSubmit = () => {
    /*
     * The button reads as disabled but stays clickable (aria-disabled, not disabled), because a
     * truly disabled button swallows the tap and a user who has not noticed the station picker
     * gets no feedback at all. Tell them what is missing instead.
     */
    if (stationId === null) {
      toast.custom(
        () => (
          <ToastPill className="bg-destructive flex w-fit items-center gap-2 text-sm font-semibold text-white">
            <TriangleAlert className="size-4" />
            {t('errorNoStation')}
          </ToastPill>
        ),
        { id: 'report-station-required' },
      );
      return;
    }
    const rejection = verify(stationId);
    if (rejection) {
      track('report_rejected', { reason: rejection, stationId });
      toast.custom(
        () => (
          <ToastPill className="bg-destructive flex w-fit items-center gap-2 text-sm font-semibold text-white">
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
          setConsecutiveFailures(0);
          notifySuccess();
          recordSubmission();
          track('report_submitted', {
            stationId: result.stationId,
            lineId: result.lineId,
            directionId: result.directionId,
          });
          onSubmitted(result);
        },
        onError: (error) => {
          /*
           * Backstop for the cases the probe cannot cover: the switch flipping between the probe
           * and this submit, and a client whose probe never answered (offline, or an install that
           * has not reached the API since). Without it the user fills in the whole form and gets a
           * generic failure for a state the API told us about explicitly.
           */
          if (isReportingDisabledError(error)) {
            onReportingDisabled();
            return;
          }
          /*
           * Every other failure (network error, an edge block before the token is even checked,
           * an unexpected 5xx, …) must still tell the user something happened — otherwise the
           * button just re-enables silently and a tap that produced no report reads as tapping
           * nothing at all.
           */
          captureIssue('Report submit failed', {
            status: error instanceof SubmitReportError ? error.status : undefined,
          });
          const failureCount = consecutiveFailures + 1;
          setConsecutiveFailures(failureCount);
          if (failureCount >= REPEATED_FAILURE_THRESHOLD) {
            onRepeatedFailure();
            return;
          }
          toast.custom(
            () => (
              <ToastPill className="bg-destructive flex w-fit items-center gap-2 text-sm font-semibold text-white">
                <TriangleAlert className="size-4" />
                {t('errorSubmitFailed')}
              </ToastPill>
            ),
            { id: 'report-submit-error' },
          );
        },
      },
    );
  };

  return (
    <footer className="pb-safe-4 mt-auto px-4 pt-6">
      <Button
        type="button"
        size="lg"
        disabled={submitReport.isPending}
        aria-disabled={!canSubmit}
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
  const { stationId: initialStationId, lineName: initialLineName } = routeApi.useSearch();
  const [result, setResult] = useState<SubmitReportResponse | null>(null);
  const [refusedBySubmit, setRefusedBySubmit] = useState(false);
  const [repeatedFailure, setRepeatedFailure] = useState(false);
  const reportingEnabled = useReportingEnabled();

  const handleSuccessClose = () => {
    navigate({ to: '/' });
    // Invite a contribution after a successful report, unless the user opted out.
    if (!isContributeDismissed()) openContributeModal('report_success');
  };

  return (
    <ReportSelectionProvider initialStationId={initialStationId} initialLineName={initialLineName}>
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
              {reportingEnabled && !refusedBySubmit && !repeatedFailure ? (
                <ReportLocationStep>
                  <LinePicker />
                  <StationPicker />
                  <DirectionPicker />
                  <SubmitFooter
                    onSubmitted={setResult}
                    onReportingDisabled={() => setRefusedBySubmit(true)}
                    onRepeatedFailure={() => setRepeatedFailure(true)}
                  />
                </ReportLocationStep>
              ) : repeatedFailure ? (
                <TelegramFallbackNotice
                  title={t('submitFailedTitle')}
                  body={t('submitFailedBody')}
                />
              ) : (
                <TelegramFallbackNotice title={t('disabledTitle')} body={t('disabledBody')} />
              )}
            </>
          )}
        </div>
        {/* /report is outside the _map layout that hosts the app's Toaster, so mount one here. */}
        <Toaster />
      </div>
    </ReportSelectionProvider>
  );
}
