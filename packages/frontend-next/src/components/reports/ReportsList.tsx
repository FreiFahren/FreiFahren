import { Link } from '@tanstack/react-router';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { DAY_MS, HOUR_MS, useReports } from '@/api/reports';
import {
  ClearSelectionButton,
  LineBadgePicker,
  LineTypeTabs,
} from '@/components/report/line-picker-controls';
import { LineBadge } from '@/components/transit/LineBadge';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/ui/section-heading';
import { Route as LineDetailRoute } from '@/routes/_map/line/$lineName';

import { NAMESPACE } from './Reports.i18n';
import { ReportRow } from './ReportRow';
import { useReportLineFilter } from './use-report-line-filter';

export function ReportsList() {
  const { t } = useTranslation(NAMESPACE);
  const { data: reports } = useReports(DAY_MS);
  // A report is "recent" if it falls in the last-hour window (shares the cache, no extra fetch).
  const { data: recentReports } = useReports(HOUR_MS);
  const {
    activeLine,
    filteredReports: filtered,
    lineFilter,
    lineName,
    pickerOpen,
    selectLine,
    setLineFilter,
    togglePicker,
    visibleLines,
  } = useReportLineFilter(reports);
  const recentKeys = new Set(
    (recentReports ?? []).map((report) => `${report.stationId}-${report.timestamp}`),
  );

  const sortedFiltered = filtered.slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // The day window can hold hundreds of reports (p90 ~416). Virtualize so only the visible rows
  // mount — mounting the whole list synchronously on tab-switch was the cause of the poor INP.
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: sortedFiltered.length,
    getScrollElement: () => scrollRef.current,
    // Single-line rows are ~57px; rows with a direction line are taller. measureElement corrects
    // the estimate per row once mounted, so the exact value only affects initial scroll sizing.
    estimateSize: () => 57,
    overscan: 8,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [lineName]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-3">
        <SectionHeading>{t('sectionReports')}</SectionHeading>
        <Button
          variant="outline"
          size="sm"
          aria-label={t('filterByLine')}
          aria-expanded={pickerOpen}
          aria-controls="reports-line-picker"
          onClick={togglePicker}
        >
          {activeLine ? <LineBadge name={activeLine.name} /> : t('allLines')}
          <ChevronDown className="text-muted-foreground size-3.5" aria-hidden />
        </Button>
      </div>
      {pickerOpen && (
        <section id="reports-line-picker" className="border-border/60 shrink-0 border-b px-4 pb-3">
          <div className="mb-3 flex flex-col items-start gap-2">
            <SectionHeading>{t('filterByLine')}</SectionHeading>
            <LineTypeTabs value={lineFilter} onChange={setLineFilter} />
          </div>
          {activeLine && (
            <div className="mb-1 flex justify-end">
              <ClearSelectionButton onClick={() => selectLine(null)} />
            </div>
          )}
          <LineBadgePicker
            lines={visibleLines}
            selectedLine={activeLine?.name ?? null}
            onSelect={selectLine}
          />
        </section>
      )}
      {activeLine && (
        <Link
          to={LineDetailRoute.to}
          params={{ lineName: activeLine.name }}
          search={{ source: 'reports_list' }}
          className="text-muted-foreground hover:bg-muted/70 hover:text-foreground focus-visible:ring-ring border-border/60 flex min-h-11 shrink-0 items-center justify-between gap-3 border-b px-4 text-sm outline-none focus-visible:ring-2"
        >
          {t('moreInfo', { line: activeLine.name })}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-sm">
            {activeLine ? t('emptyFiltered', { line: activeLine.name }) : t('emptyRecent')}
          </p>
        ) : (
          <ul style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const report = sortedFiltered[virtualRow.index];
              if (!report) return null;
              const key = `${report.stationId}-${report.timestamp}`;
              return (
                <ReportRow
                  key={`${key}-${virtualRow.index}`}
                  ref={virtualizer.measureElement}
                  dataIndex={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  report={report}
                  recent={recentKeys.has(key)}
                />
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
