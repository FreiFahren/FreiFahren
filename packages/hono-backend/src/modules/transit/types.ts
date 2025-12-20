import { InferSelectModel } from 'drizzle-orm'

import { lines } from '../../db/schema/lines'
import { stations } from '../../db/schema/stations'

type StationRow = InferSelectModel<typeof stations>
type LineRow = InferSelectModel<typeof lines>

type StationId = StationRow['id']
type LineId = LineRow['id']

type Station = {
    name: StationRow['name']
    coordinates: { latitude: StationRow['lat']; longitude: StationRow['lng'] }
    lines: LineId[]
}

type Stations = Record<StationId, Station>
type Lines = Record<LineId, StationId[] | undefined>

export type { Lines, Stations, StationId, LineId }
