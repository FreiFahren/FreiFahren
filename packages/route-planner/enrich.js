
import { createClient } from "hafas-client"
import { profile as bvgProfile } from "hafas-client/p/bvg/index.js"

import { pick } from "lodash";

import existingData from "./stations.json";

const userAgent = "something";

const client = createClient(bvgProfile, userAgent);

async function enrichStationData(stationData) {
  const enrichedData = {}
  for (const [stationId, station] of Object.entries(stationData)) {
    let foundStation;

    while (true) {
      try {
        const stations = (await client.locations(station.name, {}));
        foundStation = stations.find(s => s.type !== "location");
        if (!foundStation) {
          // console.log("Only location found", station.name);
          foundStation = stations[0]
        }
        break;
      } catch (err) {
        // console.log("Hit rate limit", station.name)
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    // console.log(foundStation);
    // station.hafasId = foundStation.id;
    // station.hafasName = foundStation.name;
    enrichedData[stationId] = {
      ...station,
      hafasId: foundStation.id,
      hafasName: foundStation.name,
    }
  }
  return enrichedData;
}

const enrichedData = await enrichStationData(existingData);
console.log(JSON.stringify(enrichedData, null, 2));
