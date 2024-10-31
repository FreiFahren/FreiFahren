import { LineLayer, ShapeSource, SymbolLayer } from '@maplibre/maplibre-react-native'

import { linesGeoJSON } from '../../data'

export const LinesLayer = () => (
    <ShapeSource id="lines-source" shape={linesGeoJSON as GeoJSON.GeoJSON}>
        <LineLayer
            id="lines-layer"
            style={{
                lineWidth: 3,
                lineJoin: 'round',
                lineCap: 'round',
                lineColor: ['get', 'color'],
                lineOpacity: 0.5,
            }}
        />
        <SymbolLayer
            id="lines-name-layer"
            style={{
                textField: ['get', 'line'],
                textColor: '#FFF',
                textAnchor: 'center',
                textSize: 12,
                textOffset: [0, 1],
                textMaxAngle: 10,
                symbolPlacement: 'line',
                symbolSpacing: 100,
            }}
        />
    </ShapeSource>
)
