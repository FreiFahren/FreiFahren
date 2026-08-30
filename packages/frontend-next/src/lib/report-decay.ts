/**
 * How a report fades while it runs down, and — for the debug simulation only — a client-side mirror
 * of the API's expiry model.
 *
 * The split matters: *when* a report stops being live is the API's call (`expiresAt`), because it
 * takes the whole city's reports to see a burst or spot a controller moving down a line, and
 * because the map, the risk model and the report counter have to agree on the answer. *How* a live
 * report looks on its way out is purely presentation, and lives here.
 */

export type DecayableReport = {
  stationId: string;
  lineId: string | null;
  directionId: string | null;
  timestamp: string;
};

export const BURST_WINDOW_MS = 15 * 60 * 1000;
export const BURST_REFERENCE_RATE_PER_MIN = 0.5;
export const TTL_MIN_MS = 15 * 60 * 1000;
// Kept in step with the API's `report-decay.ts`, which carries the reasoning for the value.
export const TTL_MAX_MS = 45 * 60 * 1000;

export const AVG_HOP_TRAVEL_MS = 3 * 60 * 1000;
export const CHAIN_SLACK_FACTOR = 2.5;
export const SUPERSEDED_FADE_MS = 3 * 60 * 1000;
export const CHAIN_HEAD_TTL_BOOST = 1.25;

/** Faintest a report gets while it is still live; it fades from here to nothing as it expires. */
export const MIN_OPACITY = 0.4;
/** How long before expiry a report starts fading out completely, rather than snapping away. */
export const FADE_OUT_MS = 3 * 60 * 1000;

/**
 * How opaque a report should render right now, or `null` if it is no longer live and should not be
 * drawn at all. Reports with no expiry (predicted ones) never fade.
 *
 * The ramp runs from full opacity at the moment of reporting down to `MIN_OPACITY`, where it holds
 * until the last `FADE_OUT_MS` before expiry and then fades to nothing.
 */
export function reportOpacity(
  timestampMs: number,
  expiresAtMs: number | null,
  nowMs: number,
): number | null {
  if (expiresAtMs === null) return 1;

  const remaining = expiresAtMs - nowMs;
  if (remaining <= 0) return null;
  if (remaining < FADE_OUT_MS) return MIN_OPACITY * (remaining / FADE_OUT_MS);

  const lifetime = expiresAtMs - timestampMs;
  if (lifetime <= 0) return MIN_OPACITY;
  return Math.max(MIN_OPACITY, 1 - (nowMs - timestampMs) / lifetime);
}

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

/**
 * When a report stops being live. Mirrors `computeExpiresAtMs` in the API's `report-decay.ts` —
 * kept in step by hand so the debug page can play the model forward without a backend round-trip.
 * Nothing on the live map path calls this: there, `expiresAt` comes from the API.
 */
export function computeExpiresAtMs(
  reportTimestampMs: number,
  ratePerMinute: number,
  chain: ChainInfo = NOT_CHAINED,
): number {
  const baseTtl = burstAdaptiveTtlMs(ratePerMinute);
  const ttlMs = chain.isChainHead ? baseTtl * CHAIN_HEAD_TTL_BOOST : baseTtl;
  const ttlExpiry = reportTimestampMs + ttlMs;

  if (chain.supersededAtMs === null) return ttlExpiry;
  return Math.min(ttlExpiry, chain.supersededAtMs + SUPERSEDED_FADE_MS);
}

/** Stamps simulated reports with an expiry, the way the API does for real ones. */
export function annotateReportExpiry<T extends DecayableReport>(
  reports: readonly T[],
  lines: readonly { id: string; stations: readonly string[] }[],
  nowMs: number,
  keyOf: (report: T) => string,
): (T & { expiresAt: string })[] {
  const chainByKey = computeChainInfo(reports, buildLineTopologies(lines), keyOf);
  const ratePerMinute = burstRatePerMinute(reports, nowMs);

  return reports.map((report) => ({
    ...report,
    expiresAt: new Date(
      computeExpiresAtMs(
        new Date(report.timestamp).getTime(),
        ratePerMinute,
        chainByKey.get(keyOf(report)),
      ),
    ).toISOString(),
  }));
}
