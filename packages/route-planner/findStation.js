import fs from "fs"
import { createClient } from "hafas-client";
import lineSegments from "./lineSegmentsByLine.json";
import lines from "./bvgLines.json"
import { profile as bvgProfile } from "hafas-client/p/bvg/index.js"

const userAgent = "something";
const client = createClient(bvgProfile, userAgent);

const query = "Yorkstraße"

const response = await client.locations(query, { results: 4, addresses: false })

console.log(JSON.stringify(response, null, 2))

// Yorck-ID: 900058103
