import fs from "fs"
import lineSegments from "./lineSegmentsByLine.json"

const s41 = [...lineSegments.S41]

const s42 = s41.reverse().map((segment, index) => ({
  ...segment,
  properties: {
    ...segment.properties,
    line: "S42",
    sid: `S42-${index + 1}`,
  }
}))

lineSegments["S42"] = s42

fs.writeFileSync("lineSegmentsByLine2.json", JSON.stringify(lineSegments, null, 2));
