import fs from 'fs';
import lineSegments from './line-segments.json';
import { groupBy } from 'lodash';

const segments = lineSegments.features;

const byLine = groupBy(segments, 'properties.line');

console.log(byLine.U1)

fs.writeFileSync("lineSegmentsByLine.json", JSON.stringify(byLine, null, 2));
