import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type LineBadgeProps = {
  name: string;
  color?: string;
  className?: string;
};

export function LineBadge({ name, color, className }: LineBadgeProps) {
  return (
    <Badge
      className={cn('h-6 rounded-sm px-2 text-xs font-semibold text-white', className)}
      style={color ? { backgroundColor: color } : undefined}
    >
      {name}
    </Badge>
  );
}
