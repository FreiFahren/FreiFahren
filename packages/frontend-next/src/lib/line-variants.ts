import type { Line } from '@/api/transit';
import type { LineDetailLine } from '@/components/map/LineDetail';

function mergeStationOrder(variants: Line[]): string[] {
  const orderedVariants = [...variants].sort((a, b) => b.stations.length - a.stations.length);
  const stations = [...orderedVariants[0]!.stations];
  const seen = new Set(stations);

  for (const variant of orderedVariants.slice(1)) {
    for (const [index, stationId] of variant.stations.entries()) {
      if (seen.has(stationId)) continue;

      const nextKnownStation = variant.stations.slice(index + 1).find((id) => seen.has(id));
      if (nextKnownStation) stations.splice(stations.indexOf(nextKnownStation), 0, stationId);
      else stations.push(stationId);
      seen.add(stationId);
    }
  }

  return stations;
}

/** A line as its detail shows it: the variants that share its name, merged into one. */
export function mergeLineVariants(variants: Line[]): LineDetailLine {
  const representative = variants.reduce((longest, line) =>
    line.stations.length > longest.stations.length ? line : longest,
  );
  return {
    name: representative.name,
    type: representative.type,
    color: representative.color,
    isCircular: variants.some((line) => line.isCircular),
    stations: mergeStationOrder(variants),
    variantIds: variants.map((line) => line.id),
  };
}
