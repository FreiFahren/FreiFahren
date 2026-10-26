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

const normalizedNames = new WeakMap<Station, string>();

/** Cached per station object so filtering on every keystroke doesn't re-normalize every name. */
export function normalizedStationName(station: Station): string {
  let name = normalizedNames.get(station);
  if (name === undefined) {
    name = normalizeStationQuery(station.name);
    normalizedNames.set(station, name);
  }
  return name;
}

export type LineFilter = 'all' | LineType;

export type ReportSelectionContextValue = {
  lineName: string | null;
  /** The explicit line, or the single line of the auto-matched/selected station. */
  activeLineName: string | null;
  lineFilter: LineFilter;
  stationId: string | null;
  /** Set by a tap or deep link; null while `stationId` is only a live unique search match. */
  tappedStationId: string | null;
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
