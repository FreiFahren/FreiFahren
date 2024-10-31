import { LineLayer, ShapeSource } from '@maplibre/maplibre-react-native'

import { routeGeoJSON } from '../../data'

export const RouteLayer = () => (
    <ShapeSource id="route-source" shape={routeGeoJSON as GeoJSON.GeoJSON}>
        <LineLayer
            id="route-layer"
            style={{
                lineWidth: 7,
                lineJoin: 'round',
                lineCap: 'round',
                lineColor: ['get', 'color'],
            }}
        />
    </ShapeSource>
)
