import type {
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
} from '@maplibre/maplibre-gl-style-spec';
import type { FeatureCollection, LineString, Point } from 'geojson';

import { HOUR_MS, useReports } from '@/api/reports';
import {
  LINE_TYPE_PRIORITY,
  type SegmentProperties,
  useLines,
  useSegments,
  useStations,
} from '@/api/transit';
import { currentCity } from '@/lib/city';

// A dense multi-modal network is unreadable if every line draws at full width/opacity at every
// zoom. Rapid transit (the "trunk") stays visible; street-level surface modes (tram, bus, …) form a
// "secondary" tier drawn faintly at the metro-area overview (a "we cover this" hint) and revealed
// at full strength on a small zoom-in. The split is derived per city from LINE_TYPE_PRIORITY (see
// useSecondaryTypes), so it adapts to whichever modes a city has.

// Where rapid transit ends and surface modes begin. Anchored to tram so a lower-ranked mode (bus)
// joins the surface tier automatically.
const SURFACE_MIN_PRIORITY = LINE_TYPE_PRIORITY.tram;

// Per-segment tier flags read by the paint expressions below. `reported` (an active report on the
// line) forces it visible and heavier so a report marker never floats over a hidden line.
export type TypedSegmentProperties = SegmentProperties & {
  secondary: boolean;
  reported: boolean;
};
export type TypedSegments = FeatureCollection<LineString, TypedSegmentProperties>;

/**
 * The surface-mode types to hide at overview zoom for the current city. With rapid transit present,
 * every surface mode is secondary; an all-surface city (e.g. tram+bus) keeps its top mode as trunk.
 * Single-mode cities and types absent from the priority map hide nothing.
 */
function useSecondaryTypes(): Set<string> {
  const { data: lines } = useLines();
  const secondary = new Set<string>();
  if (!lines) return secondary;

  const priorities = LINE_TYPE_PRIORITY as Record<string, number | undefined>;
  const priorityByType = new Map<string, number>();
  for (const line of lines) {
    const priority = priorities[line.type];
    if (priority !== undefined) priorityByType.set(line.type, priority);
  }
  if (priorityByType.size < 2) return secondary;

  const surface = [...priorityByType].filter(([, priority]) => priority >= SURFACE_MIN_PRIORITY);
  const hasRapidTransit = [...priorityByType.values()].some((p) => p < SURFACE_MIN_PRIORITY);
  // -Infinity ⇒ all surface modes hide; else the top surface mode stays trunk.
  const trunkAnchor = hasRapidTransit ? -Infinity : Math.min(...surface.map(([, p]) => p));
  for (const [type, priority] of surface) {
    if (priority > trunkAnchor) secondary.add(type);
  }
  return secondary;
}

/** Line and station ids with an active report, from the same last-hour window as the markers. */
function useReportedIds(): { lines: Set<string>; stations: Set<string> } {
  const { data: reports } = useReports(HOUR_MS);
  const lines = new Set<string>();
  const stations = new Set<string>();
  if (reports)
    for (const report of reports) {
      stations.add(report.stationId);
      if (report.lineId) lines.add(report.lineId);
    }
  return { lines, stations };
}

/** Segments tagged with their tier flags for the line layers; `undefined` until segments load. */
export function useTypedSegments(): TypedSegments | undefined {
  const { data: segments } = useSegments();
  const { data: lines } = useLines();
  const secondaryTypes = useSecondaryTypes();
  const reported = useReportedIds();

  if (!segments) return undefined;

  const typeById = new Map<string, string>();
  if (lines) for (const line of lines) typeById.set(line.id, line.type);

  return {
    ...segments,
    features: segments.features.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        secondary: secondaryTypes.has(typeById.get(feature.properties.line) ?? ''),
        reported: reported.lines.has(feature.properties.line),
      },
    })),
  };
}

// Per-station flags for the fade: `trunk` = serves a non-secondary line; `reported` = has a report.
// Either keeps the dot, and its tap target, visible.
export type StationPointProps = { id: string; name: string; trunk: boolean; reported: boolean };

