import { LineLayer, ShapeSource } from '@maplibre/maplibre-react-native'
import { useMemo } from 'react'

import { useRiskData } from '../../api/queries'
import { useAppStore } from '../../app.store'
import lines from '../../data/line-segments.json'

const linesWithRiskColors = (segmentColors?: { [key: string]: string }) => {
    const defaultColor = '#13C184'

    return {
        ...lines,
        features: lines.features.map((feature) => ({
            ...feature,
            properties: {
                ...feature.properties,
                color:
                    segmentColors !== undefined
                        ? (segmentColors[feature.properties.sid] ?? defaultColor)
                        : defaultColor,
            },
        })),
    }
}

type RiskLayerProps = {
    visible: boolean
}

export const RiskLayer = ({ visible }: RiskLayerProps) => {
    const { data: riskData } = useRiskData()
    const riskGeoJson = useMemo(() => linesWithRiskColors(riskData?.segmentColors), [riskData])
    const shouldShow = useAppStore((state) => !state.appLocked)

    return (
        <ShapeSource id="risk-source" shape={riskGeoJson as GeoJSON.GeoJSON}>
            <LineLayer
                id="risk-layer"
                style={{
                    lineWidth: 3,
                    lineJoin: 'round',
                    lineCap: 'round',
                    lineColor: ['get', 'color'],
                    lineOpacity: visible && shouldShow ? 1 : 0,
                }}
            />
        </ShapeSource>
    )
}
