import { createContext, useContext } from 'react';

import type { LineType } from '@/api/transit';

export type LineFilter = 'all' | LineType;

export type ReportSelectionContextValue = {
  lineName: string | null;
  setLineName: (name: string | null) => void;
  lineFilter: LineFilter;
  setLineFilter: (filter: LineFilter) => void;
  stationId: string | null;
  setStationId: (id: string | null) => void;
};

export const ReportSelectionContext = createContext<ReportSelectionContextValue | null>(null);

export function useReportSelection(): ReportSelectionContextValue {
  const ctx = useContext(ReportSelectionContext);
  if (!ctx) throw new Error('useReportSelection must be used within ReportSelectionProvider');
  return ctx;
}
