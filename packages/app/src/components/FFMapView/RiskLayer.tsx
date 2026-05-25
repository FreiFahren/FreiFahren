import { LineLayer, ShapeSource } from '@maplibre/maplibre-react-native'
import { useMemo } from 'react'

import { useRiskData, useSegments } from '../../api/queries'
import { useAppStore } from '../../app.store'

const useLinesWithRiskColors = (segmentsRisk?: Record<string, { color?: string; risk?: number }>) => {
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
                                  segmentsRisk !== undefined
                                      ? (segmentsRisk[String(feature.properties.id)]?.color ?? defaultColor)
                                      : defaultColor,
                          },
                      })),
                  },
        [segments, segmentsRisk]
    )
}

type RiskLayerProps = {
    visible: boolean
}

export const RiskLayer = ({ visible }: RiskLayerProps) => {
    const { data: riskData } = useRiskData()
    const riskGeoJson = useLinesWithRiskColors(riskData ? riskData.segments_risk : undefined)
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
