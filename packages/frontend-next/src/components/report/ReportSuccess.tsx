import { Check, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { SubmitReportResponse } from '@/api/reports';
import { useLines, useStations } from '@/api/transit';
import { SocialLinks } from '@/components/map/SocialLinks';
import { LineBadge } from '@/components/transit/LineBadge';
import { Button } from '@/components/ui/button';
import { useCountAnimation } from '@/hooks/useCountAnimation';
import { pickReporterCount } from '@/lib/reporters';

import { ReportFeedback } from './ReportFeedback';
import { NAMESPACE } from './ReportSuccess.i18n';

export function ReportSuccess({
  result,
  onClose,
}: {
  result: SubmitReportResponse;
  onClose: () => void;
}) {
  const { t } = useTranslation(NAMESPACE);
  const { data: stations } = useStations();
  const { data: lines } = useLines();
  const [reporters] = useState(pickReporterCount);
  const count = useCountAnimation(reporters, 1500);

  const stationName = stations?.[result.stationId]?.name;
  const lineName = result.lineId ? lines?.find((l) => l.id === result.lineId)?.name : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 pt-14 pb-4 text-center">
        <div className="flex items-center gap-3">
          <div className="bg-accent-bright text-primary-foreground animate-in zoom-in-50 fade-in flex size-10 items-center justify-center rounded-full shadow-[0_6px_16px_rgba(214,59,59,0.28)] duration-300">
            <Check className="size-6" />
          </div>
          <h1 className="font-heading text-xl font-semibold">{t('title')}</h1>
        </div>

        {stationName && (
          <div className="mt-4 flex items-center gap-2">
            {lineName && <LineBadge name={lineName} />}
            <span className="text-sm font-semibold">{stationName}</span>
          </div>
        )}

        <div className="mt-5 flex flex-col items-center gap-1">
          <div className="text-foreground flex items-center gap-2">
            <Users className="text-muted-foreground size-6" />
            <span className="font-heading text-4xl font-bold tabular-nums">
              {count.toLocaleString()}
            </span>
          </div>
          <p className="text-muted-foreground text-sm">{t('description')}</p>
        </div>

        <div className="mt-6 w-full">
          <ReportFeedback onDone={onClose} />
        </div>
      </div>

      <div className="border-border/60 bg-card flex shrink-0 flex-col items-center border-t px-6 pt-3 pb-6">
        <p className="text-muted-foreground text-[0.6875rem]">{t('syncText')}</p>
        <Button
          type="button"
          size="lg"
          onClick={onClose}
          className="bg-accent-bright text-primary-foreground hover:bg-accent-press mt-2 h-12 w-full rounded-lg text-base font-semibold shadow-[0_6px_16px_rgba(214,59,59,0.28)]"
        >
          {t('continue')}
        </Button>
        <SocialLinks appearance="inline" className="mt-3 justify-center" />
      </div>
    </div>
  );
}
