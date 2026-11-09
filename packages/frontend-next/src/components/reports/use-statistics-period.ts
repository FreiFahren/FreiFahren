import { createContext, useContext } from 'react';

import type { StatisticsPeriod } from '@/api/statistics';

export type PeriodState = [StatisticsPeriod, (period: StatisticsPeriod) => void];

export const StatisticsPeriodContext = createContext<PeriodState | null>(null);

export function useStatisticsPeriod(): PeriodState {
  const state = useContext(StatisticsPeriodContext);
  if (state === null) {
    throw new Error('useStatisticsPeriod must be used inside StatisticsPeriodProvider');
  }
  return state;
}
