import { useLines } from '@/api/transit';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type LineBadgeProps = {
  name: string;
  className?: string;
};

function findLineColor(
  name: string,
  lines: ReturnType<typeof useLines>['data'],
): string | undefined {
  return lines?.find((line) => line.name === name)?.color;
}

export function LineBadge({ name, className }: LineBadgeProps) {
  const { data: lines } = useLines();
  const color = findLineColor(name, lines);

  return (
    <Badge
      className={cn('h-7 w-12 rounded-sm px-2 text-xs font-semibold text-white', className)}
      style={color ? { backgroundColor: color } : undefined}
    >
      {name}
    </Badge>
  );
}
