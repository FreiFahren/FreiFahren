import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { DAY_MS, HOUR_MS, useReports } from '@/api/reports';
import { SectionHeading } from '@/components/ui/section-heading';

import { NAMESPACE } from './Reports.i18n';
import { ReportRow } from './ReportRow';

export function ReportsList() {
  const { t } = useTranslation(NAMESPACE);
  const { data: reports } = useReports(DAY_MS);
  // A report is "recent" if it falls in the last-hour window (shares the cache, no extra fetch).
  const { data: recentReports } = useReports(HOUR_MS);
  const recentKeys = new Set(
    (recentReports ?? []).map((report) => `${report.stationId}-${report.timestamp}`),
  );

  const sorted = (reports ?? []).slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // The day window can hold hundreds of reports (p90 ~416). Virtualize so only the visible rows
  // mount — mounting the whole list synchronously on tab-switch was the cause of the poor INP.
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    // Single-line rows are ~57px; rows with a direction line are taller. measureElement corrects
    // the estimate per row once mounted, so the exact value only affects initial scroll sizing.
    estimateSize: () => 57,
    overscan: 8,
  });

  return (
    <div className="flex h-full flex-col">
      <SectionHeading className="px-4 py-3">{t('sectionReports')}</SectionHeading>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <ul style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const report = sorted[virtualRow.index];
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
      </div>
    </div>
  );
}
