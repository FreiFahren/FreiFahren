import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DAY_MS, useReports } from '@/api/reports';
import { cn } from '@/lib/utils';
import { Route as ReportsSummaryRoute } from '@/routes/reports/index';

import { NAMESPACE } from './StatsPopUp.i18n';

const SHOW_MS = 3_500;
const FADE_MS = 500;
const REPORTERS_AT = SHOW_MS;
const EXIT_AT = SHOW_MS * 2;
const DONE_AT = EXIT_AT + FADE_MS;

// Fabricated social-proof count, fixed per mount — the app has no real user metric.
const MIN_REPORTERS = 50_000;
const MAX_REPORTERS = 60_000;
const pickReporterCount = () =>
  Math.floor(Math.random() * (MAX_REPORTERS - MIN_REPORTERS + 1)) + MIN_REPORTERS;

type Phase = 'reports' | 'reporters' | 'exit';

function usePopupSequence(active: boolean) {
  const [phase, setPhase] = useState<Phase>('reports');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) return;
    const timers = [
      setTimeout(() => setPhase('reporters'), REPORTERS_AT),
      setTimeout(() => setPhase('exit'), EXIT_AT),
      setTimeout(() => setDone(true), DONE_AT),
    ];
    return () => timers.forEach(clearTimeout);
  }, [active]);

  return { phase, done };
}

export function StatsPopUp() {
  const { t } = useTranslation(NAMESPACE);
  const { data: reports, isLoading } = useReports(DAY_MS);
  const [reporters] = useState(pickReporterCount);

  // `useReports(DAY_MS)` resolves a partial last-hour slice before the full day, so gate on
  // `isLoading` (true until every slice settles) to avoid flashing an incomplete count.
  const ready = !isLoading && reports !== undefined;
  const { phase, done } = usePopupSequence(ready);

  if (!ready || done || reports.length === 0) return null;

  // The `key` changes only on the message swap, so React replays the pop then — but not
  // during the exit fade, where 'reporters' and 'exit' share a key.
  const message = phase === 'reports' ? 'reports' : 'reporters';

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[4.5rem] z-20 flex justify-center px-3">
      <Link
        to={ReportsSummaryRoute.to}
        className={cn(
          // w-48 is fixed so swapping messages never shifts the centered pill.
          'bg-card text-card-foreground ring-foreground/10 pointer-events-auto block w-48 rounded-full px-4 py-1.5 text-center shadow-[0_6px_16px_rgba(0,0,0,0.28)] ring-1 transition-all duration-500',
          phase === 'exit' ? 'scale-90 opacity-0' : 'animate-in fade-in slide-in-from-top-2',
        )}
      >
        <p
          key={message}
          className="text-muted-foreground animate-in fade-in zoom-in-50 text-xs leading-snug duration-500"
        >
          {message === 'reports' ? (
            <>
              <span className="text-foreground block text-sm font-semibold">
                {reports.length} {t('reports')}
              </span>
              {t('todayInBerlin')}
            </>
          ) : (
            <>
              {t('over')}{' '}
              <span className="text-foreground text-sm font-semibold">
                {reporters.toLocaleString()} {t('reporters')}
              </span>
              <br />
              {t('inBerlin')}
            </>
          )}
        </p>
      </Link>
    </div>
  );
}
