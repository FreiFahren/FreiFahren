import { useEffect, useEffectEvent } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStations } from '@/api/transit';
import { LineBadge } from '@/components/transit/LineBadge';
import { PageHeader } from '@/components/templates/PageHeader';
import { ReportActionFooter } from './report-action-footer';
import { NAMESPACE } from './ReportForm.i18n';
import { ReportCheckList } from './report-check-list';
import type { SubmissionPhase } from './report-submission-flow';

const RESULT_READING_MS = 3_000;

type VerifyingPhase = Extract<
  SubmissionPhase,
  { kind: 'verifying' | 'sending' | 'rejected' | 'delivered' }
>;

const COPY: Record<VerifyingPhase['kind'], { title: string; body: string }> = {
  verifying: { title: 'verifyingTitle', body: 'verifyingBody' },
  sending: { title: 'sendingTitle', body: 'sendingBody' },
  rejected: { title: 'rejectedTitle', body: 'rejectedBody' },
  delivered: { title: 'verifiedTitle', body: 'verifiedBody' },
};

export function ReportVerifying({
  phase,
  onBack,
  onResultsRead,
}: {
  phase: VerifyingPhase;
  onBack: () => void;
  onResultsRead: () => void;
}) {
  const { t } = useTranslation(NAMESPACE);
  const { data: stations } = useStations();
  const rejected = phase.kind === 'rejected';
  const delivered = phase.kind === 'delivered';
  const advance = useEffectEvent(onResultsRead);
  useEffect(() => {
    if (!delivered) return;

    // Give the results a full glance when the reporter returns to the tab.
    let timer: ReturnType<typeof setTimeout>;
    function schedule() {
      clearTimeout(timer);
      if (document.visibilityState === 'visible') timer = setTimeout(advance, RESULT_READING_MS);
    }
    schedule();
    document.addEventListener('visibilitychange', schedule);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [delivered]);

  const busy = phase.kind === 'verifying' || phase.kind === 'sending';
  const stationName = stations?.[phase.selection.stationId]?.name;
  const { title, body } = COPY[phase.kind];

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
      <div role="status" aria-live="polite">
        <PageHeader
          title={t(title)}
          reserveBackSpace
          onBack={rejected ? onBack : undefined}
          action={
            busy ? (
              <LoaderCircle
                aria-hidden="true"
                className="text-muted-foreground mr-2 size-5 animate-spin motion-reduce:animate-none"
              />
            ) : undefined
          }
        />
      </div>
      <div className="flex flex-1 flex-col px-4 pt-4 pb-6">
        {stationName && (
          <div className="flex items-center gap-2 text-sm font-semibold">
            {phase.selection.lineName && <LineBadge name={phase.selection.lineName} />}
            <span>{stationName}</span>
          </div>
        )}
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{t(body)}</p>
        <div className="mt-6">
          <ReportCheckList checks={phase.checks} />
        </div>
      </div>
      <ReportActionFooter label={t('reviewReport')} onClick={rejected ? onBack : undefined} />
    </div>
  );
}
