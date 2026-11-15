import { createContext, useContext } from 'react';

import type { ReportSummaryPeriod } from '@/api/insights';

export type PeriodState = [ReportSummaryPeriod, (period: ReportSummaryPeriod) => void];

export const StatisticsPeriodContext = createContext<PeriodState | null>(null);

export function useStatisticsPeriod(): PeriodState {
  const state = useContext(StatisticsPeriodContext);
  if (state === null) {
    throw new Error('useStatisticsPeriod must be used inside StatisticsPeriodProvider');
  }
  return state;
}
