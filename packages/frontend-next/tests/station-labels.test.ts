import { describe, expect, it } from 'vitest';

import { stationLabel } from '../src/components/map/station-labels';

const trunk = new Map([
  ['u1', 'U1'],
  ['u2', 'U2'],
  ['s5-a', 'S5'],
  ['s5-b', 'S5'],
]);

describe('stationLabel', () => {
  it('names an interchange of three trunk lines first', () => {
    expect(stationLabel(['u1', 'u2', 's5-a'], trunk).labelTier).toBe(0);
  });

  it('counts the variants of a line once', () => {
    const label = stationLabel(['u1', 's5-a', 's5-b'], trunk);

    expect(label.trunkLineCount).toBe(2);
    expect(label.labelTier).toBe(1);
  });

  it('puts a stop served only by surface lines in the last tier', () => {
    const label = stationLabel(['m4', 'bus-100'], trunk);

    expect(label.trunkLineCount).toBe(0);
    expect(label.labelTier).toBe(2);
  });

  it('places the busier of two stations in a tier first', () => {
    const busy = stationLabel(['u1', 'u2'], trunk);
    const quiet = stationLabel(['u1'], trunk);

    expect(busy.labelSortKey).toBeLessThan(quiet.labelSortKey);
  });

  it('places every station of an earlier tier before a later one', () => {
    const interchange = stationLabel(['u1', 'u2', 's5-a'], trunk);
    const busyStop = stationLabel(
      Array.from({ length: 150 }, (_, i) => `bus-${i}`),
      trunk,
    );

    expect(interchange.labelSortKey).toBeLessThan(busyStop.labelSortKey);
  });
});
