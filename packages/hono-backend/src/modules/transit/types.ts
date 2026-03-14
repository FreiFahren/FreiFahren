import { InferSelectModel } from 'drizzle-orm'

import { lines } from '../../db/schema/lines'
import { segments } from '../../db/schema/segments'
import { stations } from '../../db/schema/stations'

type StationRow = InferSelectModel<typeof stations>
type LineRow = InferSelectModel<typeof lines>
type SegmentRow = InferSelectModel<typeof segments>

type StationId = StationRow['id']
type LineId = LineRow['id']

type Station = {
    name: StationRow['name']
    coordinates: { latitude: StationRow['lat']; longitude: StationRow['lng'] }
    lines: LineId[]
}

type SegmentProperties = {
    line: SegmentRow['lineId']
    from: SegmentRow['fromStationId']
    to: SegmentRow['toStationId']
    color: SegmentRow['color']
}

type SegmentFeature = {
    type: 'Feature'
    properties: SegmentProperties
    geometry: {
        type: 'LineString'
        coordinates: SegmentRow['coordinates']
    }
}

type SegmentsFeatureCollection = {
    type: 'FeatureCollection'
    features: SegmentFeature[]
}

type Stations = Record<StationId, Station>
type Lines = Record<LineId, StationId[]>

export type { Lines, Stations, SegmentsFeatureCollection, SegmentFeature, StationId, LineId }
