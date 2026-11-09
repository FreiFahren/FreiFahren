import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { STATISTICS_PERIODS, type StatisticsPeriod } from '@/api/statistics';
import { ToggleGroup, ToggleGroupItem } from '@freifahren/ui/toggle-group';
import { track } from '@/lib/analytics';
import { cn } from '@freifahren/ui/cn';

import { NAMESPACE } from './Reports.i18n';
import { StatisticsPeriodContext, useStatisticsPeriod } from './use-statistics-period';

/** Shares the selected period across the reports tabs, which all render inside one layout. */
export function StatisticsPeriodProvider({ children }: { children: ReactNode }) {
  const state = useState<StatisticsPeriod>('24h');
  return (
    <StatisticsPeriodContext.Provider value={state}>{children}</StatisticsPeriodContext.Provider>
  );
}

export function StatisticsPeriodPicker({ className }: { className?: string }) {
  const { t } = useTranslation(NAMESPACE);
  const [period, setPeriod] = useStatisticsPeriod();

  return (
    <ToggleGroup
      type="single"
      size="sm"
      value={period}
      onValueChange={(next) => {
        if (!next) return;
        setPeriod(next as StatisticsPeriod);
        track('reports_period_selected', { period: next as StatisticsPeriod });
      }}
      aria-label={t('periodPickerLabel')}
      className={cn('bg-surface-solid border-border border', className)}
    >
      {STATISTICS_PERIODS.map((option) => (
        <ToggleGroupItem
          key={option}
          value={option}
          className="text-muted-foreground data-[state=on]:bg-surface-elev data-[state=on]:text-foreground font-semibold tracking-wide"
        >
          {t(`periodShort.${option}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
