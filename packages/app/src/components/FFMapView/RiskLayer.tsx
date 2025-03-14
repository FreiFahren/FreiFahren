import { LineLayer, ShapeSource } from '@maplibre/maplibre-react-native'
import { useMemo } from 'react'

import { useRiskData, useSegments } from '../../api/queries'
import { useAppStore } from '../../app.store'

const useLinesWithRiskColors = (segmentColors?: { [key: string]: string }) => {
    const { data: segments } = useSegments()

    const defaultColor = '#13C184'

    return useMemo(
        () =>
            segments === undefined
                ? null
                : {
                      ...segments,
                      features: segments.features.map((feature) => ({
                          ...feature,
                          properties: {
                              ...feature.properties,
                              color:
                                  segmentColors !== undefined
                                      ? (segmentColors[feature.properties.sid] ?? defaultColor)
                                      : defaultColor,
                          },
                      })),
                  },
        [segments, segmentColors]
    )
}

type RiskLayerProps = {
    visible: boolean
}

export const RiskLayer = ({ visible }: RiskLayerProps) => {
    const { data: riskData } = useRiskData()
    const riskGeoJson = useLinesWithRiskColors(riskData?.segmentColors)
    const shouldShow = useAppStore((state) => !state.appLocked)

    if (riskGeoJson === null) return null

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
