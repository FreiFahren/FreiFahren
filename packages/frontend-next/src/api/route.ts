import { useQuery } from '@tanstack/react-query';

import { fetchJson, type LineType } from './transit';

export type RouteLegSegment = {
  /** Null when no seeded segment backs this hop. */
  segmentId: number | null;
  fromStationId: string;
  toStationId: string;
  offsetSeconds: number;
  /** Null means "could not be determined" — never render it as risk-free. */
  risk: number | null;
};

export type RouteLeg = {
  lineId: string;
  lineName: string;
  lineColor: string;
  lineType: LineType;
  fromStationId: string;
  toStationId: string;
  stationIds: string[];
  departureOffsetSeconds: number;
  arrivalOffsetSeconds: number;
  segments: RouteLegSegment[];
};

export type RoutePlan = {
  legs: RouteLeg[];
  totalSeconds: number;
  stationCount: number;
  transfers: number;
  risk: {
    overall: number;
    worstSegmentId: number | null;
    unratedSegments: number;
  };
};

export const routeQueryOptions = (fromId: string, toId: string) =>
  ({
    queryKey: ['route', fromId, toId] as const,
    queryFn: () =>
      fetchJson<RoutePlan>(
        `/v0/transit/route?${new URLSearchParams({ from: fromId, to: toId }).toString()}`,
      ),
    // Risk moves as reports come in; match the map's cadence so a journey never shows
    // a state the map has already moved on from.
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
    enabled: fromId.length > 0 && toId.length > 0 && fromId !== toId,
    retry: false,
  }) as const;

export const useRoute = (fromId: string, toId: string) => useQuery(routeQueryOptions(fromId, toId));
