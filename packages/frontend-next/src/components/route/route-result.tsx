import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RISK_COLORS, riskLevel, type RiskLevel } from '@/api/risk';
import { useRoute, type RouteLeg, type RouteLegSegment } from '@/api/route';
import type { Stations } from '@/api/transit';
import { LineBadge } from '@/components/transit/LineBadge';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { DetailCard } from '@/components/map/DetailCard';
import { groupQuietSegments } from '@/lib/journey-segments';

import { NAMESPACE } from './route.i18n';

type RouteResultProps = {
  fromId: string;
  toId: string;
  stations: Stations;
  onClose: () => void;
};

const stationName = (stations: Stations, id: string): string => stations[id]?.name ?? id;

function RiskDot({ risk }: { risk: number | null }) {
  if (risk === null) {
    return (
      <span
        aria-hidden
        className="border-muted-foreground/60 size-2.5 shrink-0 rounded-full border border-dashed"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: RISK_COLORS[riskLevel(risk)] }}
    />
  );
}

/*
 * One row per stop reached, not per station pair: the leg header already names where
 * the rider gets on, so repeating it on every row (and in full on a single-segment leg)
 * says the same thing twice.
 */
function SegmentRow({ segment, stations }: { segment: RouteLegSegment; stations: Stations }) {
  const { t } = useTranslation(NAMESPACE);
  const label = segment.risk === null ? t('noData') : t(riskLevel(segment.risk));

  return (
    <li className="flex items-center gap-2 py-1 text-sm">
      <RiskDot risk={segment.risk} />
      <span className="min-w-0 flex-1 truncate">{stationName(stations, segment.toStationId)}</span>
      <span className="text-muted-foreground shrink-0 text-xs">{label}</span>
    </li>
  );
}

function QuietRun({ segments, stations }: { segments: RouteLegSegment[]; stations: Stations }) {
  const { t } = useTranslation(NAMESPACE);
  const [expanded, setExpanded] = useState(false);

  return (
    <li>
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-label={expanded ? t('hideStops') : t('showStops')}
        className="hover:bg-muted/50 flex w-full items-center gap-2 rounded-md py-1 text-left"
      >
        <RiskDot risk={0} />
        <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
          {t('quietStops', { count: segments.length })}
        </span>
        <ChevronDown
          aria-hidden
          className={`text-muted-foreground size-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <ul className="ml-4">
          {segments.map((segment) => (
            <SegmentRow
              key={`${segment.fromStationId}-${segment.toStationId}`}
              segment={segment}
              stations={stations}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function Leg({ leg, stations }: { leg: RouteLeg; stations: Stations }) {
  return (
    <div className="border-border/60 border-t pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2">
        <LineBadge name={leg.lineName} className="shrink-0" />
        <span className="min-w-0 truncate text-sm font-medium">
          {stationName(stations, leg.fromStationId)} → {stationName(stations, leg.toStationId)}
        </span>
      </div>
      <ul className="mt-1 ml-1">
        {groupQuietSegments(leg.segments).map((group) =>
          group.kind === 'quiet' ? (
            <QuietRun
              key={`quiet-${group.segments[0].fromStationId}`}
              segments={group.segments}
              stations={stations}
            />
          ) : (
            <SegmentRow
              key={`${group.segments[0].fromStationId}-${group.segments[0].toStationId}`}
              segment={group.segments[0]}
              stations={stations}
            />
          ),
        )}
      </ul>
    </div>
  );
}

export function RouteResult({ fromId, toId, stations, onClose }: RouteResultProps) {
  const { t } = useTranslation(NAMESPACE);
  const { data: plan, isPending, isError, refetch } = useRoute(fromId, toId);
  const listRef = useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = useState(false);

  // Escape closes the card, matching the backdrop and the close button.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  /*
   * Touch and macOS hide their scrollbars, so a list that continues below the fold reads as
   * truncated. This drives a fade at the bottom edge — the only cue that there is more.
   */
  const syncOverflow = () => {
    const el = listRef.current;
    if (!el) return;
    setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  };
  /*
   * Watch the rendered legs rather than the data: expanding a collapsed run changes the
   * height without changing `plan`, so a data-keyed effect would miss exactly the case
   * that creates the overflow.
   */
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const observer = new ResizeObserver(syncOverflow);
    for (const child of el.children) observer.observe(child);
    syncOverflow();
    return () => observer.disconnect();
  }, [plan]);

  const title = `${stationName(stations, fromId)} → ${stationName(stations, toId)}`;
  const level: RiskLevel | null = plan ? riskLevel(plan.risk.overall) : null;

  return (
    <DetailCard
      title={title}
      closeLabel={t('close')}
      onClose={onClose}
      cardClassName="max-h-[calc(100dvh-6rem)]"
    >
      {isPending && (
        <CardContent className="text-muted-foreground text-sm">{t('loading')}</CardContent>
      )}

      {isError && (
        <CardContent className="space-y-3">
          <p className="text-sm">{t('failed')}</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            {t('retry')}
          </Button>
        </CardContent>
      )}

      {plan && level !== null && (
        <>
          <CardContent className="shrink-0">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-3.5 shrink-0 rounded-full"
                style={{ backgroundColor: RISK_COLORS[level] }}
              />
              <span className="font-heading text-base font-semibold">{t(level)}</span>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">{t(`levelHint_${level}`)}</p>
            <p className="text-muted-foreground mt-2 text-xs">
              {t('stations', { count: plan.stationCount })} ·{' '}
              {t('transfers', { count: plan.transfers })} ·{' '}
              {t('approxMinutes', { count: Math.max(1, Math.round(plan.totalSeconds / 60)) })}
            </p>
            {plan.risk.unratedSegments > 0 && (
              <p className="mt-2 text-xs font-medium">{t('incomplete')}</p>
            )}
          </CardContent>

          <div className="relative min-h-0 flex-1">
            <CardContent
              ref={listRef}
              onScroll={syncOverflow}
              className="h-full space-y-3 overflow-auto"
            >
              {plan.legs.map((leg) => (
                <Leg key={`${leg.lineId}-${leg.fromStationId}`} leg={leg} stations={stations} />
              ))}
            </CardContent>
            {moreBelow && (
              <div
                aria-hidden
                className="from-card pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t to-transparent"
              />
            )}
          </div>

          <CardContent className="shrink-0">
            <p className="text-muted-foreground text-xs">{t('estimateNote')}</p>
          </CardContent>
        </>
      )}
    </DetailCard>
  );
}
