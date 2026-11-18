import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronRight, MapPin, Search, TriangleAlert } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { type Station } from '@/api/transit';
import { FeedbackButton } from '@/components/feedback/FeedbackButton';
import { ReportLocationStep } from '@/components/map/UserLocationControl';
import { FullScreenPage } from '@/components/templates/full-screen-page';
import { PageHeader } from '@/components/templates/PageHeader';
import { Input } from '@freifahren/ui/input';
import { SectionHeading } from '@freifahren/ui/section-heading';
import { Separator } from '@freifahren/ui/separator';
import { ToastPill } from '@freifahren/ui/toast-pill';
import { Toaster } from '@/components/toaster';
import { useGeolocation } from '@/contexts/Geolocation.context';
import { useKeyboardScrollArea } from '@/hooks/use-keyboard-scroll-area';
import {
  markContributeShownAfterReport,
  openContributeModal,
  shouldOpenContributeAfterReport,
} from '@/lib/contribute-modal';
import { FEATURE_FLAGS, getFeatureFlagVariant } from '@/lib/feature-flags';
import { distanceMeters } from '@/lib/geo';
import { toast } from '@/lib/toast';
import { cn } from '@freifahren/ui/cn';

import { NAMESPACE } from './ReportForm.i18n';
import {
  normalizedStationName,
  normalizeStationQuery,
  useReportSelection,
} from './ReportSelection.context';
import { ReportSelectionProvider } from './ReportSelectionProvider';
import { ReportActionFooter } from './report-action-footer';
import { ReportSuccess } from './ReportSuccess';
import { ClearSelectionButton, LineBadgePicker, LineTypeTabs } from './line-picker-controls';
import { ReportVerifying } from './report-verifying';
import { SelectionButton } from './selection-button';
import { type ReportSelection, useReportSubmission } from './use-report-submission';

const routeApi = getRouteApi('/report');

const NEARBY_COUNT = 3;

function LinePicker() {
  const { t } = useTranslation(NAMESPACE);
  const {
    lineName,
    activeLineName,
    lineFilter,
    setLineFilter,
    selectLine,
    visibleLines,
    stationId,
  } = useReportSelection();

  return (
    <section className="px-4">
      {/* Stacked on phones: with enough route types (Berlin adds bus) the filters need ~420px
          beside the heading, so sharing a row cuts off the last one. */}
      <div className="mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeading hint={t('optional')}>{t('line')}</SectionHeading>
        <LineTypeTabs value={lineFilter} onChange={setLineFilter} />
      </div>

      {lineName && (
        <div className="mb-1 flex justify-end">
          <ClearSelectionButton onClick={() => selectLine(null)} />
        </div>
      )}

      <LineBadgePicker
        lines={visibleLines}
        selectedLine={activeLineName}
        onSelect={selectLine}
        wrap={stationId !== null}
      />
    </section>
  );
}

