import React, { useEffect, useState } from 'react'
import { Layer, Source } from 'react-map-gl/maplibre'
import { RiskData, SegmentRisk } from 'src/utils/types'

interface RiskLineLayerProps {
    preloadedRiskData: RiskData | null
    lineSegments: GeoJSON.FeatureCollection<GeoJSON.LineString> | null
}

const RiskLineLayer: React.FC<RiskLineLayerProps> = ({ lineSegments, preloadedRiskData }) => {
    const [geoJSON, setGeoJSON] = useState<GeoJSON.FeatureCollection<GeoJSON.LineString> | null>(null)

    const applySegmentColors = (
        data: GeoJSON.FeatureCollection<GeoJSON.LineString>,
        segmentsRisk?: { [key: string]: SegmentRisk }
    ) => {
        const defaultColor = '#13C184' // lowest risk color

        return {
            ...data,
            features: data.features.map((feature) => ({
                ...feature,
                properties: {
                    ...feature.properties,
                    line_color: segmentsRisk
                        ? segmentsRisk[feature.properties?.sid].color || defaultColor
                        : defaultColor,
                    risk_value:
                        segmentsRisk && typeof segmentsRisk[feature.properties?.sid].risk === 'number'
                            ? segmentsRisk[feature.properties?.sid].risk
                            : 0,
                },
            })),
        }
    }

    // If the segment risk data changes, update the GeoJSON
    useEffect(() => {
        if (lineSegments && preloadedRiskData?.segments_risk) {
            setGeoJSON(applySegmentColors(lineSegments, preloadedRiskData.segments_risk))
        }
    }, [preloadedRiskData, lineSegments])

    // Initialize with preloaded data
    useEffect(() => {
        if (lineSegments && preloadedRiskData?.segments_risk) {
            setGeoJSON(applySegmentColors(lineSegments, preloadedRiskData.segments_risk))
        } else if (lineSegments) {
            setGeoJSON(applySegmentColors(lineSegments))
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
            <Layer
                id="risk-label-layer"
                type="symbol"
                beforeId="stationLayer"
                source="risk-line-data"
                layout={{
                    'text-field': ['get', 'line'],
                    'text-size': 15,
                    'symbol-placement': 'line',
                    'text-anchor': 'top',
                    'text-offset': [0, 1.5],
                    'text-keep-upright': true,
                }}
                paint={{
                    'text-color': '#fff',
                    'text-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0, 12, 1],
                }}
            />
        </Source>
    )
}

export { RiskLineLayer }
