import React, { useEffect, useState } from 'react'
import { Layer, Source } from 'react-map-gl/maplibre'
import { RiskData, SegmentFeature, SegmentsFeatureCollection } from 'src/utils/types'

interface RiskLineLayerProps {
    preloadedRiskData: RiskData | null
    lineSegments: SegmentsFeatureCollection | null
}

type ColoredSegmentFeature = GeoJSON.Feature<
    GeoJSON.LineString,
    SegmentFeature['properties'] & { line_color: string; risk_value: number }
>

const applyRiskColorsToSegments = (
    data: SegmentsFeatureCollection,
    segmentsRisk: RiskData['segments_risk']
): GeoJSON.FeatureCollection<GeoJSON.LineString, ColoredSegmentFeature['properties']> => {
    const features: ColoredSegmentFeature[] = []
    for (const feature of data.features) {
        const risk = segmentsRisk[String(feature.properties.id)]
        if (!risk) continue
        features.push({
            ...feature,
            properties: {
                ...feature.properties,
                line_color: risk.color,
                risk_value: risk.risk,
            },
        })
    }
    return { type: 'FeatureCollection', features }
}

const RiskLineLayer: React.FC<RiskLineLayerProps> = ({ lineSegments, preloadedRiskData }) => {
    const [geoJSON, setGeoJSON] = useState<GeoJSON.FeatureCollection<
        GeoJSON.LineString,
        ColoredSegmentFeature['properties']
    > | null>(null)

    useEffect(() => {
        if (!lineSegments || !preloadedRiskData?.segments_risk) {
            setGeoJSON(null)
            return
        }
        const colored = applyRiskColorsToSegments(lineSegments, preloadedRiskData.segments_risk)
        setGeoJSON(colored.features.length > 0 ? colored : null)
    }, [preloadedRiskData, lineSegments])

    if (!geoJSON) {
        return null
    }

    return (
        <Source id="risk-line-data" type="geojson" data={geoJSON}>
            <Layer
                id="risk-line-layer"
                type="line"
                beforeId="stationLayer"
                source="risk-line-data"
                layout={{
                    'line-join': 'round',
                    'line-cap': 'round',
                }}
                paint={{
                    'line-color': ['get', 'line_color'],
                    'line-width': 3,
                }}
            />
        </Source>
    )
}

export { RiskLineLayer }
