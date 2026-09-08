import { riskLevel } from '@/api/risk';
import type { RouteLegSegment } from '@/api/route';

export type JourneySegmentGroup = {
  /** `quiet` runs are collapsed behind a summary row; `notable` ones are always shown. */
  kind: 'quiet' | 'notable';
  segments: RouteLegSegment[];
};

/*
 * A long journey is mostly uneventful, and a screen full of "nothing reported" buries the two
 * stops that actually matter. Consecutive quiet stops therefore collapse into one summary row.
 *
 * Two rules keep that from lying:
 * - a stop that could not be assessed is never quiet, however calm its neighbours are;
 * - a lone quiet stop stays expanded, because folding one row into a summary saves nothing
 *   and costs a tap.
 */
const isQuiet = (segment: RouteLegSegment): boolean =>
  segment.risk !== null && riskLevel(segment.risk) === 'clear';

export function groupQuietSegments(segments: RouteLegSegment[]): JourneySegmentGroup[] {
  const groups: JourneySegmentGroup[] = [];

  for (const segment of segments) {
    const kind = isQuiet(segment) ? 'quiet' : 'notable';
    const current = groups.at(-1);
    if (current !== undefined && current.kind === kind && kind === 'quiet') {
      current.segments.push(segment);
      continue;
    }
    groups.push({ kind, segments: [segment] });
  }

  // A run of one is not worth a summary row.
  return groups.map((group) =>
    group.kind === 'quiet' && group.segments.length === 1
      ? { kind: 'notable' as const, segments: group.segments }
      : group,
  );
}
