import { describe, expect, it } from 'vitest';

import type { Report } from '../src/api/reports';
import type { Stations } from '../src/api/transit';
import { reportsToGeoJSON } from '../src/lib/reports-to-geojson';

const MINUTE = 60_000;
const START = Date.parse('2026-01-01T12:00:00Z');
const stations: Stations = {
  station: {
    id: 'station',
    name: 'Station',
    coordinates: { longitude: 13.4, latitude: 52.5 },
    lines: [],
  },
};

function observation(lifetime: number): Report {
  return {
    stationId: 'station',
    timestamp: new Date(START).toISOString(),
    expiresAt: new Date(START + lifetime).toISOString(),
    isPredicted: false,
    lineId: null,
    directionId: null,
  };
}

function markers(report: Report, elapsed: number, viewed = false) {
  return reportsToGeoJSON([report], stations, () => viewed, START + elapsed, []).features;
}

describe('Report marker presentation', () => {
  it('starts fully visible and fades as the observation ages', () => {
    const report = observation(20 * MINUTE);
    expect(markers(report, 0)[0].properties.opacity).toBe(1);
    expect(markers(report, 10 * MINUTE)[0].properties.opacity).toBe(0.5);
  });

  it.each([45, 6, 2])(
    'keeps a %s-minute observation at the 40% floor through its last millisecond',
    (minutes) => {
      const lifetime = minutes * MINUTE;
      const report = observation(lifetime);
      for (const elapsed of [lifetime * 0.8, lifetime - 1]) {
        const features = markers(report, elapsed);
        expect(features).toHaveLength(1);
        expect(features[0].properties.opacity).toBe(0.4);
      }
    },
  );

  it('does not introduce another fade during the final three minutes', () => {
    const lifetime = 45 * MINUTE;
    const report = observation(lifetime);
    for (const remaining of [3 * MINUTE, 3 * MINUTE - 1, MINUTE]) {
      expect(markers(report, lifetime - remaining)[0].properties.opacity).toBe(0.4);
    }
  });

  it('removes an observation at expiry and keeps it absent afterward', () => {
    const lifetime = 6 * MINUTE;
    const report = observation(lifetime);
    expect(markers(report, lifetime)).toEqual([]);
    expect(markers(report, lifetime + 1)).toEqual([]);
  });

  it('stops pulsing inside the final three minutes while keeping the marker visible', () => {
    const report = observation(8 * MINUTE);
    expect(markers(report, 5 * MINUTE)[0].properties.pulse).toBe(true);
    const features = markers(report, 5 * MINUTE + 1);
    expect(features).toHaveLength(1);
    expect(features[0].properties.pulse).toBe(false);
    expect(features[0].properties.opacity).toBe(0.4);
  });

  it('does not pulse a fresh observation whose shortened lifetime is under three minutes', () => {
    const feature = markers(observation(2 * MINUTE), 0)[0];
    expect(feature.properties.opacity).toBe(1);
    expect(feature.properties.pulse).toBe(false);
  });

  it('can pulse at the opacity floor when the observation is still fresh and far from expiry', () => {
    const feature = markers(observation(20 * MINUTE), 12 * MINUTE)[0];
    expect(feature.properties.opacity).toBe(0.4);
    expect(feature.properties.pulse).toBe(true);
  });

  it('stops pulsing at fifteen minutes even when expiry is further away', () => {
    const report = observation(25 * MINUTE);
    expect(markers(report, 15 * MINUTE - 1)[0].properties.pulse).toBe(true);
    expect(markers(report, 15 * MINUTE)[0].properties.pulse).toBe(false);
  });

  it('suppresses the pulse of a viewed observation without changing visibility', () => {
    const report = observation(20 * MINUTE);
    const unseen = markers(report, 5 * MINUTE)[0];
    const seen = markers(report, 5 * MINUTE, true)[0];
    expect(unseen.properties.pulse).toBe(true);
    expect(seen.properties.pulse).toBe(false);
    expect(seen.properties.opacity).toBe(unseen.properties.opacity);
  });

  it('keeps predictions at 40% without expiring them', () => {
    const report: Report = { ...observation(MINUTE), isPredicted: true, expiresAt: null };
    for (const elapsed of [0, 24 * 60 * MINUTE]) {
      const features = markers(report, elapsed);
      expect(features).toHaveLength(1);
      expect(features[0].properties.opacity).toBe(0.4);
    }
  });
});
