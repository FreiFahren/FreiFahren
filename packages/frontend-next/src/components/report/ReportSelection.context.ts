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
  /** The explicit line, or the single line of the auto-matched/selected station. */
  activeLineName: string | null;
  lineFilter: LineFilter;
  stationId: string | null;
  /** Whether stationId was explicitly confirmed (manual tap / deep link) vs. just an auto-matched preview. */
  isStationLocked: boolean;
  stationQuery: string;
  directionStationId: string | null;

  selectLine: (name: string | null) => void;
  setLineFilter: (filter: LineFilter) => void;
  /** `locked` defaults to true (manual tap); pass false for a non-committing auto-match preview. */
  selectStation: (id: string | null, locked?: boolean) => void;
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
  previewStationId: string | null;
};

export const ReportSelectionContext = createContext<ReportSelectionContextValue | null>(null);

export function useReportSelection(): ReportSelectionContextValue {
  const ctx = useContext(ReportSelectionContext);
  if (!ctx) throw new Error('useReportSelection must be used within ReportSelectionProvider');
  return ctx;
}
