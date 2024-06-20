import React, { useEffect, useState, useRef } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';

import { getRecentDataWithIfModifiedSince } from '../../../../utils/dbUtils';
import { RiskData } from 'src/utils/types';

interface RiskLineLayerProps {
    preloadedRiskData: RiskData | null;
    linesGeoJSON: GeoJSON.FeatureCollection<GeoJSON.LineString>;
    textColor: string;
}

const RiskLineLayer: React.FC<RiskLineLayerProps> = ({ linesGeoJSON, textColor, preloadedRiskData }) => {
    const initializeWithColor = (geoJSON: GeoJSON.FeatureCollection<GeoJSON.LineString>, segmentColors?: {[key: string]: string}) => {
        const defaultColor = '#13C184'; // lowest risk color
        return {
            ...geoJSON,
            features: geoJSON.features.map(feature => ({
                ...feature,
                properties: {
                    ...feature.properties,
                    line_color: segmentColors ? segmentColors[feature.properties?.sid] || defaultColor : defaultColor
                }
            }))
        };
    };

    const [updatedGeoJSON, setUpdatedGeoJSON] = useState<GeoJSON.FeatureCollection<GeoJSON.LineString>>(
        initializeWithColor(linesGeoJSON, preloadedRiskData?.segment_colors)
    );

    const lastUpdateTimestamp = useRef<string | null>(null);

    useEffect(() => {
        const fetchSegmentHighlightColors = async () => {
            try {
                const response = await getRecentDataWithIfModifiedSince(`${process.env.REACT_APP_API_URL}/risk-prediction/getSegmentColors`, lastUpdateTimestamp.current);
                if (response) {
                    const { last_modified, segment_colors } = response;
                    lastUpdateTimestamp.current = last_modified;

                    const newGeoJSON = initializeWithColor(linesGeoJSON, segment_colors);
                    setUpdatedGeoJSON(newGeoJSON);
                }
            } catch (error) {
                console.error('Error fetching segment colors:', error);
            }
        };

        const interval = setInterval(fetchSegmentHighlightColors, 5*1000);
        return () => clearInterval(interval);
    }, [linesGeoJSON]);

    return (
        <>
            <Source id='risk-line-data' type='geojson' data={updatedGeoJSON}>
                <Layer
                    id='risk-line-layer'
                    type='line'
                    source='risk-line-data'
                    layout={{
                        'line-join': 'round',
                        'line-cap': 'round'
                    }}
                    paint={{
                        'line-color': ['get', 'line_color'],
                        'line-width': 3,
                    }}
                />
                <Layer
                    id='risk-label-layer'
                    type='symbol'
                    source='risk-line-data'
                    layout={{
                        'text-field': ['get', 'line'],
                        'text-size': 15,
                        'symbol-placement': 'line',
                        'text-anchor': 'top',
                        'text-offset': [0, 1.5],
                        'text-keep-upright': true
                    }}
                    paint={{
                        'text-color': textColor,
                        'text-opacity': [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            11, 0,
                            12, 1
                        ]
                    }}
                />
            </Source>
        </>
    );
};

export default RiskLineLayer;
