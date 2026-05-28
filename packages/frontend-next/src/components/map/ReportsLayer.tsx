import { useReports } from '@/api/reports';
import { useStations } from '@/api/transit';

import { ReportMarker } from './ReportMarker';

export function ReportsLayer() {
  const { data: reports } = useReports();
  const { data: stations } = useStations();

  if (!reports || !stations) return null;

  return (
    <>
      {reports.map((report, index) => {
        const station = stations[report.stationId];
        if (!station) return null;
        return (
          <ReportMarker key={`${report.stationId}-${index}`} report={report} station={station} />
        );
      })}
    </>
  );
}
