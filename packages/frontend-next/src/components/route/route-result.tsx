import { useTranslation } from 'react-i18next';

import { RISK_COLORS, riskLevel, type RiskLevel } from '@/api/risk';
import { useRoute, type RouteLeg, type RouteLegSegment } from '@/api/route';
import type { Stations } from '@/api/transit';
import { LineBadge } from '@/components/transit/LineBadge';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { DetailCard } from '@/components/map/DetailCard';

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
        {leg.segments.map((segment) => (
          <SegmentRow
            key={`${segment.fromStationId}-${segment.toStationId}`}
            segment={segment}
            stations={stations}
          />
        ))}
      </ul>
    </div>
  );
}

export function RouteResult({ fromId, toId, stations, onClose }: RouteResultProps) {
  const { t } = useTranslation(NAMESPACE);
  const { data: plan, isPending, isError, refetch } = useRoute(fromId, toId);

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

          <CardContent className="min-h-0 flex-1 space-y-3 overflow-auto">
            {plan.legs.map((leg) => (
              <Leg key={`${leg.lineId}-${leg.fromStationId}`} leg={leg} stations={stations} />
            ))}
          </CardContent>

          <CardContent className="shrink-0">
            <p className="text-muted-foreground text-xs">{t('estimateNote')}</p>
          </CardContent>
        </>
      )}
    </DetailCard>
  );
}
