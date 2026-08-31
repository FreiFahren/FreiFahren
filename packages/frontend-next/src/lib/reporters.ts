import type { PublicCityConfig } from '@freifahren/cities/public';

// Fabricated social-proof count — the app has no real user metric.
export const pickReporterCount = (city: PublicCityConfig): number | null => {
  const range = city.community.reporterCount;
  if (range === undefined) {
    return null;
  }
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
};
