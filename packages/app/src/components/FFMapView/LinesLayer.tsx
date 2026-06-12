import { LineLayer, ShapeSource, SymbolLayer } from '@maplibre/maplibre-react-native'
import { useMemo } from 'react'

import { useLines, useSegments } from '../../api/queries'

export const LinesLayer = () => {
    const { data: segments } = useSegments()
    const { data: lines } = useLines()

    // Create a lookup map from line ID to line name
    const lineIdToName = useMemo(() => {
        if (!lines) return {}
        return Object.fromEntries(lines.map((line) => [line.id, line.name]))
    }, [lines])

    // Transform segments to add lineName property
    const transformedSegments = useMemo(() => {
        if (!segments || !lines) return segments

        return {
            ...segments,
            features: segments.features.map((feature) => ({
                ...feature,
                properties: {
                    ...feature.properties,
                    lineName: lineIdToName[feature.properties.line] || feature.properties.line,
                },
            })),
        }
    }, [segments, lineIdToName, lines])

    if (segments === undefined || lines === undefined) return null

    return (
        <ShapeSource id="route-source" shape={transformedSegments as GeoJSON.GeoJSON}>
            <LineLayer
                id="route-layer"
                style={{
                    lineWidth: 2.5,
                    lineJoin: 'round',
                    lineCap: 'round',
                    lineColor: ['get', 'color'],
                }}
            />
            <SymbolLayer
                id="route-name-layer"
                style={{
                    textField: ['get', 'lineName'],
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
