import { Check, HardDrive, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { SubmitReportResponse } from '@/api/reports';
import { useLines, useStations } from '@/api/transit';
import { SocialLinks } from '@/components/map/SocialLinks';
import { LineBadge } from '@/components/transit/LineBadge';
import { PageHeader } from '@/components/templates/PageHeader';
import { Button } from '@freifahren/ui/button';
import { useCountAnimation } from '@/hooks/useCountAnimation';
import { currentCity } from '@/lib/city';
import { pickReporterCount } from '@/lib/reporters';

import { ReportFeedback } from './ReportFeedback';
import { NAMESPACE } from './ReportSuccess.i18n';

export function ReportSuccess({
  result,
  savedLocally = false,
  onClose,
}: {
  result: SubmitReportResponse;
  /** The API never confirmed receipt: this is the "saved on this device" confirmation. */
  savedLocally?: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation(NAMESPACE);
  const { data: stations } = useStations();
  const { data: lines } = useLines();
  const [reporters] = useState(() => pickReporterCount(currentCity));
  const count = useCountAnimation(reporters ?? 0, 1500);

  const stationName = stations?.[result.stationId]?.name;
  const lineName = result.lineId ? lines?.find((l) => l.id === result.lineId)?.name : null;

  return (
    // Same frame as the checks screen (header, 16px margins, sticky footer) so the
    // timed advance only swaps content instead of rearranging the page.
    <div className="animate-in fade-in motion-safe:slide-in-from-bottom-1 mx-auto flex min-h-full w-full max-w-md flex-col duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]">
      <PageHeader
        title={t(savedLocally ? 'localTitle' : 'title')}
        reserveBackSpace
        action={
          savedLocally ? (
            <HardDrive className="text-muted-foreground mr-2 size-5" aria-hidden="true" />
          ) : (
            <Check className="text-ok mr-2 size-5" aria-hidden="true" />
          )
        }
      />
      <div className="flex flex-1 flex-col px-4 pt-4 pb-6">
        {stationName && (
          <div className="flex items-center gap-2 text-sm font-semibold">
            {lineName && <LineBadge name={lineName} />}
            <span>{stationName}</span>
          </div>
        )}

        <p className="text-muted-foreground mt-3 text-sm leading-relaxed" role="status">
          {t(savedLocally ? 'localBody' : 'sentBody')}
        </p>

        {!savedLocally && reporters !== null && (
          <div className="mt-8 flex flex-col items-center gap-1">
            <div className="text-foreground flex items-center gap-2">
              <Users className="text-muted-foreground size-6" />
              <span className="font-heading text-4xl font-bold tabular-nums">
                {count.toLocaleString()}
              </span>
            </div>
            <p className="text-muted-foreground text-sm">{t('description')}</p>
          </div>
        )}

        <div className="mt-6 w-full">{!savedLocally && <ReportFeedback onDone={onClose} />}</div>
      </div>

      <footer className="bg-card pb-safe-4 sticky bottom-0 mt-auto shrink-0 px-4 pt-6">
        <Button
          type="button"
          size="lg"
          onClick={onClose}
          className="bg-accent-bright text-primary-foreground hover:bg-accent-press h-12 w-full rounded-lg text-base font-semibold shadow-[0_6px_16px_rgba(214,59,59,0.28)]"
        >
          {t('backToMap')}
        </Button>
        <SocialLinks appearance="inline" className="mt-3 justify-center" />
      </footer>
    </div>
  );
}