function StationPicker() {
  const { t } = useTranslation(NAMESPACE);
  const {
    stationId,
    tappedStationId,
    stationQuery,
    setStationQuery,
    selectStation,
    visibleStations,
  } = useReportSelection();
  const { position } = useGeolocation();

  const needle = normalizeStationQuery(stationQuery.trim());
  const filtered = needle
    ? visibleStations.filter((s) => normalizedStationName(s).includes(needle))
    : visibleStations;

  // Closest stations while sharing location and not searching. `visibleStations` is already
  // narrowed to the selected line, so this only surfaces nearby stations on that line.
  const nearby =
    position && !needle
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

  const clear = () => {
    selectStation(null);
    setStationQuery('');
  };

  const renderStationButton = (id: string, name?: string) => (
    <SelectionButton
      value={id}
      selectedValue={stationId}
      onSelect={(nextId) => {
        // A tap on a freshly chosen row always confirms it. A tap on the row already shown as
        // selected either confirms a live search match, or clears a tapped one.
        if (nextId !== null) {
          selectStation(nextId);
        } else if (tappedStationId !== null) {
          clear();
        } else if (stationId) {
          selectStation(stationId);
        }
      }}
      className="hover:bg-muted focus-visible:bg-muted flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm"
      // Inset: this button can render inside the scrollable result list, whose overflow-y
      // forces overflow-x into a clipping context too, cutting off an outset ring's bleed.
      selectedClassName="bg-muted ring-inset"
    >
      <span className="truncate">{name}</span>
    </SelectionButton>
  );

  const renderStation = (station: Station) => (
    <li key={station.id} className="border-border/60 border-b last:border-b-0">
      {renderStationButton(station.id, station.name)}
    </li>
  );

  return (
    <section
      className={cn('mt-6 flex flex-col px-4', tappedStationId === null && 'min-h-56 flex-1')}
    >
      <div className="mb-3 flex items-center justify-between">
        <SectionHeading
          hint={stationId !== null ? undefined : t('required')}
          hintTone="destructive"
        >
          {t('station')}
        </SectionHeading>
        {stationId && <ClearSelectionButton onClick={clear} />}
      </div>

      {tappedStationId !== null && renderStationButton(tappedStationId, visibleStations[0]?.name)}
      {tappedStationId === null && (
        <>
          <div className="relative mb-2">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={stationQuery}
              onChange={(e) => setStationQuery(e.target.value)}
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
                {t('noMatch', { query: stationQuery })}
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
                      className={cn(
                        'border-border/60',
                        // Virtualized rows can't rely on CSS :last-child (the window only
                        // covers visible rows), so the true last row is picked by index —
                        // otherwise its divider sticks out past the selected ring below it.
                        virtualRow.index !== rest.length - 1 && 'border-b',
                      )}
                    >
                      {renderStationButton(station.id, station.name)}
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
        {directionOptions.map((station) => (
          <li key={station.id} className="border-border/60 border-b last:border-b-0">
            <SelectionButton
              value={station.id}
              selectedValue={directionStationId}
              onSelect={selectDirection}
              className="hover:bg-muted focus-visible:bg-muted flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-opacity"
              selectedClassName="bg-muted"
            >
              <ChevronRight className="text-muted-foreground size-5 shrink-0" />
              <span className="truncate">{station.name}</span>
            </SelectionButton>
          </li>
        ))}
      </ul>
    </section>
  );
}

function showErrorToast(message: string, id: string) {
  toast.custom(
    () => (
      <ToastPill className="bg-destructive flex w-fit items-center gap-2 text-sm font-semibold text-white">
        <TriangleAlert className="size-4" />
        {message}
      </ToastPill>
    ),
    { id },
  );
}

function SubmitFooter({ onSubmit }: { onSubmit: (selection: ReportSelection) => void }) {
  const { t } = useTranslation(NAMESPACE);
  const { stationId, stationForSubmit } = useReportSelection();

  const canSubmit = stationId !== null;

  const handleSubmit = () => {
    // Keep an empty selection clickable so the user can learn what is missing.
    const selection = stationForSubmit();
    if (selection === null) {
      showErrorToast(t('errorNoStation'), 'report-station-required');
      return;
    }
    onSubmit(selection);
  };

  return (
    <ReportActionFooter
      label={t('submit')}
      onClick={handleSubmit}
      inactive={!canSubmit}
      showDisclaimer
    />
  );
}

export function ReportForm() {
  const { t } = useTranslation(NAMESPACE);
  const navigate = useNavigate();
  const { stationId: initialStationId, lineName: initialLineName } = routeApi.useSearch();
  const { phase, submit, reset, showSuccess } = useReportSubmission();
  const scrollAreaRef = useKeyboardScrollArea();

  const handleSuccessClose = () => {
    navigate({ to: '/' });
    const variant = getFeatureFlagVariant(FEATURE_FLAGS.contributeModalTiming);
    if (!shouldOpenContributeAfterReport(variant)) return;
    openContributeModal('report_success');
    markContributeShownAfterReport();
  };

  return (
    <ReportSelectionProvider initialStationId={initialStationId} initialLineName={initialLineName}>
      <FullScreenPage>
        {/* The whole form must scroll when directions or the keyboard leave too little room. */}
        <div
          ref={scrollAreaRef}
          className="mb-[max(var(--keyboard-inset),var(--browser-keyboard-inset,0px))] flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          {phase.kind === 'success' || phase.kind === 'saved_locally' ? (
            <ReportSuccess
              result={phase.result}
              savedLocally={phase.kind === 'saved_locally'}
              onClose={handleSuccessClose}
            />
          ) : (
            <>
              {phase.kind !== 'form' && (
                <ReportVerifying phase={phase} onBack={reset} onResultsRead={showSuccess} />
              )}
              {/* Hidden rather than unmounted while verifying, so the location step does not re-run
                  its permission prompt when the user comes back to the form. */}
              <div
                className={cn('flex min-h-0 flex-1 flex-col', phase.kind !== 'form' && 'hidden')}
              >
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
                <ReportLocationStep>
                  <LinePicker />
                  <StationPicker />
                  <DirectionPicker />
                  <SubmitFooter onSubmit={(selection) => void submit(selection)} />
                </ReportLocationStep>
              </div>
            </>
          )}
        </div>
        {/* /report is outside the _map layout that hosts the app's Toaster, so mount one here. */}
        <Toaster />
      </FullScreenPage>
    </ReportSelectionProvider>
  );
}
