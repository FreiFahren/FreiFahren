import { createContext, useContext } from 'react';

import type { LineType, Station } from '@/api/transit';

export type LineFilter = 'all' | LineType;

export type ReportSelectionContextValue = {
  lineName: string | null;
  lineFilter: LineFilter;
  stationId: string | null;
  directionStationId: string | null;

  selectLine: (name: string | null) => void;
  setLineFilter: (filter: LineFilter) => void;
  selectStation: (id: string | null) => void;
  selectDirection: (id: string | null) => void;

  visibleLines: { name: string; type: LineType }[];
  visibleStations: Station[];
  directionOptions: Station[];
};

export const ReportSelectionContext = createContext<ReportSelectionContextValue | null>(null);

export function useReportSelection(): ReportSelectionContextValue {
  const ctx = useContext(ReportSelectionContext);
  if (!ctx) throw new Error('useReportSelection must be used within ReportSelectionProvider');
  return ctx;
}
