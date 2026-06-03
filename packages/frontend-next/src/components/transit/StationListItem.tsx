import {
  compareLineOrder,
  type LineType,
  resolveStationLineNames,
  type Station,
  useLines,
} from '@/api/transit';
import { LineBadge } from '@/components/transit/LineBadge';
import { cn } from '@/lib/utils';

type StationListItemProps = {
  station: Station;
  onClick: () => void;
  selected?: boolean;
};

export function StationListItem({ station, onClick, selected }: StationListItemProps) {
  const { data: lines } = useLines();
  const lineNames = resolveStationLineNames(station.lines, lines);

  const typeByName = new Map<string, LineType>();
  if (lines) for (const line of lines) typeByName.set(line.name, line.type);
  const sortedNames = [...lineNames].sort((a, b) =>
    compareLineOrder({ name: a, type: typeByName.get(a) }, { name: b, type: typeByName.get(b) }),
  );

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'hover:bg-muted focus-visible:bg-muted flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left outline-none',
        selected && 'ring-2 ring-white ring-inset',
      )}
    >
      <span className="shrink-0 text-sm">{station.name}</span>
      <div className="ml-auto flex min-w-0 gap-1 overflow-hidden">
        {sortedNames.map((name) => (
          <LineBadge key={name} name={name} className="shrink-0" />
        ))}
      </div>
    </button>
  );
}
