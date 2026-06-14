import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { HOUR_MS, useReports } from '@/api/reports';
import { useLines, useStations } from '@/api/transit';
import { GithubIcon, InstagramIcon } from '@/components/brand-icons';
import { LineBadge } from '@/components/transit/LineBadge';
import { Button } from '@/components/ui/button';
import { markReportViewed, useReportViewed } from '@/lib/viewed-reports';
import { Route as ReportsSummaryRoute } from '@/routes/reports/index';

import { NAMESPACE } from './ReportsOverviewButton.i18n';

const GITHUB_URL = 'https://github.com/FreiFahren/FreiFahren';
const INSTAGRAM_URL = 'https://www.instagram.com/frei.fahren';

const socialButtonClass =
  'bg-card text-card-foreground hover:bg-card/80 pointer-events-auto size-8 rounded-lg shadow-[0_6px_16px_rgba(0,0,0,0.28)]';

export function ReportsOverviewButton() {
  const { t } = useTranslation(NAMESPACE);
  const { data: reports } = useReports(HOUR_MS);
  const { data: lines } = useLines();
  const { data: stations } = useStations();

  // useReports(HOUR_MS) already scopes the data to the last hour, so the count is just the
  // number of reports and the latest is the newest by timestamp.
  const allReports = reports ?? [];
  const recentCount = allReports.length;
  const latest = allReports.slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  // Called before the early return to keep hook order stable; empty keys match nothing.
  const latestViewed = useReportViewed(latest?.stationId ?? '', latest?.timestamp ?? '');

  if (!latest) return null;

  const lineName = latest.lineId
    ? lines?.find((line) => line.id === latest.lineId)?.name
    : undefined;
  const stationName = stations?.[latest.stationId]?.name;

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 z-20 flex flex-col items-start gap-1.5 p-3">
      <div className="flex gap-1.5">
        <Button
          asChild
          variant="secondary"
          size="icon-sm"
          aria-label="GitHub"
          className={socialButtonClass}
        >
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            <GithubIcon />
          </a>
        </Button>
        <Button
          asChild
          variant="secondary"
          size="icon-sm"
          aria-label="Instagram"
          className={socialButtonClass}
        >
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
            <InstagramIcon />
          </a>
        </Button>
      </div>
      <Button
        asChild
        variant="secondary"
        className="bg-card text-card-foreground hover:bg-card/80 pointer-events-auto h-auto w-full max-w-[min(20rem,calc(100vw-10.5rem))] flex-col items-stretch gap-1.5 rounded-lg px-3.5 py-3 shadow-[0_6px_16px_rgba(0,0,0,0.28)]"
      >
        <Link
          to={ReportsSummaryRoute.to}
          // Opening the overview counts as viewing the latest report shown here, so it stops
          // pulsing both on this button and on its map marker.
          onClick={() => markReportViewed(latest.stationId, latest.timestamp)}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground text-xs">{t('lastHour')}</span>
            <span className="text-sm font-semibold">{recentCount}</span>
          </div>
          <div className="flex items-center gap-2">
            {lineName && <LineBadge name={lineName} />}
            <span className="flex-1 truncate text-sm font-semibold">{stationName}</span>
            {!latestViewed && (
              <span className="relative ml-auto block size-2 shrink-0">
                <span className="bg-destructive absolute inset-0 animate-ping rounded-full opacity-75" />
                <span className="bg-destructive relative block size-2 rounded-full" />
              </span>
            )}
          </div>
        </Link>
      </Button>
    </div>
  );
}
