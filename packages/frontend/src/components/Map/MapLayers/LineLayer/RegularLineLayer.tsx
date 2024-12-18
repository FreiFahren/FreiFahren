import React from 'react'
import { Layer,Source } from 'react-map-gl/maplibre'

interface RegularLineLayerProps {
    lineSegments: GeoJSON.FeatureCollection<GeoJSON.LineString> | null
    textColor: string
}

const RegularLineLayer: React.FC<RegularLineLayerProps> = ({ lineSegments, textColor }) => {
    const firstPriorityLines = ['U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U8', 'U9']

    if (!lineSegments) return null
    return (
        <Source id="line-data" type="geojson" data={lineSegments}>
                <Layer
                    id="line-layer"
                    type="line"
                    beforeId="stationLayer"
                    source="line-data"
                    layout={{
                        'line-join': 'round',
                        'line-cap': 'round',
                    }}
                    paint={{
                        'line-color': ['get', 'line_color'], // Set the base color from the GeoJSON
                        'line-width': 3,
                    }}
                />
                <Layer
                    id="label-layer"
                    type="symbol"
                    beforeId="stationLayer"
                    source="line-data"
                    layout={{
                        'text-field': ['get', 'line'],
                        'text-size': 13,
                        'symbol-placement': 'line',
                        'text-anchor': 'top',
                        'text-offset': [0, 1.5],
                        'text-keep-upright': true,
                        'text-optional': true,
                    }}
                    paint={{
                        'text-color': textColor,
                        'text-opacity': [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            10,
                            ['case', ['in', ['get', 'line'], ['literal', firstPriorityLines]], 1, 0],
                            12,
                            1,
                        ],
                    }}
                />
            </Source>
    )
}

export { RegularLineLayer }
