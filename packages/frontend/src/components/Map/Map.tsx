import 'maplibre-gl/dist/maplibre-gl.css'
import './Map.css'

import React, { lazy, Suspense, useCallback, useEffect, useRef } from 'react'
import { LngLatBoundsLike, LngLatLike, MapRef, ViewStateChangeEvent } from 'react-map-gl/maplibre'

import { useLocation } from '../../contexts/LocationContext'
import { convertStationsToGeoJSON } from '../../utils/mapUtils'
import { RegularLineLayer } from './MapLayers/LineLayer/RegularLineLayer'
import { RiskLineLayer } from './MapLayers/LineLayer/RiskLineLayer'
import { StationLayer } from './MapLayers/StationLayer/StationLayer'
import { LocationMarker } from './Markers/Classes/LocationMarker/LocationMarker'
import { MarkerContainer } from './Markers/MarkerContainer'
import { useRiskData, useSegments, useStations } from 'src/api/queries'

const Map = lazy(() => import('react-map-gl/maplibre'))

interface FreifahrenMapProps {
    isFirstOpen: boolean
    isRiskLayerOpen: boolean
    onRotationChange: (bearing: number) => void
}

const berlinViewPosition: { lng: number; lat: number } = { lng: 13.388, lat: 52.5162 }
const GITHUB_ICON = `${process.env.PUBLIC_URL}/icons/github.svg`
const INSTAGRAM_ICON = `${process.env.PUBLIC_URL}/icons/instagram.svg`

const FreifahrenMap: React.FC<FreifahrenMapProps> = ({ isFirstOpen, isRiskLayerOpen, onRotationChange }) => {
    const SouthWestBounds: LngLatLike = { lng: 12.8364646484805, lat: 52.23115511676795 }
    const NorthEastBounds: LngLatLike = { lng: 14.00044556529124, lat: 52.77063424239867 }
    const maxBounds: LngLatBoundsLike = [SouthWestBounds, NorthEastBounds]

    const { data: lineSegments = null } = useSegments()

    const map = useRef<MapRef>(null)
    const { data: stations } = useStations()
    const stationGeoJSON = convertStationsToGeoJSON(stations ?? {})

    const { userPosition, initializeLocationTracking } = useLocation()

    useEffect(() => {
        if (!isFirstOpen) {
            initializeLocationTracking()
        }
    }, [isFirstOpen, initializeLocationTracking])

    // preload colors before risklayer component mounts to instantly show the highlighted segments
    const { data: segmentRiskData } = useRiskData()

    const handleRotate = useCallback(
        (event: ViewStateChangeEvent) => {
            onRotationChange(event.viewState.bearing)
        },
        [onRotationChange]
    )

    return (
        <div id="map-container" data-testid="map-container">
            <Suspense fallback={<div>Loading...</div>}>
                <Map
                    reuseMaps
                    data-testid="map"
                    ref={map}
                    id="map"
                    initialViewState={{
                        longitude: berlinViewPosition.lng,
                        latitude: berlinViewPosition.lat,
                        zoom: 11,
                    }}
                    maxZoom={14}
                    minZoom={10}
                    maxBounds={maxBounds}
                    onRotate={handleRotate}
                    mapStyle={`https://api.jawg.io/styles/848dfeff-2d26-4044-8b83-3b1851256e3d.json?access-token=${process.env.REACT_APP_JAWG_ACCESS_TOKEN}`}
                >
                    {!isFirstOpen ? <LocationMarker userPosition={userPosition} /> : null}
                    <MarkerContainer isFirstOpen={isFirstOpen} userPosition={userPosition} />
                    <StationLayer stations={stationGeoJSON} />
                    {isRiskLayerOpen ? (
                        <RiskLineLayer preloadedRiskData={segmentRiskData} lineSegments={lineSegments} />
                    ) : (
                        <RegularLineLayer lineSegments={lineSegments} />
                    )}
                </Map>
            </Suspense>
            <div className="social-media">
                <a href="https://github.com/FreiFahren/FreiFahren" target="_blank" rel="noopener noreferrer">
                    <img src={GITHUB_ICON} alt="GitHub" />
                </a>
                <a href="https://www.instagram.com/frei.fahren/" target="_blank" rel="noopener noreferrer">
                    <img src={INSTAGRAM_ICON} alt="Instagram" />
                </a>
            </div>
            <div className="map-attribution">
                <a href="https://www.jawg.io/" target="_blank" rel="noopener noreferrer">
                    © JawgMaps
                </a>{' '}
                |
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
                    © OSM contributors
                </a>
            </div>
        </div>
    )
}

export { FreifahrenMap }
