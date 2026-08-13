import { createContext, useContext } from 'react';

import type { Report } from '@/api/reports';

export type ReportSimulationState = {
  reports: Report[] | null;
  nowMs: number | null;
};

export type ReportSimulationContextValue = ReportSimulationState & {
  setSimulation: (state: ReportSimulationState) => void;
};

export const ReportSimulationContext = createContext<ReportSimulationContextValue | null>(null);

export function useReportSimulation(): ReportSimulationContextValue {
  const ctx = useContext(ReportSimulationContext);
  if (!ctx) throw new Error('useReportSimulation must be used within ReportSimulationProvider');
  return ctx;
}
