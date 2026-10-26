import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

type FundHistoryStatusProps = {
  icon: LucideIcon;
  iconClassName: string;
  label: string;
  paidAt?: string | null;
  showTime?: boolean;
  description?: string;
  descriptionId?: string;
};

export function FundHistoryStatus({
  icon: Icon,
  iconClassName,
  label,
  paidAt,
  showTime = false,
  description,
  descriptionId,
}: FundHistoryStatusProps) {
  const { i18n } = useTranslation();

  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-start gap-1.5" aria-describedby={descriptionId}>
        <Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', iconClassName)} />
        {label}
      </span>
      {paidAt && (
        <time
          dateTime={paidAt}
          className="text-muted-foreground block pl-5.5 text-xs leading-relaxed"
        >
          {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(paidAt))}
          {showTime && (
            <span className="block">
              {new Intl.DateTimeFormat(i18n.language, { timeStyle: 'short' }).format(
                new Date(paidAt),
              )}
            </span>
          )}
        </time>
      )}
      {description && (
        <p className="text-muted-foreground pl-5.5 text-xs leading-relaxed">{description}</p>
      )}
    </div>
  );
}
