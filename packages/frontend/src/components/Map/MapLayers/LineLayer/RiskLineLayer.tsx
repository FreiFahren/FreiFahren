/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import React, { useEffect, useState } from 'react'
import { Layer, Source } from 'react-map-gl/maplibre'
import { RiskData, SegmentRisk } from 'src/utils/types'

interface RiskLineLayerProps {
    preloadedRiskData: RiskData | null
    lineSegments: GeoJSON.FeatureCollection<GeoJSON.LineString> | null
}

const filterSegmentsWithRisk = (
    data: GeoJSON.FeatureCollection<GeoJSON.LineString>,
    segmentsRisk: { [key: string]: SegmentRisk } | undefined
): GeoJSON.FeatureCollection<GeoJSON.LineString> | null => {
    if (!segmentsRisk) {
        return null
    }

    if (data.features.length === 0) {
        return null
    }

    // Filter features to include only those whose sid exists in segmentsRisk
    const featuresWithRisk = data.features.filter(
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        (feature) => feature.properties?.sid && segmentsRisk[feature.properties.sid]
    )

    if (featuresWithRisk.length === 0) {
        return null // Return null if no features have corresponding risk data
    }

    return {
        ...data,
        features: featuresWithRisk, // Return the filtered features
    }
}

const applyRiskColorsToSegments = (
    data: GeoJSON.FeatureCollection<GeoJSON.LineString>,
    segmentsRisk: { [key: string]: SegmentRisk }
): GeoJSON.FeatureCollection<GeoJSON.LineString> => ({
    ...data,
    features: data.features.map((feature) => ({
        ...feature,
        properties: {
            ...feature.properties,
            line_color: segmentsRisk[feature.properties?.sid].color,
            risk_value: segmentsRisk[feature.properties?.sid].risk,
        },
    })),
})

const RiskLineLayer: React.FC<RiskLineLayerProps> = ({ lineSegments, preloadedRiskData }) => {
    const [geoJSON, setGeoJSON] = useState<GeoJSON.FeatureCollection<GeoJSON.LineString> | null>(null)

    // Update GeoJSON when risk data or segments change
    useEffect(() => {
        if (lineSegments && preloadedRiskData?.segments_risk) {
            // Step 1: Filter
            const filteredSegments = filterSegmentsWithRisk(lineSegments, preloadedRiskData.segments_risk)
            if (filteredSegments) {
                // Step 2: Apply colors
                const coloredSegments = applyRiskColorsToSegments(filteredSegments, preloadedRiskData.segments_risk)
                setGeoJSON(coloredSegments)
            } else {
                setGeoJSON(null) // No segments with risk
            }
        } else {
            setGeoJSON(null) // Clear GeoJSON if no risk data or line segments
        }
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