/** Station points tagged for the fade; `undefined` until stations load. */
export function useTrunkStationsGeoJSON(): FeatureCollection<Point, StationPointProps> | undefined {
  const { data: stations } = useStations();
  const { data: lines } = useLines();
  const secondaryTypes = useSecondaryTypes();
  const reported = useReportedIds();

  if (!stations) return undefined;

  const trunkLineIds = new Set<string>();
  if (lines)
    for (const line of lines) if (!secondaryTypes.has(line.type)) trunkLineIds.add(line.id);
  const linesLoaded = Boolean(lines);

  return {
    type: 'FeatureCollection',
    features: Object.values(stations).map((station) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [station.coordinates.longitude, station.coordinates.latitude],
      },
      properties: {
        id: station.id,
        name: station.name,
        trunk: linesLoaded ? station.lines.some((id) => trunkLineIds.has(id)) : true,
        reported: reported.stations.has(station.id),
      },
    })),
  };
}

// The secondary tier is drawn faintly (SECONDARY_MIN_OPACITY) from the city's overview zoom and
// ramps to full strength one-and-a-half levels in, so a small zoom-in surfaces trams/buses — the
// discoverability lever. Anchored to the initial zoom so the faint hint shows on first paint in any
// city. Stations reveal on the same ramp (but from hidden, since faint dots would just clutter).
const SECONDARY_FADE_START = currentCity.map.zoom;
const SECONDARY_FADE_END = SECONDARY_FADE_START + 1.5;

// Faint overview opacity for the secondary tier — enough to hint coverage, not enough to compete
// with the trunk network. A teaser that invites zooming; full legibility is at _END. Tune here.
const SECONDARY_MIN_OPACITY = 0.2;

// Zoom at which the secondary tier is fully shown — the point a user has "discovered" it. Exported
// so discovery analytics track the same threshold the rendering uses.
export const SECONDARY_REVEAL_ZOOM = SECONDARY_FADE_END;

// `zoom` must be the top-level input to `interpolate`, so the trunk/selected/reported override
// lives in the per-stop value rather than wrapping the interpolate in a `case`.
export function stationOpacity(selectedId: string): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    SECONDARY_FADE_START,
    [
      'case',
      ['==', ['get', 'id'], selectedId],
      1,
      ['any', ['get', 'trunk'], ['get', 'reported']],
      1,
      0,
    ],
    SECONDARY_FADE_END,
    1,
  ];
}

// Tap target tracks the fade, so a tap on the empty overview never selects an invisible station.
export function stationHitRadius(selectedId: string): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    SECONDARY_FADE_START,
    [
      'case',
      ['==', ['get', 'id'], selectedId],
      12,
      ['any', ['get', 'trunk'], ['get', 'reported']],
      12,
      0,
    ],
    SECONDARY_FADE_END,
    12,
  ];
}

export const LINE_OPACITY: DataDrivenPropertyValueSpecification<number> = [
  'interpolate',
  ['linear'],
  ['zoom'],
  SECONDARY_FADE_START,
  ['case', ['get', 'reported'], 1, ['case', ['get', 'secondary'], SECONDARY_MIN_OPACITY, 1]],
  SECONDARY_FADE_END,
  ['case', ['get', 'reported'], 1, ['case', ['get', 'secondary'], 0.85, 1]],
];

// Trunk (and reported) lines draw heavier than secondary lines, and everything thickens with zoom.
export const LINE_WIDTH: DataDrivenPropertyValueSpecification<number> = [
  'interpolate',
  ['linear'],
  ['zoom'],
  10,
  ['case', ['any', ['get', 'reported'], ['!', ['get', 'secondary']]], 1.4, 0.6],
  13,
  ['case', ['any', ['get', 'reported'], ['!', ['get', 'secondary']]], 2.8, 1.4],
  16,
  ['case', ['any', ['get', 'reported'], ['!', ['get', 'secondary']]], 5, 3],
];
