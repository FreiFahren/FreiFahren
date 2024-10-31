import enrichedStations from "./enrichedStations.json"
import fs from "fs"

/* const rekeyed = Object.fromEntries(
  Object.entries(enrichedStations).map(([ffId, station]) => [
    station.hafasId,
    {
      ...station,
      ffId,
    }
  ])
); */

// fs.writeFileSync("bvgStations.json", JSON.stringify(rekeyed, null, 2));

import lines from "./lines.json"

const newLines = Object.fromEntries(
  Object.entries(lines).map(([lineName, stations]) => [
    lineName,
    stations.map(station => enrichedStations[station].hafasId)
  ])
);

fs.writeFileSync("bvgLines.json", JSON.stringify(newLines, null, 2));
