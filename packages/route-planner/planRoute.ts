import { createClient, type Leg } from "hafas-client";
import lineSegments from "./lineSegmentsByLine.json";
import lines from "./bvgLines.json"
import { profile as bvgProfile } from "hafas-client/p/bvg/index.js"
import { lineColors } from "./lineColors";

const userAgent = "something";
const client = createClient(bvgProfile, userAgent);

type LegOnKnownLine = Leg & { line: { name: keyof typeof lines } };

const isLegOnKnownLine = (leg: Leg): leg is LegOnKnownLine => leg.line?.name !== undefined && leg.line.name in lines;
const isKnownLine = (line: string | undefined): line is keyof typeof lines => line !== undefined && line in lines;

type FeatureCollection = {
  type: "FeatureCollection"
  features: {
    type: string,
    properties?: Record<string, string> | null | undefined,
    geometry: {
      type: string,
      coordinates: number[][]
    }
  }[]
}


const getLegBVGGeoJSON = (leg: Leg): FeatureCollection["features"] => {
  if (!leg.polyline) {
    return []
  }

  const color = isKnownLine(leg.line?.name)
    ? lineColors[leg.line.name]
    : "#993399";

  return [
    {
      type: "Feature",
      properties: {
        color,
      },
      geometry: {
        type: "LineString",
        coordinates: leg.polyline.features.map(f => f.geometry.coordinates)
      }
    }
  ]
}
const getLegFFGeoJSON = (leg: LegOnKnownLine): FeatureCollection["features"] => {
  if (leg.origin?.id === undefined || leg.destination?.id === undefined) {
    throw new Error("origin or destination missing")
  }

  const startIdx = lines[leg.line.name].indexOf(leg.origin.id);
  const endIdx = lines[leg.line.name].indexOf(leg.destination.id);

  const [first, second] = [startIdx, endIdx].sort();

  return lineSegments[leg.line.name].slice(first, second)
}

type Node = Parameters<typeof client["journeys"]>[0];

type Mode =
  | { type: "walking" }
  | { type: "bus", line: string }
  | { type: "train", line: string }

type ConnectionLeg = {
  origin: Node
  destination: Node
  mode: Mode
  geoJSON: FeatureCollection["features"]
}

type ConnectionOption = {
  legs: ConnectionLeg[]
}

export const planRoute = async (from: Node, to: Node): Promise<ConnectionOption[]> => {
  const { journeys } = await client.journeys(from, to, { polylines: true, results: 1 });

  const journey = journeys?.[0];

  if (journey === undefined) {
    throw new Error("No journeys found");
  }

  const legs = journey.legs.map(leg => {
    return {
      origin: leg.origin!,
      destination: leg.destination!,
      mode: leg.line ? { type: "train" as const, line: leg.line.name! } : { type: "walking" as const },
      geoJSON: getLegBVGGeoJSON(leg)// isLegOnKnownLine(leg) ? getLegFFGeoJSON(leg) : getLegBVGGeoJSON(leg),
    };
  });

  return [{ legs }]
}
