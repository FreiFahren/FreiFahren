import fs from "fs"
import { createClient } from "hafas-client";
import lineSegments from "./lineSegmentsByLine.json";
import lines from "./bvgLines.json"
import linesOld from "./lines.json"
import { profile as bvgProfile } from "hafas-client/p/bvg/index.js"

const userAgent = "something";
const client = createClient(bvgProfile, userAgent);

const getLegBVGGeoJSON = (leg, color) => {
  if (!leg.polyline) {
    throw new Error("No polyline found");
  }

  return {
    type: "Feature",
    properties: {
      color
    },
    geometry: {
      type: "LineString",
      coordinates: leg.polyline.features.map(f => f.geometry.coordinates)
    }
  }
}

const lineSegmentsNew = {};

// for (const line in lines) {
const line = "S2"
  lineSegmentsNew[line] = []

  const color = lineSegments[line][0].properties.color

  for (let i = 0; i < lines[line].length - 1; i++) {
    const cur = lines[line][i]
    const next = lines[line][i + 1]

    if (next === undefined) {
      break;
    }

    let journeys;
    while (true) {
      try {
        journeys = (await client.journeys(cur, next, {
          results: 15,
          polylines: true,
          products: {
            suburban: true,
            subway: true,
            // [line.startsWith("S") ? "suburban" : "subway"]: true,
            // tram: false,
            // bus: false,
          }
        })).journeys
        break;
      } catch (err) {
        console.log(err);
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    // const journey = journeys.find(j => j.legs.length === 1 && j.legs.every(leg => leg.line.name === line))
    const leg = journeys.map(j => j.legs.find(leg => leg.line?.name.charAt(0) === line.charAt(0))).find(l => l !== undefined)

    if (!leg) {
      console.log(JSON.stringify(journeys, null, 2));
      throw new Error(`[${line}] No journey found for ${linesOld[line][i]} -> ${linesOld[line][i + 1]}`)
    }

    lineSegmentsNew[line].push(getLegBVGGeoJSON(leg, color))
    console.log(`[${line}] done with ${linesOld[line][i]} -> ${linesOld[line][i + 1]}`)
  }

  console.log(`Done with ${line}`)
// }

fs.writeFileSync("lineSegmentsByLine.new.json", JSON.stringify(lineSegmentsNew, null, 2));
