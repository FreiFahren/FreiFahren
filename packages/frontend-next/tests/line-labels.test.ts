import { describe, expect, it } from 'vitest';

import type { Line, Segments } from '../src/api/transit';
import { buildLineLabels, contrastTextColor } from '../src/components/map/line-labels';

function line(id: string, color: string, stations: string[], type: Line['type'] = 'subway'): Line {
  return { id, name: id.replace(/-.*/, ''), type, isCircular: false, color, stations };
}

// Stations sit on a west-east row, one per letter, so a run's extent is readable from its ends.
const x = (station: string) => station.charCodeAt(0) - 'a'.charCodeAt(0);

function segmentsFor(lines: Line[]): Segments {
  return {
    type: 'FeatureCollection',
    features: lines.flatMap((l) =>
      l.stations.slice(1).map((to, i) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [x(l.stations[i]), 0],
            [x(to), 0],
          ],
        },
        properties: { id: 0, line: l.id, from: l.stations[i], to, color: l.color },
      })),
    ),
  };
}

function labels(lines: Line[], secondaryTypes = new Set<string>()) {
  return buildLineLabels(segmentsFor(lines), lines, secondaryTypes).features.map((f) => ({
    ...f.properties,
    from: f.geometry.coordinates[0][0],
    to: f.geometry.coordinates[f.geometry.coordinates.length - 1][0],
  }));
}

describe('buildLineLabels', () => {
  it('labels a line once along its whole length', () => {
    const result = labels([line('U1', '#7DAD4C', ['a', 'b', 'c', 'd'])]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ label: 'U1', from: 0, to: 3, dx: 0 });
  });

  it('shares one badge between same-coloured lines on the same track', () => {
    const result = labels([
      line('S5', '#007734', ['a', 'b', 'c', 'd']),
      line('S7', '#007734', ['d', 'c', 'b']),
    ]);

    expect(result.map((l) => [l.label, l.from, l.to])).toEqual([
      ['S5', 0, 1],
      ['S5 S7', 1, 3],
    ]);
  });

  it('puts differently coloured lines on the same track side by side', () => {
    const result = labels([
      line('U1', '#7DAD4C', ['a', 'b', 'c']),
      line('U3', '#16683D', ['a', 'b', 'c']),
    ]);

    expect(result.map((l) => l.label)).toEqual(['U1', 'U3']);
    expect(result[0].dx).toBeLessThan(0);
    expect(result[1].dx).toBe(-result[0].dx);
  });

  it('names a line once when two of its variants share a track', () => {
    const result = labels([
      line('S85-a', '#007734', ['a', 'b', 'c']),
      line('S85-b', '#007734', ['a', 'b', 'c']),
    ]);

    expect(result.map((l) => l.label)).toEqual(['S85']);
  });

  it('summarises a corridor too busy to list', () => {
    const names = ['M1', 'M2', 'M4', 'M5', 'M6', 'M8'];
    const result = labels(names.map((name) => line(name, '#be1414', ['a', 'b'], 'tram')));

    expect(result.map((l) => l.label)).toEqual(['M1 M2 M4 M5 +2']);
  });

  it('counts the lines of colours that got no badge on the last one', () => {
    const colors = ['#111111', '#222222', '#333333', '#444444', '#555555'];
    const result = labels(colors.map((color, i) => line(`U${i + 1}`, color, ['a', 'b'])));

    expect(result.map((l) => l.label)).toEqual(['U1', 'U2', 'U3 +2']);
  });

  it('marks a badge secondary only when every line on it is', () => {
    const result = labels(
      [line('M4', '#be1414', ['a', 'b'], 'tram'), line('U2', '#DA421E', ['c', 'd'])],
      new Set(['tram']),
    );

    expect(result.map((l) => [l.label, l.secondary])).toEqual([
      ['M4', true],
      ['U2', false],
    ]);
    expect(result[1].sortKey).toBeLessThan(result[0].sortKey);
  });
});

describe('contrastTextColor', () => {
  it('uses dark text on a light line colour and light text on a dark one', () => {
    expect(contrastTextColor('#F0D722')).toBe('#111111');
    expect(contrastTextColor('#224F86')).toBe('#ffffff');
  });
});
