import type { Report } from '@/api/reports';
import type { Line, Stations } from '@/api/transit';

export function reportDirectionBearing(
  report: Report,
  lines: Line[],
  stations: Stations,
): number | null {
  if (!report.directionId || !report.lineId) return null;
  const line = lines.find((line) => line.id === report.lineId);
  if (!line || line.isCircular) return null;
  const fromIndex = line.stations.indexOf(report.stationId);
  const toIndex = line.stations.indexOf(report.directionId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return null;

  // Follow the local route, not the straight line to a potentially distant terminus.
  const from = stations[report.stationId]?.coordinates;
  const next = stations[line.stations[fromIndex + Math.sign(toIndex - fromIndex)]]?.coordinates;
  if (!from || !next) return null;
  const radians = Math.PI / 180;
  const x = (next.longitude - from.longitude) * radians;
  const y =
    Math.log(Math.tan(Math.PI / 4 + (next.latitude * radians) / 2)) -
    Math.log(Math.tan(Math.PI / 4 + (from.latitude * radians) / 2));
  if (x === 0 && y === 0) return null;
  return (Math.atan2(x, y) / radians + 360) % 360;
}
