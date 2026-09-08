import { describe, expect, it } from 'vitest';

import type { Station } from '@/api/transit';

import { MAX_STATION_RESULTS, matchStations } from './match-stations';

const station = (name: string): Station => ({
  id: name.toLowerCase().replace(/\s/g, '-'),
  name,
  coordinates: { latitude: 52.5, longitude: 13.4 },
  lines: [],
});

const stations = [
  station('Alexanderplatz'),
  station('Hermannplatz'),
  station('Moritzplatz'),
  station('Kottbusser Tor'),
  station('Schönleinstraße'),
];

describe('matchStations', () => {
  it('matches anywhere in the name, not just the start', () => {
    expect(matchStations(stations, 'platz').map((s) => s.name)).toEqual([
      'Alexanderplatz',
      'Hermannplatz',
      'Moritzplatz',
    ]);
  });

  it('ignores case', () => {
    expect(matchStations(stations, 'HERMANN').map((s) => s.name)).toEqual(['Hermannplatz']);
  });

  it('ignores surrounding whitespace', () => {
    expect(matchStations(stations, '  kottbusser  ').map((s) => s.name)).toEqual([
      'Kottbusser Tor',
    ]);
  });

  it('returns nothing for an empty or whitespace-only query', () => {
    // Not "everything": the list renders over the map, so an empty field must show no list.
    expect(matchStations(stations, '')).toEqual([]);
    expect(matchStations(stations, '   ')).toEqual([]);
  });

  it('caps the number of results', () => {
    const many = Array.from({ length: 30 }, (_, index) => station(`Teststation ${index}`));

    expect(matchStations(many, 'Teststation')).toHaveLength(MAX_STATION_RESULTS);
  });

  it('keeps the input order', () => {
    const reversed = [...stations].reverse();

    expect(matchStations(reversed, 'platz').map((s) => s.name)).toEqual([
      'Moritzplatz',
      'Hermannplatz',
      'Alexanderplatz',
    ]);
  });

  it('handles names with diacritics', () => {
    expect(matchStations(stations, 'schönlein').map((s) => s.name)).toEqual(['Schönleinstraße']);
  });
});
