// Station names are staggered by zoom so they never arrive all at once.
// Tier 0 = interchange, 1 = other trunk station, 2 = surface stop.
export type StationLabel = {
  trunkLineCount: number;
  labelTier: 0 | 1 | 2;
  /** Lower is placed first, so the busier station keeps its name in a collision. */
  labelSortKey: number;
};

// Trunk lines a station needs to count as an interchange, the first tier to be named.
const INTERCHANGE_MIN_LINES = 3;

/** `trunkNameById` maps the ids of trunk lines to their names; surface lines are absent from it. */
export function stationLabel(lineIds: string[], trunkNameById: Map<string, string>): StationLabel {
  // By name, so two route variants of one line don't make a station an interchange.
  const trunkLineCount = new Set(
    lineIds.map((id) => trunkNameById.get(id)).filter((name) => name !== undefined),
  ).size;
  const labelTier = trunkLineCount >= INTERCHANGE_MIN_LINES ? 0 : trunkLineCount > 0 ? 1 : 2;
  return {
    trunkLineCount,
    labelTier,
    labelSortKey: labelTier * 100 - Math.min(lineIds.length, 99),
  };
}
