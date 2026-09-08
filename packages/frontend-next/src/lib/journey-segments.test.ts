import { describe, expect, it } from 'vitest';

import type { RouteLegSegment } from '@/api/route';

import { groupQuietSegments } from './journey-segments';

const segment = (risk: number | null, id = Math.random()): RouteLegSegment => ({
  segmentId: id,
  fromStationId: 'a',
  toStationId: 'b',
  offsetSeconds: 0,
  risk,
});

describe('groupQuietSegments', () => {
  it('collapses a run of quiet stops into one entry', () => {
    const groups = groupQuietSegments([segment(0), segment(0), segment(0)]);

    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('quiet');
    expect(groups[0].segments).toHaveLength(3);
  });

  it('keeps a stop with risk on its own', () => {
    const groups = groupQuietSegments([segment(0.6)]);

    expect(groups).toEqual([
      { kind: 'notable', segments: [expect.objectContaining({ risk: 0.6 })] },
    ]);
  });

  it('splits a run around the stops that matter', () => {
    const groups = groupQuietSegments([
      segment(0),
      segment(0),
      segment(0.6),
      segment(0),
      segment(0),
      segment(0.3),
    ]);

    expect(groups.map((g) => [g.kind, g.segments.length])).toEqual([
      ['quiet', 2],
      ['notable', 1],
      ['quiet', 2],
      ['notable', 1],
    ]);
  });

  it('never hides a stop that could not be assessed', () => {
    /*
     * An unrated hop is not a quiet one. Folding it into "nothing reported" would present a
     * stretch we know nothing about as safe — the one thing this feature must not do.
     */
    const groups = groupQuietSegments([
      segment(0),
      segment(0),
      segment(null),
      segment(0),
      segment(0),
    ]);

    expect(groups.map((g) => [g.kind, g.segments.length])).toEqual([
      ['quiet', 2],
      ['notable', 1],
      ['quiet', 2],
    ]);
    expect(groups[1].segments[0].risk).toBeNull();
  });

  it('treats anything above the clear threshold as notable', () => {
    // 0.2 is the boundary the map legend uses for "clear". Pairs, because a lone quiet
    // stop stays expanded by the rule below.
    expect(groupQuietSegments([segment(0.2), segment(0.2)])[0].kind).toBe('quiet');
    expect(groupQuietSegments([segment(0.21), segment(0.21)]).map((g) => g.kind)).toEqual([
      'notable',
      'notable',
    ]);
  });

  it('leaves a single quiet stop expanded', () => {
    // Collapsing one row into a "1 stop" summary saves no space and costs a tap.
    const groups = groupQuietSegments([segment(0.6), segment(0), segment(0.6)]);

    expect(groups.map((g) => g.kind)).toEqual(['notable', 'notable', 'notable']);
  });

  it('returns nothing for an empty leg', () => {
    expect(groupQuietSegments([])).toEqual([]);
  });

  it('keeps every segment exactly once', () => {
    const input = [segment(0, 1), segment(0, 2), segment(0.6, 3), segment(0, 4), segment(0, 5)];

    const flattened = groupQuietSegments(input).flatMap((g) => g.segments);

    expect(flattened.map((s) => s.segmentId)).toEqual([1, 2, 3, 4, 5]);
  });
});
