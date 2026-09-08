import { type Station } from '@/api/transit';
import { StationListItem } from '@/components/transit/StationListItem';
import { Card } from '@/components/ui/card';

const MAX_RESULTS = 8;

function matchStations(stations: Station[], query: string): Station[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const results: Station[] = [];
  for (const station of stations) {
    if (station.name.toLowerCase().includes(needle)) {
      results.push(station);
      if (results.length === MAX_RESULTS) break;
    }
  }
  return results;
}

type StationPickerProps = {
  stations: Station[] | undefined;
  query: string;
  onSelect: (station: Station) => void;
  emptyLabel: string;
  className?: string;
};

/** Result list shared by the map search and the journey planner. */
export function StationPicker({
  stations,
  query,
  onSelect,
  emptyLabel,
  className,
}: StationPickerProps) {
  const results = matchStations(stations ?? [], query);

  return (
    <Card
      className={
        className ??
        'animate-in fade-in slide-in-from-top-2 mt-2 max-h-[60vh] gap-0 overflow-auto p-1 duration-150'
      }
    >
      {results.length === 0 ? (
        <div className="text-muted-foreground px-3 py-4 text-sm">{emptyLabel}</div>
      ) : (
        results.map((station) => (
          <StationListItem key={station.id} station={station} onClick={() => onSelect(station)} />
        ))
      )}
    </Card>
  );
}
