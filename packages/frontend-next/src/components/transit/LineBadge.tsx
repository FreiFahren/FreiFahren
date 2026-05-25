import { useLines, useSegments } from '@/api/transit';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type LineBadgeProps = {
  name: string;
  className?: string;
};

function findLineColor(
  name: string,
  lines: ReturnType<typeof useLines>['data'],
  segments: ReturnType<typeof useSegments>['data'],
): string | undefined {
  if (!lines || !segments) return undefined;
  const lineIds = new Set<string>();
  for (const line of lines) {
    if (line.name === name) lineIds.add(line.id);
  }
  if (lineIds.size === 0) return undefined;
  for (const feature of segments.features) {
    if (lineIds.has(feature.properties.line)) return feature.properties.color;
  }
  return undefined;
}

export function LineBadge({ name, className }: LineBadgeProps) {
  const { data: lines } = useLines();
  const { data: segments } = useSegments();
  const color = findLineColor(name, lines, segments);

  return (
    <Badge
      className={cn('h-6 rounded-sm px-2 text-xs font-semibold text-white', className)}
      style={color ? { backgroundColor: color } : undefined}
    >
      {name}
    </Badge>
  );
}
