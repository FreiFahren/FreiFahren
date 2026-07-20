import type { LineInsights } from '@/api/insights';

type RhythmChartProps = {
  hours: LineInsights['profile']['hours'];
  currentHour: number;
  label: string;
};

export function RhythmChart({ hours, currentHour, label }: RhythmChartProps) {
  const peak = Math.max(1, ...hours.map((hour) => hour.value));

  return (
    <div className="h-24" role="img" aria-label={label}>
      <div className="relative flex h-20 items-end gap-px border-b border-white/15 px-1">
        {hours.map(({ hour, value }) => (
          <div key={hour} className="flex h-full min-w-0 flex-1 items-end">
            <div
              className="bg-muted-foreground/45 w-full rounded-t-sm"
              style={{ height: `${Math.max(3, (value / peak) * 100)}%` }}
            />
          </div>
        ))}
        <span
          aria-hidden="true"
          className="bg-foreground/45 absolute top-1 bottom-0 w-px"
          style={{ left: `${((currentHour + 0.5) / 24) * 100}%` }}
        />
      </div>
      <div className="text-text-4 mt-1 flex justify-between px-1 text-[10px]">
        <span>0h</span>
        <span>6h</span>
        <span>12h</span>
        <span>18h</span>
      </div>
    </div>
  );
}
