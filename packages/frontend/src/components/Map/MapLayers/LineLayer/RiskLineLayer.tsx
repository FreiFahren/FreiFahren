/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react'
import { Source, Layer } from 'react-map-gl/maplibre'

import { RiskData } from 'src/utils/types'
import { useRiskData } from 'src/contexts/RiskDataContext'

interface RiskLineLayerProps {
    preloadedRiskData: RiskData | null
    linesGeoJSON: GeoJSON.FeatureCollection<GeoJSON.LineString>
    textColor: string
}

const RiskLineLayer: React.FC<RiskLineLayerProps> = ({ linesGeoJSON, textColor, preloadedRiskData }) => {
    const { segmentRiskData, refreshRiskData } = useRiskData()
    const [geoJSON, setGeoJSON] = useState(linesGeoJSON)

    // Function to apply color updates to GeoJSON
    const applySegmentColors = (segmentColors?: { [key: string]: string }) => {
        const defaultColor = '#13C184' // lowest risk color
        return {
            ...geoJSON,
            features: geoJSON.features.map((feature) => ({
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
        setGeoJSON(applySegmentColors(segmentRiskData?.segment_colors))
    }, [segmentRiskData])

    // Initialize with preloaded data
    useEffect(() => {
        if (preloadedRiskData && preloadedRiskData.segment_colors) {
            setGeoJSON(applySegmentColors(preloadedRiskData.segment_colors))
        }
    }, [preloadedRiskData, linesGeoJSON])

    // Periodically fetch new risk data to account for changes
    useEffect(() => {
        const interval = setInterval(() => {
            refreshRiskData()
        }, 30 * 1000)
        return () => clearInterval(interval)
    }, [refreshRiskData])

    return (
        <>
            <Source id="risk-line-data" type="geojson" data={geoJSON}>
                <Layer
                    id="risk-line-layer"
                    type="line"
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
                        'text-color': textColor,
                        'text-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0, 12, 1],
                    }}
                />
            </Source>
        </>
    )
}

export default RiskLineLayer
