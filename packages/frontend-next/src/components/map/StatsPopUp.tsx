import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DAY_MS, useReports } from '@/api/reports';
import { ToastPill } from '@/components/ui/toast-pill';
import { currentCity } from '@/lib/city';
import { pickReporterCount } from '@/lib/reporters';
import { toast } from '@/lib/toast';
import { Route as ReportsSummaryRoute } from '@/routes/reports/index';

import { NAMESPACE } from './StatsPopUp.i18n';

const DURATION_MS = 7_000;
const REPORTERS_AT = 3_500;

export function StatsPopUp() {
  const { data: reports, isLoading } = useReports(DAY_MS);
  const firedRef = useRef(false);

  // `useReports(DAY_MS)` resolves a partial last-hour slice before the full day, so gating on
  // `isLoading` avoids showing an incomplete count.
  const ready = !isLoading && reports !== undefined && reports.length > 0;

  useEffect(() => {
    if (!ready || firedRef.current) return;
    firedRef.current = true;
    const reportCount = reports.length;
    toast.custom((id) => <StatsCard toastId={id} reportCount={reportCount} />, {
      duration: DURATION_MS,
    });
  }, [ready, reports]);

  return null;
}

function StatsCard({ toastId, reportCount }: { toastId: string | number; reportCount: number }) {
  const { t } = useTranslation(NAMESPACE);
  const [reporters] = useState(() => pickReporterCount(currentCity));
  const [phase, setPhase] = useState<'reports' | 'reporters'>('reports');
  const city = currentCity.displayName;

  useEffect(() => {
    if (reporters === null) return;
    const timer = setTimeout(() => setPhase('reporters'), REPORTERS_AT);
    return () => clearTimeout(timer);
  }, [reporters]);

  return (
    <ToastPill asChild>
      <Link
        to={ReportsSummaryRoute.to}
        onClick={() => toast.dismiss(toastId)}
        // Fixed w-48 keeps the message swap from shifting the pill.
        className="block w-48 text-center"
      >
        <p
          key={phase}
          className="text-muted-foreground animate-in fade-in text-xs leading-snug duration-500"
        >
          {phase === 'reports' || reporters === null ? (
            <>
              <span className="text-foreground block text-sm font-semibold">
                {reportCount} {t('reports')}
              </span>
              {t('todayInCity', { city })}
            </>
          ) : (
            <>
              {t('over')}{' '}
              <span className="text-foreground text-sm font-semibold">
                {reporters.toLocaleString()} {t('reporters')}
              </span>
              <br />
              {t('inCity', { city })}
            </>
          )}
        </p>
      </Link>
    </ToastPill>
  );
}
