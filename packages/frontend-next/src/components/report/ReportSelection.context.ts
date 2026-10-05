import { createContext, useContext } from 'react';

import type { LineType, Station } from '@/api/transit';

/** Diacritic-insensitive match so "moritzplatz" finds "Möritzplatz" and "strasse" finds "Straße". */
export function normalizeStationQuery(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/ß/g, 'ss')
    .toLowerCase();
}

export type LineFilter = 'all' | LineType;

export type ReportSelectionContextValue = {
  lineName: string | null;
  lineFilter: LineFilter;
  stationId: string | null;
  stationQuery: string;
  directionStationId: string | null;

  selectLine: (name: string | null) => void;
  setLineFilter: (filter: LineFilter) => void;
  selectStation: (id: string | null) => void;
  setStationQuery: (query: string) => void;
  selectDirection: (id: string | null) => void;
  stationForSubmit: () => {
    stationId: string;
    lineName: string | null;
    directionStationId: string | null;
  } | null;

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
