import { useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

import { compareLineOrder, useLines, useStations } from '@/api/transit';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useReportSimulation } from '@/contexts/ReportSimulation.context';
import {
  burstRatePerMinute,
  buildLineTopologies,
  computeChainInfo,
  computeReportDecay,
} from '@/lib/report-decay';
import {
  buildBurstReports,
  buildControllerWalk,
  FALLBACK_LINES,
  FALLBACK_STATIONS,
} from '@/lib/report-decay-simulation';
import { cn } from '@/lib/utils';

const SIM_RANGE_MINUTES = { min: -10, max: 90 };
const HOP_COUNT = 8;

function reportKey(report: { stationId: string; timestamp: string }): string {
  return `${report.stationId}-${report.timestamp}`;
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  valueLabel,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  valueLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1 text-xs">
      <label htmlFor={id} className="text-muted-foreground flex justify-between font-semibold">
        <span>{label}</span>
        <span>{valueLabel}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-destructive w-full"
      />
    </div>
  );
}

export function ReportDecayDebugPanel() {
  const navigate = useNavigate();
  const { data: liveStations } = useStations();
  const { data: liveLines } = useLines();
  const { setSimulation } = useReportSimulation();

  const usingFallback = !liveStations || !liveLines || liveLines.length === 0;
  const stations = liveStations && liveLines?.length ? liveStations : FALLBACK_STATIONS;
  const lines = liveStations && liveLines?.length ? liveLines : FALLBACK_LINES;

  const [active, setActive] = useState(false);
  const [scenarioStartMs] = useState(() => Date.now());
  const [simMinutes, setSimMinutes] = useState(0);
  const [burstIntensity, setBurstIntensity] = useState(4);
  const [selectedLineId, setSelectedLineId] = useState('');
  const [allowLineSwitch, setAllowLineSwitch] = useState(true);
  const [walkReports, setWalkReports] = useState<ReturnType<typeof buildControllerWalk>>([]);

  const sortedLines = [...lines].sort(compareLineOrder);
  const effectiveLineId =
    (sortedLines.some((line) => line.id === selectedLineId) ? selectedLineId : '') ||
    (sortedLines[0]?.id ?? '');

  const burstReports = useMemo(() => {
    const totalRangeMs = (SIM_RANGE_MINUTES.max - SIM_RANGE_MINUTES.min) * 60_000;
    const count = Math.round(burstIntensity * (totalRangeMs / (15 * 60_000)));
    const rangeStartMs = scenarioStartMs + SIM_RANGE_MINUTES.min * 60_000;
    return buildBurstReports(stations, count, rangeStartMs + totalRangeMs, totalRangeMs);
  }, [stations, burstIntensity, scenarioStartMs]);

  const combinedReports = useMemo(
    () => [...burstReports, ...walkReports],
    [burstReports, walkReports],
  );

  const generateWalk = () => {
    if (!effectiveLineId) return;
    setWalkReports(
      buildControllerWalk({
        lines,
        stations,
        startLineId: effectiveLineId,
        startMs: scenarioStartMs,
        hopCount: HOP_COUNT,
        allowLineSwitch,
      }),
    );
  };

  const simulatedNowMs = scenarioStartMs + simMinutes * 60_000;

  useEffect(() => {
    setSimulation({
      reports: active ? combinedReports : null,
      nowMs: active ? simulatedNowMs : null,
    });
  }, [active, combinedReports, simulatedNowMs, setSimulation]);

  useEffect(() => () => setSimulation({ reports: null, nowMs: null }), [setSimulation]);

  const lineTopologies = buildLineTopologies(lines);
  const chainByKey = computeChainInfo(walkReports, lineTopologies, reportKey);
  const ratePerMinute = burstRatePerMinute(combinedReports, simulatedNowMs);
  const lineColorById = new Map(lines.map((line) => [line.id, line.color]));

  return (
    <div className="fixed top-4 right-4 z-40 w-80 max-w-[calc(100vw-2rem)]">
      <Card className="max-h-[85vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Report-Zerfall Debug
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setSimulation({ reports: null, nowMs: null });
                void navigate({ to: '/' });
              }}
            >
              Schließen
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {usingFallback && (
            <p className="bg-muted text-muted-foreground rounded-md px-2 py-1.5 text-[0.65rem]">
              Kein Backend erreichbar — nutze ein eingebautes Testnetz (Linie A/B) statt der echten
              Stationen.
            </p>
          )}

          <Button
            variant={active ? 'default' : 'outline'}
            onClick={() => setActive((prev) => !prev)}
            className={cn(!active && 'text-muted-foreground')}
          >
            {active ? 'Simulation aktiv' : 'Simulation aktivieren'}
          </Button>

          <Separator />

          <Slider
            id="sim-time"
            label="Simulierte Zeit"
            min={SIM_RANGE_MINUTES.min}
            max={SIM_RANGE_MINUTES.max}
            value={simMinutes}
            onChange={setSimMinutes}
            valueLabel={`${simMinutes} min`}
          />

          <Slider
            id="burst-intensity"
            label="Burst-Intensität (Meldungen / 15min)"
            min={0}
            max={20}
            value={burstIntensity}
            onChange={setBurstIntensity}
            valueLabel={`${burstIntensity}`}
          />
          <p className="text-muted-foreground text-[0.65rem]">
            Aktuelle Rate: {ratePerMinute.toFixed(2)}/min
          </p>

          <Separator />

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold">Kontrolleur simulieren</span>
            <select
              value={effectiveLineId}
              onChange={(e) => setSelectedLineId(e.target.value)}
              className="border-input bg-input/20 rounded-md border px-2 py-1.5 text-xs"
            >
              {sortedLines.map((line) => (
                <option key={line.id} value={line.id}>
                  {line.name} ({line.id})
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={allowLineSwitch}
                onChange={(e) => setAllowLineSwitch(e.target.checked)}
              />
              Linie nach der Hälfte wechseln
            </label>
            <Button variant="outline" size="sm" onClick={generateWalk}>
              Kontrolleur-Route generieren
            </Button>
          </div>

          <Separator />

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold">
              Kontrolleur-Meldungen ({walkReports.length})
            </span>
            {walkReports.length === 0 && (
              <p className="text-muted-foreground text-[0.65rem]">Noch keine Route generiert.</p>
            )}
            {walkReports.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 py-1">
                {walkReports.map((report) => {
                  const chain = chainByKey.get(reportKey(report));
                  const { opacity, dropped } = computeReportDecay(
                    new Date(report.timestamp).getTime(),
                    simulatedNowMs,
                    ratePerMinute,
                    chain,
                  );
                  return (
                    <span
                      key={reportKey(report)}
                      title={stations[report.stationId]?.name ?? report.stationId}
                      className={cn(
                        'size-4 shrink-0 rounded-full border-2',
                        !dropped && chain?.isChainHead && 'border-accent-bright',
                        !dropped && !chain?.isChainHead && 'border-transparent',
                      )}
                      style={{
                        backgroundColor: report.lineId ? lineColorById.get(report.lineId) : '#999',
                        opacity: dropped ? 0.08 : Math.max(opacity, 0.08),
                      }}
                    />
                  );
                })}
              </div>
            )}
            {walkReports.map((report) => {
              const chain = chainByKey.get(reportKey(report));
              const { opacity, dropped } = computeReportDecay(
                new Date(report.timestamp).getTime(),
                simulatedNowMs,
                ratePerMinute,
                chain,
              );
              const ageMin = Math.round(
                (simulatedNowMs - new Date(report.timestamp).getTime()) / 60_000,
              );
              const station = stations[report.stationId];
              return (
                <div
                  key={reportKey(report)}
                  className="border-border/60 flex items-center justify-between border-b py-1 text-[0.65rem] last:border-b-0"
                >
                  <span className="truncate">
                    {station?.name ?? report.stationId} · {report.lineId} · {ageMin}min
                  </span>
                  <span
                    className={cn(
                      'shrink-0 font-semibold',
                      dropped && 'text-muted-foreground',
                      !dropped && chain?.isChainHead && 'text-accent-bright',
                      !dropped &&
                        chain?.supersededAtMs !== null &&
                        !chain?.isChainHead &&
                        'text-destructive',
                    )}
                  >
                    {dropped ? 'weg' : `${Math.round(opacity * 100)}%`}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
