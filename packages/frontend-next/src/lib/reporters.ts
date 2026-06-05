// Fabricated social-proof count — the app has no real user metric.
export const MIN_REPORTERS = 50_000;
export const MAX_REPORTERS = 60_000;

export const pickReporterCount = () =>
  Math.floor(Math.random() * (MAX_REPORTERS - MIN_REPORTERS + 1)) + MIN_REPORTERS;
