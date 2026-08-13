export type DecayableReport = {
  stationId: string;
  lineId: string | null;
  directionId: string | null;
  timestamp: string;
};

export const BURST_WINDOW_MS = 15 * 60 * 1000;
export const BURST_REFERENCE_RATE_PER_MIN = 0.5;
export const TTL_MIN_MS = 15 * 60 * 1000;
export const TTL_MAX_MS = 60 * 60 * 1000;
export const MIN_OPACITY = 0.4;

export const AVG_HOP_TRAVEL_MS = 3 * 60 * 1000;
export const CHAIN_SLACK_FACTOR = 2.5;
export const SUPERSEDED_FADE_MS = 3 * 60 * 1000;
export const CHAIN_HEAD_TTL_BOOST = 1.25;

export function burstRatePerMinute(
  reports: readonly DecayableReport[],
  nowMs: number,
  windowMs: number = BURST_WINDOW_MS,
): number {
  const cutoff = nowMs - windowMs;
  let count = 0;
  for (const report of reports) {
    if (new Date(report.timestamp).getTime() >= cutoff) count++;
  }
  return count / (windowMs / 60_000);
}

export function burstAdaptiveTtlMs(
  ratePerMinute: number,
  referenceRate: number = BURST_REFERENCE_RATE_PER_MIN,
): number {
  return TTL_MIN_MS + (TTL_MAX_MS - TTL_MIN_MS) / (1 + ratePerMinute / referenceRate);
}

export type ChainInfo = {
  supersededAtMs: number | null;
  isChainHead: boolean;
};

const NOT_CHAINED: ChainInfo = { supersededAtMs: null, isChainHead: true };

export type LineTopologies = ReadonlyMap<string, readonly string[]>;

export function buildLineTopologies(
  lines: readonly { id: string; stations: readonly string[] }[],
): LineTopologies {
  return new Map(lines.map((line) => [line.id, line.stations]));
}

export function computeChainInfo<T extends DecayableReport>(
  reports: readonly T[],
  lineTopologies: LineTopologies,
  keyOf: (report: T) => string,
): ReadonlyMap<string, ChainInfo> {
  const info = new Map<string, ChainInfo>(reports.map((r) => [keyOf(r), { ...NOT_CHAINED }]));

  const byLine = new Map<string, T[]>();
  for (const report of reports) {
    if (!report.lineId) continue;
    const list = byLine.get(report.lineId);
    if (list) list.push(report);
    else byLine.set(report.lineId, [report]);
  }

  for (const [lineId, lineReports] of byLine) {
    const stations = lineTopologies.get(lineId);
    if (!stations || stations.length < 2) continue;
    const rankOf = new Map(stations.map((stationId, rank) => [stationId, rank]));

    const sorted = [...lineReports].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    for (let i = 0; i < sorted.length; i++) {
      const earlier = sorted[i]!;
      const earlierRank = rankOf.get(earlier.stationId);
      if (earlierRank === undefined) continue;
      const earlierMs = new Date(earlier.timestamp).getTime();
      const earlierKey = keyOf(earlier);

      for (let j = i + 1; j < sorted.length; j++) {
        const later = sorted[j]!;
        const laterRank = rankOf.get(later.stationId);
        if (laterRank === undefined) continue;

        const hopCount = Math.abs(laterRank - earlierRank);
        if (hopCount === 0) continue;

        const laterMs = new Date(later.timestamp).getTime();
        const maxGapMs = hopCount * AVG_HOP_TRAVEL_MS * CHAIN_SLACK_FACTOR;
        if (laterMs - earlierMs > maxGapMs) continue;

        const laterKey = keyOf(later);
        info.set(earlierKey, { supersededAtMs: laterMs, isChainHead: false });
        info.set(laterKey, { ...(info.get(laterKey) ?? NOT_CHAINED), isChainHead: true });
        break;
      }
    }
  }

  return info;
}

export type DecayResult = {
  opacity: number;
  ttlMs: number;
  dropped: boolean;
};

export function computeReportDecay(
  reportTimestampMs: number,
  nowMs: number,
  ratePerMinute: number,
  chain: ChainInfo = NOT_CHAINED,
): DecayResult {
  const baseTtl = burstAdaptiveTtlMs(ratePerMinute);
  const ttlMs = chain.isChainHead ? baseTtl * CHAIN_HEAD_TTL_BOOST : baseTtl;

  if (chain.supersededAtMs !== null && nowMs >= chain.supersededAtMs) {
    const sinceSuperseded = nowMs - chain.supersededAtMs;
    if (sinceSuperseded >= SUPERSEDED_FADE_MS) return { opacity: 0, ttlMs, dropped: true };
    const opacity = MIN_OPACITY * (1 - sinceSuperseded / SUPERSEDED_FADE_MS);
    return { opacity, ttlMs, dropped: false };
  }

  const age = nowMs - reportTimestampMs;
  if (age >= ttlMs) return { opacity: 0, ttlMs, dropped: true };
  const opacity = Math.max(MIN_OPACITY, 1 - age / ttlMs);
  return { opacity, ttlMs, dropped: false };
}
