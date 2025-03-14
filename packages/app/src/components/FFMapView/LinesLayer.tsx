import { LineLayer, ShapeSource, SymbolLayer } from '@maplibre/maplibre-react-native'

import { useSegments } from '../../api/queries'

export const LinesLayer = () => {
    const { data: segments } = useSegments()

    if (segments === undefined) return null

    return (
        <ShapeSource id="route-source" shape={segments}>
            <LineLayer
                id="route-layer"
                style={{
                    lineWidth: 2.5,
                    lineJoin: 'round',
                    lineCap: 'round',
                    lineColor: ['get', 'line_color'],
                }}
            />
            <SymbolLayer
                id="route-name-layer"
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
}
