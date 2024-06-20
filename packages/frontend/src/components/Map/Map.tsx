import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import {
    LngLatBoundsLike,
    LngLatLike,
    MapRef
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import MarkerContainer from './Markers/MarkerContainer';
import LocationMarker from './Markers/Classes/LocationMarker/LocationMarker';
import linesGeoJSON from '../../data/lineSegments.json'
import stationsData from '../../data/StationsList.json';
import StationLayer from './MapLayers/StationLayer/StationLayer';
import RiskLineLayer from './MapLayers/LineLayer/RiskLineLayer';
import RegularLineLayer from './MapLayers/LineLayer/RegularLineLayer';
import { getRecentDataWithIfModifiedSince } from '../../utils/dbUtils';
import { convertStationsToGeoJSON } from '../../utils/mapUtils';
import './Map.css';
import { RiskData } from '../../utils/types';

const Map = lazy(() => import('react-map-gl/maplibre'));

interface FreifahrenMapProps {
    formSubmitted: boolean;
    userPosition: { lng: number, lat: number } | null | null;
    setUserPosition: (position: { lng: number, lat: number } | null) => void;
    isFirstOpen: boolean;
    openAskForLocation: () => void;
    currentColorTheme: string;
    isRiskLayerOpen: boolean;
}

export const berlinViewPosition: { lng: number, lat: number } = { lng: 13.388, lat: 52.5162 };

const FreifahrenMap: React.FC<FreifahrenMapProps> = ({
    formSubmitted,
    userPosition,
    setUserPosition,
    isFirstOpen,
    openAskForLocation,
    currentColorTheme,
    isRiskLayerOpen
}) => {

    const SouthWestBounds: LngLatLike = { lng: 12.8364646484805, lat: 52.23115511676795 }
    const NorthEastBounds: LngLatLike = { lng: 13.88044556529124, lat: 52.77063424239867 }
    const maxBounds: LngLatBoundsLike = [SouthWestBounds, NorthEastBounds];

    const map = useRef<MapRef>(null);

    const stationGeoJSON = convertStationsToGeoJSON(stationsData);

    const textColor = currentColorTheme === 'light' ? '#000' : '#fff';

    // Move the layers to the correct order
    useEffect(() => {
        const currentMap = map.current;

        if (currentMap) {
            // using an interval to check, because the map is not immediately loaded
            const intervalId = setInterval(() => {
                if (currentMap.isStyleLoaded()) {
                    // Once confirmed that the map is loaded, clear the interval
                    clearInterval(intervalId);

                    const moveLayerSafely = (layerId: string, beforeId: string) => {
                        if (currentMap.getLayer(layerId) && currentMap.getLayer(beforeId)) {
                            currentMap.moveLayer(layerId, beforeId);
                        }
                    };

                    const lineLayerId = isRiskLayerOpen ? 'risk-line-layer' : 'line-layer';
                    const labelLayerId = isRiskLayerOpen ? 'risk-label-layer' : 'label-layer';

                    // Perform the layer moves
                    moveLayerSafely(lineLayerId, 'stationLayer');
                    moveLayerSafely(labelLayerId, 'stationLayer');
                    moveLayerSafely('stationLayer', 'stationNameLayer');
                }
            }, 1000*0.1);

            return () => {
                clearInterval(intervalId);
            };
        }
    }, [isRiskLayerOpen, map]);

    // preload colors before risklayer component mounts to instantly show the highlighted segments
    const [segmentRiskData, setSegmentRiskData] = useState<RiskData | null>(null);
    useEffect(() => {
        async function prepareRiskData() {
        const segmentRiskData = await getRecentDataWithIfModifiedSince(`${process.env.REACT_APP_API_URL}/risk-prediction/getSegmentColors`, null);
        setSegmentRiskData(segmentRiskData);
        }

        prepareRiskData();
    }, [isFirstOpen]);

    return (
        <div id='map-container' data-testid='map-container'>
            <Map
                reuseMaps
                data-testid='map'
                ref={map}
                id='map'
                initialViewState={{
                    longitude: berlinViewPosition.lng,
                    latitude: berlinViewPosition.lat,
                    zoom: 11,
                }}
                maxZoom={14}
                minZoom={10}

                maxBounds={maxBounds}

                mapStyle={
                    currentColorTheme === 'light' ? `https://api.jawg.io/styles/359ec2e4-39f7-4fb5-8e3a-52037d043f96.json?access-token=${process.env.REACT_APP_JAWG_ACCESS_TOKEN}`:
                    `https://api.jawg.io/styles/848dfeff-2d26-4044-8b83-3b1851256e3d.json?access-token=${process.env.REACT_APP_JAWG_ACCESS_TOKEN}`
                }
            >
                <Suspense fallback={<div>Loading...</div>}>
                    {!isFirstOpen && <LocationMarker userPosition={userPosition} setUserPosition={setUserPosition} openAskForLocation={openAskForLocation} />}
                    <MarkerContainer  isFirstOpen={isFirstOpen} formSubmitted={formSubmitted} userPosition={userPosition}/>
                    {isRiskLayerOpen
                        ? <RiskLineLayer preloadedRiskData={segmentRiskData} linesGeoJSON={linesGeoJSON as GeoJSON.FeatureCollection<GeoJSON.LineString>} textColor={textColor} />
                        : <RegularLineLayer linesGeoJSON={linesGeoJSON as GeoJSON.FeatureCollection<GeoJSON.LineString>} textColor={textColor} />
                    }
                    <StationLayer stations={stationGeoJSON} textColor={textColor} />
                </Suspense>
            </Map>
        </div>
    );
};

export default FreifahrenMap;
