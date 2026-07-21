import { useTranslation } from 'react-i18next';

import { CardContent } from '@/components/ui/card';

import { NAMESPACE } from './LineDetail.i18n';

type LineCurrentActivityProps = {
  reportsInLast24Hours: number;
  reportsInLastHour: number;
};

export function LineCurrentActivity({
  reportsInLast24Hours,
  reportsInLastHour,
}: LineCurrentActivityProps) {
  const { t } = useTranslation(NAMESPACE);

  return (
    <section aria-labelledby="line-current-activity-heading" className="shrink-0">
      <CardContent className="shrink-0 space-y-2 pt-1">
        <h3
          id="line-current-activity-heading"
          className="text-text-3 text-[11px] font-semibold tracking-widest uppercase"
        >
          {t('currentActivity')}
        </h3>
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">
              {t('reportsLast24Hours', { count: reportsInLast24Hours })}
            </p>
            <p className="text-muted-foreground text-xs">{t('reportedSightings')}</p>
          </div>
          <p className="text-muted-foreground text-right text-sm">
            {reportsInLastHour > 0
              ? t('reportsInLastHour', { count: reportsInLastHour })
              : t('noneInLastHour')}
          </p>
        </div>
      </CardContent>
    </section>
  );
}
