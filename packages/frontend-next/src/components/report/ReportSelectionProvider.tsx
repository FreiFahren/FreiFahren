import { type ReactNode, useMemo, useState } from 'react';

import {
  type LineFilter,
  ReportSelectionContext,
  type ReportSelectionContextValue,
} from './ReportSelection.context';

export function ReportSelectionProvider({ children }: { children: ReactNode }) {
  const [lineName, setLineName] = useState<string | null>(null);
  const [lineFilter, setLineFilter] = useState<LineFilter>('all');
  const [stationId, setStationIdState] = useState<string | null>(null);

  // Clearing the station also clears the chosen line so the user starts fresh.
  const setStationId = (id: string | null) => {
    setStationIdState(id);
    if (id === null) setLineName(null);
  };

  const value = useMemo<ReportSelectionContextValue>(
    () => ({ lineName, setLineName, lineFilter, setLineFilter, stationId, setStationId }),
    [lineName, lineFilter, stationId],
  );

  return <ReportSelectionContext value={value}>{children}</ReportSelectionContext>;
}
