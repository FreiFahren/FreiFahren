import { cn } from '@/lib/utils';

export function FullScreenPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="bg-card animate-in fade-in fixed inset-0 z-30 duration-150">
      <div className={cn('mx-auto flex h-full w-full max-w-md flex-col', className)}>
        {children}
      </div>
    </div>
  );
}
