import { createClient } from "hafas-client"
import fs from "fs"
import { profile as bvgProfile } from "hafas-client/p/bvg/index.js"

import existingData from "./enrichedStations.json";

const userAgent = "something";

const client = createClient(bvgProfile, userAgent);

const stationsNotFound = Object.entries(existingData).filter(([_, station]) => !station.hafasId);

for (const [stationId, station] of stationsNotFound) {
  while (true) {
    try {
      const results = await client.locations(station.name, { addresses: false });
      const hafasStation = results.find(result => result.type !== "location") ?? results[0];

      existingData[stationId] = {
        ...station,
        hafasId: hafasStation.id,
        hafasName: hafasStation.name,
      }

      console.log(existingData[stationId]);

      if (!hafasStation.id) {
        console.log("No ID found for station", station.name, results);
      }

      break;
    } catch (err) {
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    }
  }
};

fs.writeFileSync("enrichedStations2.json", JSON.stringify(existingData, null, 2));
