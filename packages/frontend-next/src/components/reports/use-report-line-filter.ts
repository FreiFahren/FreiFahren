import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { type Report } from '@/api/reports';
import { useLines } from '@/api/transit';
import { type LineFilter } from '@/components/report/ReportSelection.context';
import { track } from '@/lib/analytics';
import { Route as StationsRoute } from '@/routes/reports/stations';

import {
  filterReportsByLine,
  getReportLinesByType,
  getSelectableReportLines,
} from './report-line-filter';

export function useReportLineFilter(reports: Report[] | undefined) {
  const navigate = useNavigate();
  const { lineName } = StationsRoute.useSearch();
  const { data: lines } = useLines();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lineFilterOverride, setLineFilterOverride] = useState<{
    lineName: string | undefined;
    value: LineFilter;
  } | null>(null);

  const activeLine = lines?.find((line) => line.name === lineName);
  const activeLineFilterOverride = lineFilterOverride;
  let lineFilter: LineFilter = activeLine?.type ?? 'all';
  if (activeLineFilterOverride && activeLineFilterOverride.lineName === lineName) {
    lineFilter = activeLineFilterOverride.value;
  }
  const selectableLines = getSelectableReportLines(lines);
  const visibleLines = getReportLinesByType(selectableLines, lineFilter);
  // Ignore stale or cross-city deep links once the current city's lines have loaded.
  const filteredReports = filterReportsByLine(reports ?? [], lines, activeLine?.name);

  const setLineFilter = (value: LineFilter) => {
    setLineFilterOverride({ lineName, value });
  };

  const selectLine = (name: string | null) => {
    const selectedLine = name ? lines?.find((line) => line.name === name) : activeLine;
    track('reports_line_filter_used', {
      action: name ? 'selected' : 'cleared',
      line_id: selectedLine?.name ?? null,
      line_type: selectedLine?.type ?? null,
    });
    setPickerOpen(false);
    void navigate({
      to: StationsRoute.to,
      search: { lineName: name ?? undefined },
    });
  };

  const togglePicker = () => {
    const nextOpen = !pickerOpen;
    setPickerOpen(nextOpen);
    if (nextOpen) {
      track('reports_line_filter_used', {
        action: 'opened',
        line_id: activeLine?.name ?? null,
        line_type: activeLine?.type ?? null,
      });
    }
  };

  return {
    activeLine,
    filteredReports,
    lineFilter,
    lineName,
    pickerOpen,
    visibleLines,
    selectLine,
    setLineFilter,
    togglePicker,
  };
}
