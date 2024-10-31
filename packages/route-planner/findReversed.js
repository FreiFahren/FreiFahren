import fs from "fs"
import { createClient } from "hafas-client";
import lineSegments from "./lineSegmentsByLine.json";
import lines from "./bvgLines.json"
import { profile as bvgProfile } from "hafas-client/p/bvg/index.js"

const userAgent = "something";
const client = createClient(bvgProfile, userAgent);

function distance(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371000; // in meters

  // Convert latitude and longitude to radians
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  // Haversine formula
  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}

for (const line in lines) {
  const firstInLines = lines[line][0]
  const firstInSegmentsCoords = [...lineSegments[line][0].geometry.coordinates[0]].reverse()

  let station
  while (true) {
    try {
      station = (await client.locations(firstInLines, {}))[0];
      break
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 1500))
    }
  }

  const { latitude, longitude } = station.location

  const dist = distance(latitude, longitude, firstInSegmentsCoords[0], firstInSegmentsCoords[1])

  if (dist < 1000) {
    continue
  }

  console.log({ line, dist, ours: firstInSegmentsCoords, hafas: [latitude, longitude] });

  lineSegments[line] = lineSegments[line].reverse()

  fs.writeFileSync("lineSegmentsByLine.json", JSON.stringify(lineSegments, null, 2));
}
