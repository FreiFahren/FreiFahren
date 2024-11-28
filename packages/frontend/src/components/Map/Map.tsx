import 'maplibre-gl/dist/maplibre-gl.css'
import './Map.css'

import { lazy, Suspense, useCallback, useEffect, useRef } from 'react'
import { LngLatBoundsLike, LngLatLike, MapRef, ViewStateChangeEvent } from 'react-map-gl/maplibre'

import { useLocation } from '../../contexts/LocationContext'
import { useRiskData } from '../../contexts/RiskDataContext'
import { useStationsAndLines } from '../../contexts/StationsAndLinesContext'
import { useETagCache } from '../../hooks/useETagCaching'
import { convertStationsToGeoJSON } from '../../utils/mapUtils'
import { RegularLineLayer } from './MapLayers/LineLayer/RegularLineLayer'
import { RiskLineLayer } from './MapLayers/LineLayer/RiskLineLayer'
import { StationLayer } from './MapLayers/StationLayer/StationLayer'
import { LocationMarker } from './Markers/Classes/LocationMarker/LocationMarker'
import { MarkerContainer } from './Markers/MarkerContainer'

const Map = lazy(() => import('react-map-gl/maplibre'))

interface FreifahrenMapProps {
    formSubmitted: boolean
    isFirstOpen: boolean
    currentColorTheme: string
    isRiskLayerOpen: boolean
    onRotationChange: (bearing: number) => void
}

const berlinViewPosition: { lng: number; lat: number } = { lng: 13.388, lat: 52.5162 }
const githubIcon = `${process.env.PUBLIC_URL}/icons/github.svg`
const instagramIcon = `${process.env.PUBLIC_URL}/icons/instagram.svg`

export const FreifahrenMap = ({
    formSubmitted,
    isFirstOpen,
    currentColorTheme,
    isRiskLayerOpen,
    onRotationChange,
}: FreifahrenMapProps) => {
    const SouthWestBounds: LngLatLike = { lng: 12.8364646484805, lat: 52.23115511676795 }
    const NorthEastBounds: LngLatLike = { lng: 14.00044556529124, lat: 52.77063424239867 }
    const maxBounds: LngLatBoundsLike = [SouthWestBounds, NorthEastBounds]

    const { data: lineSegments, error: segmentsError } = useETagCache<GeoJSON.FeatureCollection<GeoJSON.LineString>>({
        endpoint: '/lines/segments',
        storageKeyPrefix: 'segments',
        onError: (error) => {
            // eslint-disable-next-line no-console
            console.error('Error loading lines GeoJSON', error)
        },
    })

    if (segmentsError) {
        // eslint-disable-next-line no-console
        console.error('Error loading lines GeoJSON', segmentsError)
    }

    const map = useRef<MapRef>(null)
    const { allStations } = useStationsAndLines()
    const stationGeoJSON = convertStationsToGeoJSON(allStations)

    const { userPosition, initializeLocationTracking } = useLocation()

    useEffect(() => {
        if (!isFirstOpen) {
            initializeLocationTracking()
        }
    }, [isFirstOpen, initializeLocationTracking])

    const textColor = currentColorTheme === 'light' ? '#000' : '#fff'

    // preload colors before risklayer component mounts to instantly show the highlighted segments
    const { segmentRiskData, refreshRiskData } = useRiskData()

    const hasRefreshed = useRef(false) // To prevent refreshing on every render

    useEffect(() => {
        if (isFirstOpen && !hasRefreshed.current) {
            // Refresh or load risk data on initial open
            refreshRiskData().catch((error) => {
                // eslint-disable-next-line no-console
                console.error('Error loading risk data', error)
            })
            hasRefreshed.current = true
        }
    }, [isFirstOpen, refreshRiskData])

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
                    mapStyle={
                        currentColorTheme === 'light'
                            ? `https://api.jawg.io/styles/359ec2e4-39f7-4fb5-8e3a-52037d043f96.json?access-token=${process.env.REACT_APP_JAWG_ACCESS_TOKEN}`
                            : `https://api.jawg.io/styles/848dfeff-2d26-4044-8b83-3b1851256e3d.json?access-token=${process.env.REACT_APP_JAWG_ACCESS_TOKEN}`
                    }
                >
                    {!isFirstOpen && <LocationMarker userPosition={userPosition} />}
                    <MarkerContainer
                        isFirstOpen={isFirstOpen}
                        formSubmitted={formSubmitted}
                        userPosition={userPosition}
                    />
                    <StationLayer stations={stationGeoJSON} textColor={textColor} />
                    {isRiskLayerOpen ? (
                        <RiskLineLayer
                            preloadedRiskData={segmentRiskData}
                            lineSegments={lineSegments}
                            textColor={textColor}
                        />
                    ) : (
                        <RegularLineLayer lineSegments={lineSegments} textColor={textColor} />
                    )}
                </Map>
            </Suspense>
            <div className="social-media">
                <a href="https://github.com/FreiFahren/FreiFahren" target="_blank" rel="noopener noreferrer">
                    <img src={githubIcon} alt="GitHub" />
                </a>
                <a href="https://www.instagram.com/frei.fahren/" target="_blank" rel="noopener noreferrer">
                    <img src={instagramIcon} alt="Instagram" />
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
