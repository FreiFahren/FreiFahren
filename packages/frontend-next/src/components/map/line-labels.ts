import type { Feature, FeatureCollection, LineString, Position } from 'geojson';

import type { Line, Segments } from '@/api/transit';

// Line names are drawn the way road maps draw route numbers: a small upright badge in the line's
// colour, repeated along the track and dropped wherever it would collide with another one. Lines
// that run over the same track would all want the same spots, so they're labelled together: every
// stretch between two points where the set of lines changes becomes one "run", carrying one badge
// per colour ("S5 S7 S75") laid out side by side.

export type LineLabelProperties = {
  label: string;
  color: string;
  textColor: string;
  /** Horizontal shift in ems that places this badge in its slot of the run's row of badges. */
  dx: number;
  /** Only surface-tier lines, so the badge appears with them rather than at the overview. */
  secondary: boolean;
  /** Lower is placed first, so rapid transit wins a collision against a tram or bus. */
  sortKey: number;
};
export type LineLabels = FeatureCollection<LineString, LineLabelProperties>;

// A corridor can carry ten lines; past these caps the row would be wider than the track is long.
const MAX_NAMES_PER_BADGE = 4;
const MAX_BADGES_PER_RUN = 3;

// Rough advance widths (in ems) of the bold label font, used only to space neighbouring badges.
const CHAR_EM = 0.62;
const BADGE_PADDING_EM = 1;
// Wide enough to clear the layer's collision padding on both badges, or one of a pair is dropped.
const BADGE_GAP_EM = 1;

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Dark text on light line colours, white on the rest (by WCAG relative luminance). The switch sits
 * above the point of equal contrast on purpose: mid-tones keep the white of transit signage.
 */
export function contrastTextColor(hex: string): string {
  const value = parseInt(hex.replace('#', ''), 16);
  const channel = (shift: number) => {
    const c = ((value >> shift) & 0xff) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
  return luminance > 0.4 ? '#111111' : '#ffffff';
}

type Badge = Omit<LineLabelProperties, 'dx'>;

// Route variants ("S85" towards two termini) share a name.
const uniqueNames = (lines: Line[]) => [...new Set(lines.map((line) => line.name))];

/** One badge per colour, for `lines` in display order. */
function badgesFor(lines: Line[], secondaryTypes: Set<string>): Badge[] {
  const byColor = new Map<string, Line[]>();
  for (const line of lines) {
    const group = byColor.get(line.color);
    if (group) group.push(line);
    else byColor.set(line.color, [line]);
  }

  const groups = [...byColor];
  // The last badge also counts the lines of the colours that got no badge.
  const unbadged = uniqueNames(groups.slice(MAX_BADGES_PER_RUN).flatMap(([, group]) => group));

  return groups.slice(0, MAX_BADGES_PER_RUN).map(([color, group], index) => {
    const names = uniqueNames(group);
    const shown = names.slice(0, MAX_NAMES_PER_BADGE);
    const hidden =
      names.length - shown.length + (index === MAX_BADGES_PER_RUN - 1 ? unbadged.length : 0);
    if (hidden > 0) shown.push(`+${hidden}`);
    const secondary = group.every((line) => secondaryTypes.has(line.type));
    return {
      label: shown.join(' '),
      color,
      textColor: contrastTextColor(color),
      secondary,
      sortKey: (secondary ? 100 : 0) + index,
    };
  });
}

/** Centre offsets (ems) that lay badges out in a row centred on the anchor. */
function rowOffsets(badges: Badge[]): number[] {
  const widths = badges.map((badge) => badge.label.length * CHAR_EM + BADGE_PADDING_EM);
  const total = widths.reduce((sum, w) => sum + w, 0) + BADGE_GAP_EM * (badges.length - 1);
  let cursor = -total / 2;
  return widths.map((width) => {
    const centre = cursor + width / 2;
    cursor += width + BADGE_GAP_EM;
    return Math.round(centre * 100) / 100;
  });
}

/** `lines` in display order, which is the order names and badges are listed in. */
export function buildLineLabels(
  segments: Segments,
  lines: Line[],
  secondaryTypes: Set<string>,
): LineLabels {
  const lineById = new Map(lines.map((line) => [line.id, line]));
  const orderById = new Map(lines.map((line, index) => [line.id, index]));
  const geometryBySegment = new Map<string, Position[]>();
  const lineIdsByPair = new Map<string, Set<string>>();
  for (const { properties, geometry } of segments.features) {
    geometryBySegment.set(
      `${properties.line}|${properties.from}|${properties.to}`,
      geometry.coordinates,
    );
    const pair = pairKey(properties.from, properties.to);
    const ids = lineIdsByPair.get(pair);
    if (ids) ids.add(properties.line);
    else lineIdsByPair.set(pair, new Set([properties.line]));
  }

  const features: Feature<LineString, LineLabelProperties>[] = [];
  // Every line of a run walks it, so the run is emitted by whichever gets there first.
  const emitted = new Set<string>();

  const emit = (signature: string, pairs: string[], coordinates: Position[]) => {
    if (coordinates.length < 2) return;
    const first = pairs[0];
    const last = pairs[pairs.length - 1];
    const runKey = `${signature}#${first < last ? `${first}#${last}` : `${last}#${first}`}`;
    if (emitted.has(runKey)) return;
    emitted.add(runKey);

    const runLines = signature
      .split(',')
      .map((id) => lineById.get(id))
      .filter((line) => line !== undefined)
      .sort((a, b) => (orderById.get(a.id) ?? 0) - (orderById.get(b.id) ?? 0));
    const badges = badgesFor(runLines, secondaryTypes);
    const offsets = rowOffsets(badges);
    badges.forEach((badge, index) => {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates },
        properties: { ...badge, dx: offsets[index] },
      });
    });
  };

  for (const line of lines) {
    let signature = '';
    let pairs: string[] = [];
    let coordinates: Position[] = [];

    for (let i = 0; i < line.stations.length - 1; i++) {
      const from = line.stations[i];
      const to = line.stations[i + 1];
      const forward = geometryBySegment.get(`${line.id}|${from}|${to}`);
      const backward = geometryBySegment.get(`${line.id}|${to}|${from}`);
      const geometry = forward ?? (backward ? [...backward].reverse() : null);
      const pair = pairKey(from, to);
      const next = geometry ? [...(lineIdsByPair.get(pair) ?? [])].sort().join(',') : '';

      if (next !== signature) {
        if (signature) emit(signature, pairs, coordinates);
        signature = next;
        pairs = [];
        coordinates = [];
      }
      if (geometry) {
        pairs.push(pair);
        // Consecutive segments meet at the station, so skip the repeated point.
        coordinates.push(...(coordinates.length ? geometry.slice(1) : geometry));
      }
    }
    if (signature) emit(signature, pairs, coordinates);
  }

  return { type: 'FeatureCollection', features };
}
