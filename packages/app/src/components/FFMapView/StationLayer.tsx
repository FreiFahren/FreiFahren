import { CircleLayer, ShapeSource } from '@maplibre/maplibre-react-native'

import { stations } from '../../data'

const stationsAsGeoJSON = () => {
    return {
        type: 'FeatureCollection',
        features: Object.keys(stations).map((key) => ({
            type: 'Feature',
            properties: {
                name: stations[key].name,
                lines: stations[key].lines,
            },
            geometry: {
                type: 'Point',
                coordinates: [stations[key].coordinates.longitude, stations[key].coordinates.latitude],
            },
        })),
    }
}

const stationsGeoJSON = stationsAsGeoJSON()

export const StationLayer = () => {
    return (
        <ShapeSource id="stationSource" shape={stationsGeoJSON as GeoJSON.GeoJSON}>
            <CircleLayer
                id="stationLayer"
                style={{
                    circleRadius: 2,
                    circleColor: '#ffffff',
                    circleStrokeWidth: 1,
                    circleStrokeColor: '#000000',
                }}
            />
        </ShapeSource>
    )
}
