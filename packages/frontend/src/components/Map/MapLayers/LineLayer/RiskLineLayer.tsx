import React, { useEffect, useState } from 'react'
import { Layer, Source } from 'react-map-gl/maplibre'
import { useRiskData } from 'src/contexts/RiskDataContext'
import { RiskData } from 'src/utils/types'

interface RiskLineLayerProps {
    preloadedRiskData: RiskData | null
    lineSegments: GeoJSON.FeatureCollection<GeoJSON.LineString> | null
}

const RiskLineLayer: React.FC<RiskLineLayerProps> = ({ lineSegments, preloadedRiskData }) => {
    const { segmentRiskData, refreshRiskData } = useRiskData()
    const [geoJSON, setGeoJSON] = useState<GeoJSON.FeatureCollection<GeoJSON.LineString> | null>(null)

    const applySegmentColors = (
        data: GeoJSON.FeatureCollection<GeoJSON.LineString>,
        segmentColors?: { [key: string]: string }
    ) => {
        const defaultColor = '#13C184' // lowest risk color

        return {
            ...data,
            features: data.features.map((feature) => ({
                ...feature,
                properties: {
                    ...feature.properties,
                    line_color: segmentColors ? segmentColors[feature.properties?.sid] || defaultColor : defaultColor,
                },
            })),
        }
    }

    // If the segment risk data changes, update the GeoJSON
    useEffect(() => {
        if (lineSegments && segmentRiskData?.segment_colors) {
            setGeoJSON(applySegmentColors(lineSegments, segmentRiskData.segment_colors))
        }
    }, [segmentRiskData, lineSegments])

    // Initialize with preloaded data
    useEffect(() => {
        if (lineSegments && preloadedRiskData?.segment_colors) {
            setGeoJSON(applySegmentColors(lineSegments, preloadedRiskData.segment_colors))
        } else if (lineSegments) {
            setGeoJSON(applySegmentColors(lineSegments))
        }
    }, [preloadedRiskData, lineSegments])

    // Periodically fetch new risk data to account for changes
    useEffect(() => {
        const interval = setInterval(() => {
            refreshRiskData().catch((error) => {
                // fix this later with sentry
                // eslint-disable-next-line no-console
                console.error('Error refreshing risk data', error)
            })
        }, 30 * 1000)

        return () => clearInterval(interval)
    }, [refreshRiskData])

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
