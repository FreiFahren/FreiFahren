import { describe, expect, it } from 'vitest';

import { normalizeStationQuery } from '../src/components/report/ReportSelection.context';
import { stationMatcher } from '../src/lib/station-search';

const lowerCase = (value: string) => value.toLowerCase();

const finds = (query: string, name: string, normalize = lowerCase) =>
  stationMatcher(query, normalize)?.(normalize(name)) ?? false;

describe('station search', () => {
  it.each([
    ['S Karlshorst', 'Karlshorst'],
    ['s karlshorst', 'Karlshorst'],
    ['U Kottbusser Tor', 'Kottbusser Tor'],
    ['S+U Alexanderplatz', 'Alexanderplatz'],
    ['U+S Alexanderplatz', 'Alexanderplatz'],
    ['U S Barmbek', 'Barmbek'],
    ['Kronenplatz (U)', 'Kronenplatz'],
    ['S Karl', 'Karlshorst'],
  ])('finds a station when the query carries a mode marker: %s', (query, name) => {
    expect(finds(query, name)).toBe(true);
    expect(finds(query, name, normalizeStationQuery)).toBe(true);
  });

  it.each([
    ['Karlshorst', 'Karlshorst'],
    ['uhland', 'Uhlandstraße'],
    ['s', 'Seestraße'],
    ['Bilk S', 'Bilk S'],
    ['U Sonderfall', 'U Sonderfall'],
  ])('still finds %s as typed', (query, name) => {
    expect(finds(query, name)).toBe(true);
  });

  it('does not find a different station', () => {
    expect(finds('S Karlshorst', 'Lichtenberg')).toBe(false);
    expect(finds('Uhlandstraße', 'Landstraße')).toBe(false);
  });

  it('has nothing to match for an empty query', () => {
    expect(stationMatcher('  ', lowerCase)).toBeNull();
  });
});
