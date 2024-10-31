import fs from "fs"
import { createClient } from "hafas-client"
import { profile as bvgProfile } from "hafas-client/p/bvg/index.js"

import { pick } from "lodash";
import { planRoute } from "./planRoute";

const userAgent = "something";

const client = createClient(bvgProfile, userAgent);

/* const { journeys } = await client.journeys('900020201', '900068201', {
  results: 1,
});
// console.log(JSON.stringify(journeys, null, 2))

const locations = await client.locations("Kottbusser Tor", {});

console.log(JSON.stringify(locations, null, 2)) */

// const from = '900020201';
// const to = '900068201';
const from = (await client.locations("Kottbusser Tor", {}))[0].id!;
const to = (await client.locations("Ernst-Rheuter Platz", {}))[0].id!;
console.log('got locations')

// console.log(JSON.stringify(await planRoute(from, to), null, 2));

const response = await planRoute(from, to);
console.log('got route')

console.log(JSON.stringify(response, null, 2));

const featureCollection = {
  type: "FeatureCollection",
  features: response[0].legs.flatMap(leg => leg.geoJSON)
}

fs.writeFileSync("route.geojson", JSON.stringify(featureCollection, null, 2));

/* const { journeys } = await client.journeys(from, to, {
  results: 1,
  // polylines: true  // Important: Request polylines/geometry
})

const journey = journeys?.[0]

if (journey === undefined) {
  throw new Error("No journeys found");
}

const legs = journey.legs.map(leg => {
  if (!leg.polyline) {
    return null
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: leg.polyline.features.map(f => f.geometry.coordinates)
        }
      }
    ],
  }
  return pick(leg, ["origin", "destination", "line", "mode", "direction"]);
});

console.log(JSON.stringify(journey, null, 2));


// Extract coordinates from legs
/* const routeGeometry = journey.legs.map(leg => {
  if (leg.polyline) {
    // Convert to GeoJSON format
    return {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: leg.polyline.features[0].geometry.coordinates
      },
      properties: {
        type: leg.line ? leg.line.product : leg.mode,
        name: leg.line ? leg.line.name : 'walking'
      }
    }
  }
  return null
}).filter(Boolean)

// Combine into a single GeoJSON FeatureCollection
return {
  type: 'FeatureCollection',
  features: routeGeometry
}
*/
// console.log(JSON.stringify(journeys, null, 2))

