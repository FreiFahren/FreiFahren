import { describe, expect, it } from 'vitest';

import { riskLevel, RISK_COLORS } from './risk';
import { routeQueryOptions } from './route';

describe('routeQueryOptions', () => {
  it('keys the cache by both ends of the journey', () => {
    expect(routeQueryOptions('a', 'b').queryKey).toEqual(['route', 'a', 'b']);
    // Reversing must not read the other direction's cached answer: the risk of a
    // journey depends on when each leg is reached, which differs per direction.
    expect(routeQueryOptions('b', 'a').queryKey).not.toEqual(routeQueryOptions('a', 'b').queryKey);
  });

  it('is enabled for two different stations', () => {
    expect(routeQueryOptions('a', 'b').enabled).toBe(true);
  });

  it('is disabled while an end is still missing', () => {
    // The planner navigates as soon as both ends exist; until then no request should fly.
    expect(routeQueryOptions('', 'b').enabled).toBe(false);
    expect(routeQueryOptions('a', '').enabled).toBe(false);
  });

  it('is disabled for a journey to the same station', () => {
    // The endpoint answers 400 for this, so asking at all would only produce a failed query.
    expect(routeQueryOptions('a', 'a').enabled).toBe(false);
  });

  it('refetches on the same cadence as the map', () => {
    // A journey that lags behind the map would contradict what the user sees under it.
    expect(routeQueryOptions('a', 'b').refetchInterval).toBe(30_000);
  });
});

describe('risk levels shared with the map', () => {
  /*
   * The journey view labels its legs with the same function the map legend uses. These pin
   * the boundaries so the two cannot drift apart into different vocabularies.
   */
  it('maps the documented thresholds', () => {
    expect(riskLevel(0)).toBe('clear');
    expect(riskLevel(0.2)).toBe('clear');
    expect(riskLevel(0.21)).toBe('moderate');
    expect(riskLevel(0.5)).toBe('moderate');
    expect(riskLevel(0.51)).toBe('high');
    expect(riskLevel(0.9)).toBe('high');
    expect(riskLevel(0.91)).toBe('severe');
    expect(riskLevel(1)).toBe('severe');
  });

  it('has a colour for every level', () => {
    for (const level of ['clear', 'moderate', 'high', 'severe'] as const) {
      expect(RISK_COLORS[level]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
