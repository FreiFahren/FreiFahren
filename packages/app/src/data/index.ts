import lineSegmentsJson from './line-segments.json'
import linesJson from './lines.json'
import routeJson from './route.json'
import stationsJson from './stations.json'

export type Station = {
    name: string
    coordinates: {
        latitude: number
        longitude: number
    }
    lines: string[]
}

export const stations = stationsJson as Record<string, Station>
export const lines = linesJson as Record<string, string[]>

export const linesGeoJSON = lineSegmentsJson as GeoJSON.FeatureCollection<GeoJSON.LineString>
export const routeGeoJSON = routeJson as GeoJSON.FeatureCollection<GeoJSON.LineString>
